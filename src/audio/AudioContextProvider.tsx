import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './AudioEngine';
import { loadBars } from '../data/loaders';
import type { BarId } from '../data/types';
import type { SequenceOpts } from '../lib/sequencer';
import { ensureAudioReady, getAudioDiagnostics, isAudioUnlocked, isIosSafari, primeOnFirstUserGesture } from './iosUnmute';
import { clampScheduleTime } from './playAllScheduler';
import { buildPlan } from './buildPlan';

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


type PlayAllPlan = {
  barIds: BarId[];
  durationsByIndex: number[];
  bufferPromises: Promise<AudioBuffer>[];
};

const PLAYALL_PREROLL_S = 0.18;
const PLAYALL_LOOKAHEAD_S = 1.25;
const PLAYALL_TICK_MS = 25;
const PLAYALL_PRELOAD_BARS = 40;

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
  const schedulerRef = useRef<number | null>(null);

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
      if (schedulerRef.current !== null) {
        window.clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
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

  const preparePlayAll = useCallback(async (barIds: BarId[], opts: SequenceOpts) => {
    if (import.meta.env.DEV) {
      performance.mark('playall_prepare_start');
    }
    const { durationsByIndex, barIds: plannedBarIds } = buildPlan(barIds, opts);
    const bufferPromises = plannedBarIds.map((barId) => engine.getBuffer(barId));
    const preloadCount = Math.min(plannedBarIds.length, PLAYALL_PRELOAD_BARS);
    await Promise.all(bufferPromises.slice(0, preloadCount));
    if (import.meta.env.DEV) {
      performance.mark('playall_prepare_end');
      try {
        performance.measure('playall_prepare', 'playall_prepare_start', 'playall_prepare_end');
      } catch {
        // ignore
      }
    }

    return {
      barIds: plannedBarIds,
      durationsByIndex,
      bufferPromises,
    } satisfies PlayAllPlan;
  }, [engine]);

  const prewarmBars = useCallback((barIds: BarId[]) => {
    const prewarmCount = Math.min(barIds.length, PLAYALL_PRELOAD_BARS);
    barIds.slice(0, prewarmCount).forEach((barId) => {
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
    if (schedulerRef.current !== null) {
      window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
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

    let plan: PlayAllPlan;
    try {
      plan = await preparePlayAll(barIds, opts);
    } catch {
      return;
    }
    if (token !== playSequenceToken.current) return;
    if (import.meta.env.DEV) {
      const firstInput = barIds[0];
      const lastInput = barIds[barIds.length - 1];
      const firstPlan = plan.barIds[0];
      const lastPlan = plan.barIds[plan.barIds.length - 1];
      if (plan.barIds.length !== barIds.length || firstInput !== firstPlan || lastInput !== lastPlan) {
        console.error('[playall] plan/input mismatch; aborting sequence start', {
          requestedBarIds: barIds,
          plannedBarIds: plan.barIds,
        });
        return;
      }
    }

    const ctx = engine.context;
    const t0 = ctx.currentTime + PLAYALL_PREROLL_S;
    if (import.meta.env.DEV) {
      performance.mark('playall_schedule_start');
    }

    clearSequenceStepTimers();
    const ids: string[] = [];
    setSequence({
      active: true,
      name: meta?.name ?? 'Glissando',
      currentStep: 0,
      totalSteps: plan.barIds.length,
      barIds: plan.barIds,
      voiceIds: ids,
      anchorVoiceId: oldestActiveVoiceId ?? null,
    });

    let nextIndex = 0;
    let nextTime = t0;
    let scheduledCount = 0;
    let droppedAvoidedCount = 0;
    let nearMissWarned = false;
    let firstScheduled = false;

    const scheduleIndex = (i: number, scheduleTime: number) => {
      void plan.bufferPromises[i].then((buffer) => {
        if (token !== playSequenceToken.current) return;
        const id = engine.playBufferAt(plan.barIds[i], buffer, scheduleTime, { gain: opts.gain });
        ids[i] = id;
        const startedAt = performance.now() + Math.max(0, (scheduleTime - engine.context.currentTime) * 1000);
        const voice = scheduleCleanup(id, plan.barIds[i], startedAt, buffer.duration);
        setVoices((v) => [...v, voice]);
        const stepTimer = window.setTimeout(() => {
          setSequence((prev) => {
            const firstVoiceId = ids[0];
            if (!firstVoiceId || !prev.active || prev.voiceIds[0] !== firstVoiceId) return prev;
            const nextStep = i + 1;
            if (nextStep >= prev.totalSteps) {
              return { ...prev, currentStep: nextStep, active: false };
            }
            return { ...prev, currentStep: nextStep };
          });
        }, Math.max(0, startedAt - performance.now()));
        sequenceStepTimers.current.push(stepTimer);
        setSequence((prev) => {
          if (!prev.active) return prev;
          const nextVoiceIds = prev.voiceIds.slice();
          nextVoiceIds[i] = id;
          return {
            ...prev,
            voiceIds: nextVoiceIds,
            anchorVoiceId: prev.anchorVoiceId ?? oldestActiveVoiceId ?? id,
          };
        });
      });
    };

    const finalizeSequence = () => {
      if (import.meta.env.DEV) {
        console.info('[playall] scheduling summary', {
          scheduledCount,
          droppedAvoidedCount,
          totalBars: plan.barIds.length,
        });
      }
      flushPlayAllPerf();
    };

    const runTick = () => {
      if (token !== playSequenceToken.current) {
        return;
      }
      const horizon = ctx.currentTime + PLAYALL_LOOKAHEAD_S;
      while (nextTime < horizon && nextIndex < plan.barIds.length) {
        if (import.meta.env.DEV && !nearMissWarned && nextTime <= ctx.currentTime + 0.01) {
          nearMissWarned = true;
          console.warn('[playall] near-past schedule detected', {
            currentTime: ctx.currentTime,
            nextTime,
            nextIndex,
            coldStart: scheduledCount === 0,
          });
        }

        const clamp = clampScheduleTime(nextTime, ctx.currentTime);
        if (clamp.clamped) {
          droppedAvoidedCount += 1;
        }
        const scheduledTime = clamp.scheduledTime;
        scheduleIndex(nextIndex, scheduledTime);
        if (!firstScheduled) {
          firstScheduled = true;
          if (import.meta.env.DEV) {
            performance.mark('playall_first_bar_scheduled');
            try {
              performance.measure('playall_schedule_to_first_bar', 'playall_schedule_start', 'playall_first_bar_scheduled');
              performance.measure('playall_total_to_first_bar', 'playall_click', 'playall_first_bar_scheduled');
            } catch {
              // ignore missing marks
            }
          }
        }

        scheduledCount += 1;
        nextTime = scheduledTime + (plan.durationsByIndex[nextIndex] ?? 0);
        nextIndex += 1;
      }

      if (nextIndex >= plan.barIds.length && schedulerRef.current !== null) {
        window.clearInterval(schedulerRef.current);
        schedulerRef.current = null;
        finalizeSequence();
      }
    };

    schedulerRef.current = window.setInterval(runTick, PLAYALL_TICK_MS);
    runTick();
  }, [clearSequenceStepTimers, engine, ensureReady, flushPlayAllPerf, mark, measure, preparePlayAll, scheduleCleanup, stopSequenceInternal, voices]);

  const stopAll = useCallback(() => {
    playSequenceToken.current += 1;
    if (schedulerRef.current !== null) {
      window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
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
