import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './AudioEngine';
import { loadBars } from '../data/loaders';
import type { BarId } from '../data/types';
import type { SequenceOpts } from '../lib/sequencer';
import { ensureAudioReady, getAudioDiagnostics, isAudioUnlocked, isIosSafari, primeOnFirstUserGesture } from './iosUnmute';

type Voice = { id: string; barId: BarId; startedAt: number; stop: () => void };

type SequenceState = {
  active: boolean;
  name: string;
  currentStep: number;
  totalSteps: number;
  barIds: BarId[];
  voiceIds: string[];
  anchorVoiceId: string | null;
};

type AudioApi = {
  voices: Voice[];
  playingBarIds: Set<BarId>;
  sequence: SequenceState;
  canPlay: (barId: BarId) => boolean;
  playBar: (barId: BarId) => Promise<void>;
  playSequenceByBarIds: (barIds: BarId[], opts: SequenceOpts, meta?: { name?: string }) => Promise<void>;
  stopBar: (barId: BarId) => void;
  stopSequence: () => void;
  toggleBar: (barId: BarId) => Promise<void>;
  stopVoice: (id: string) => void;
  stopAll: () => void;
  audioUnlocked: boolean;
  showUnlockHint: boolean;
  unlockToast: string | null;
  requestAudioUnlock: () => Promise<void>;
  primeAudio: () => void;
  prewarmBars: (barIds: BarId[]) => void;
};

const Ctx = createContext<AudioApi | null>(null);

const idleSequence: SequenceState = {
  active: false,
  name: '',
  currentStep: 0,
  totalSteps: 0,
  barIds: [],
  voiceIds: [],
  anchorVoiceId: null,
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(() => new AudioEngine(), []);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [sequence, setSequence] = useState<SequenceState>(idleSequence);
  const endTimers = useRef(new Map<string, number>());
  const sequenceStepTimers = useRef<number[]>([]);
  const unlockToastTimer = useRef<number | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(() => isAudioUnlocked());
  const [unlockToast, setUnlockToast] = useState<string | null>(null);
  const playSequenceToken = useRef(0);

  const mark = useCallback((name: string) => {
    if (!import.meta.env.DEV) return;
    performance.mark(name);
  }, []);

  const measure = useCallback((name: string, start: string, end: string) => {
    if (!import.meta.env.DEV) return;
    try {
      performance.measure(name, start, end);
    } catch {
      // ignore missing marks
    }
  }, []);

  const flushPlayAllPerf = useCallback(() => {
    if (!import.meta.env.DEV) return;
    const entries = performance
      .getEntriesByType('measure')
      .filter((entry) => entry.name.startsWith('playall_'));
    if (!entries.length) return;
    console.table(entries.map((entry) => ({ name: entry.name, ms: Number(entry.duration.toFixed(1)) })));
    performance.clearMeasures();
    performance.clearMarks();
  }, []);

  const clearSequenceStepTimers = useCallback(() => {
    sequenceStepTimers.current.forEach((timer) => window.clearTimeout(timer));
    sequenceStepTimers.current = [];
  }, []);

  const scheduleCleanup = useCallback((id: string, barId: BarId, startedAt: number, durationS: number) => {
    const ms = Math.max(0, durationS * 1000 + (startedAt - performance.now()) + 10);
    const timeout = window.setTimeout(() => {
      endTimers.current.delete(id);
      setVoices((v) => v.filter((voice) => voice.id !== id));
    }, ms);
    endTimers.current.set(id, timeout);
    return { id, barId, startedAt, stop: () => engine.stopVoice(id) } as Voice;
  }, [engine]);

  useEffect(() => {
    primeOnFirstUserGesture(engine.context);
    loadBars().then((bars) => engine.setPathMap(Object.fromEntries(bars.map((b) => [b.barId, b.audioPath]))));
    return () => {
      endTimers.current.forEach((timer) => window.clearTimeout(timer));
      endTimers.current.clear();
      clearSequenceStepTimers();
      if (unlockToastTimer.current) {
        window.clearTimeout(unlockToastTimer.current);
      }
      engine.stopAll();
    };
  }, [clearSequenceStepTimers, engine]);


  const ensureReady = useCallback(async () => {
    try {
      await ensureAudioReady(engine.context);
      if (import.meta.env.DEV) {
        const diagnostics = getAudioDiagnostics();
        console.info('[audio] diagnostics', {
          ctxState: engine.context.state,
          iosSafari: isIosSafari(),
          keepAliveExists: diagnostics.keepAliveExists,
          keepAlivePaused: diagnostics.keepAlivePaused,
        });
      }
      setAudioUnlocked(true);
      setUnlockToast(null);
    } catch {
      setUnlockToast('Tap again to enable sound');
      if (unlockToastTimer.current) {
        window.clearTimeout(unlockToastTimer.current);
      }
      unlockToastTimer.current = window.setTimeout(() => {
        setUnlockToast(null);
        unlockToastTimer.current = null;
      }, 2200);
      throw new Error('audio unlock failed');
    }
  }, [engine]);

  const primeAudio = useCallback(() => {
    mark('playall_prime_start');
    void ensureAudioReady(engine.context)
      .catch(() => undefined)
      .finally(() => {
        mark('playall_prime_end');
        measure('playall_prime', 'playall_prime_start', 'playall_prime_end');
      });
  }, [engine, mark, measure]);

  const prewarmBars = useCallback((barIds: BarId[]) => {
    barIds.forEach((barId) => {
      void engine.getBuffer(barId).catch(() => undefined);
    });
  }, [engine]);

  const stopVoice = useCallback((id: string) => {
    const timer = endTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      endTimers.current.delete(id);
    }
    engine.stopVoice(id);
    setVoices((v) => v.filter((voice) => voice.id !== id));
  }, [engine]);

  const stopVoicesByIds = useCallback((ids: string[], opts?: { protectedVoiceIds?: Set<string> }) => {
    const protectedVoiceIds = opts?.protectedVoiceIds;
    const toStop = ids.filter((id) => !protectedVoiceIds?.has(id));
    toStop.forEach((id) => {
      const timer = endTimers.current.get(id);
      if (timer) {
        window.clearTimeout(timer);
        endTimers.current.delete(id);
      }
      engine.stopVoice(id);
    });
    if (toStop.length) {
      setVoices((v) => v.filter((voice) => !toStop.includes(voice.id)));
    }
  }, [engine]);

  const stopSequenceInternal = useCallback((opts?: { protectedVoiceIds?: Set<string> }) => {
    clearSequenceStepTimers();
    setSequence((prev) => {
      stopVoicesByIds(prev.voiceIds, opts);
      return idleSequence;
    });
  }, [clearSequenceStepTimers, stopVoicesByIds]);

  const stopSequence = useCallback(() => {
    stopSequenceInternal();
  }, [stopSequenceInternal]);

  const stopBar = useCallback((barId: BarId) => {
    const toStop = voices.filter((v) => v.barId === barId).map((v) => v.id);
    toStop.forEach(stopVoice);
  }, [stopVoice, voices]);

  const playBar = useCallback(async (barId: BarId) => {
    try {
      await ensureReady();
    } catch {
      return;
    }
    const buffer = await engine.getBuffer(barId);
    const when = engine.context.currentTime;
    const startedAt = performance.now() + Math.max(0, (when - engine.context.currentTime) * 1000);
    const id = engine.playBufferAt(barId, buffer, when, { gain: 1 });
    const voice = scheduleCleanup(id, barId, startedAt, buffer.duration);
    setVoices((v) => [...v, voice]);
  }, [engine, ensureReady, scheduleCleanup]);

  const playSequenceByBarIds = useCallback(async (barIds: BarId[], opts: SequenceOpts, meta?: { name?: string }) => {
    if (!barIds.length) return;
    mark('playall_click');

    const oldestActiveVoiceId = voices
      .slice()
      .sort((a, b) => a.startedAt - b.startedAt)[0]?.id;
    const protectedVoiceIds = oldestActiveVoiceId ? new Set([oldestActiveVoiceId]) : undefined;

    stopSequenceInternal({ protectedVoiceIds });
    playSequenceToken.current += 1;
    const token = playSequenceToken.current;

    try {
      mark('playall_ensureAudioReady_start');
      await ensureReady();
      mark('playall_ensureAudioReady_end');
      measure('playall_ensureAudioReady', 'playall_ensureAudioReady_start', 'playall_ensureAudioReady_end');
    } catch {
      return;
    }
    if (token !== playSequenceToken.current) return;

    mark('playall_buildPlan_start');
    const startAt = engine.context.currentTime + 0.03;
    const whenByIndex: number[] = [];
    let t = startAt;
    for (let i = 0; i < barIds.length; i += 1) {
      whenByIndex.push(t);
      const dt = opts.mode === 'expAccelerando'
        ? Math.max(opts.minIntervalMs ?? 20, opts.intervalMs * Math.pow(opts.expFactor ?? 0.93, i))
        : opts.intervalMs;
      t += dt / 1000;
    }
    const bufferPromises = barIds.map((barId) => engine.getBuffer(barId));
    mark('playall_buildPlan_end');
    measure('playall_buildPlan', 'playall_buildPlan_start', 'playall_buildPlan_end');

    mark('playall_scheduleFirst_start');
    const firstBuffer = await bufferPromises[0];
    if (token !== playSequenceToken.current) return;
    const firstId = engine.playBufferAt(barIds[0], firstBuffer, whenByIndex[0], { gain: opts.gain });
    const firstStartedAt = performance.now() + (whenByIndex[0] - engine.context.currentTime) * 1000;
    const firstVoice = scheduleCleanup(firstId, barIds[0], firstStartedAt, firstBuffer.duration);
    setVoices((v) => [...v, firstVoice]);
    mark('playall_scheduleFirst_end');
    measure('playall_scheduleFirst', 'playall_scheduleFirst_start', 'playall_scheduleFirst_end');
    measure('playall_total_to_scheduleFirst', 'playall_click', 'playall_scheduleFirst_end');

    const ids: string[] = [firstId];

    clearSequenceStepTimers();
    setSequence({
      active: true,
      name: meta?.name ?? 'Glissando',
      currentStep: 0,
      totalSteps: barIds.length,
      barIds,
      voiceIds: ids,
      anchorVoiceId: oldestActiveVoiceId ?? firstId,
    });

    const firstStepTimer = window.setTimeout(() => {
      setSequence((prev) => {
        if (!prev.active || prev.voiceIds[0] !== firstId) return prev;
        if (prev.totalSteps <= 1) {
          return { ...prev, currentStep: 1, active: false };
        }
        return { ...prev, currentStep: 1 };
      });
    }, Math.max(0, firstStartedAt - performance.now()));
    sequenceStepTimers.current.push(firstStepTimer);

    mark('playall_scheduleRest_start');

    let index = 1;
    const chunkSize = 8;
    const scheduleChunk = () => {
      if (token !== playSequenceToken.current) return;
      const end = Math.min(index + chunkSize, barIds.length);
      for (let i = index; i < end; i += 1) {
        void bufferPromises[i].then((buffer) => {
          if (token !== playSequenceToken.current) return;
          const id = engine.playBufferAt(barIds[i], buffer, whenByIndex[i], { gain: opts.gain });
          ids[i] = id;
          const startedAt = performance.now() + (whenByIndex[i] - engine.context.currentTime) * 1000;
          const voice = scheduleCleanup(id, barIds[i], startedAt, buffer.duration);
          setVoices((v) => [...v, voice]);
          const stepTimer = window.setTimeout(() => {
            setSequence((prev) => {
              if (!prev.active || prev.voiceIds[0] !== firstId) return prev;
              const nextStep = i + 1;
              if (nextStep >= prev.totalSteps) {
                return { ...prev, currentStep: nextStep, active: false };
              }
              return { ...prev, currentStep: nextStep };
            });
          }, Math.max(0, startedAt - performance.now()));
          sequenceStepTimers.current.push(stepTimer);
          setSequence((prev) => {
            if (!prev.active || prev.voiceIds[0] !== firstId) return prev;
            const nextVoiceIds = prev.voiceIds.slice();
            nextVoiceIds[i] = id;
            return { ...prev, voiceIds: nextVoiceIds };
          });
        });
      }
      index = end;
      if (index < barIds.length) {
        window.setTimeout(scheduleChunk, 0);
        return;
      }
      mark('playall_scheduleRest_end');
      measure('playall_scheduleRest', 'playall_scheduleRest_start', 'playall_scheduleRest_end');
      flushPlayAllPerf();
    };
    scheduleChunk();
  }, [clearSequenceStepTimers, engine, ensureReady, flushPlayAllPerf, mark, measure, scheduleCleanup, stopSequenceInternal, voices]);

  const stopAll = useCallback(() => {
    playSequenceToken.current += 1;
    clearSequenceStepTimers();
    setSequence(idleSequence);
    endTimers.current.forEach((timer) => window.clearTimeout(timer));
    endTimers.current.clear();
    engine.stopAll();
    setVoices([]);
  }, [clearSequenceStepTimers, engine]);

  const toggleBar = useCallback(async (barId: BarId) => {
    const isPlaying = voices.some((v) => v.barId === barId);
    if (isPlaying) {
      stopBar(barId);
      return;
    }
    await playBar(barId);
  }, [playBar, stopBar, voices]);

  const api: AudioApi = {
    voices,
    playingBarIds: new Set(voices.map((v) => v.barId)),
    sequence,
    canPlay: (barId) => engine.canPlay(barId),
    playBar,
    playSequenceByBarIds,
    stopBar,
    stopSequence,
    toggleBar,
    stopVoice,
    stopAll,
    audioUnlocked,
    showUnlockHint: isIosSafari() && !audioUnlocked,
    unlockToast,
    requestAudioUnlock: ensureReady,
    primeAudio,
    prewarmBars,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useAudio = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AudioProvider missing');
  return ctx;
};
