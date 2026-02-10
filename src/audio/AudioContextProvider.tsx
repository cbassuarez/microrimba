import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './AudioEngine';
import { loadBars } from '../data/loaders';
import type { BarId } from '../data/types';
import { playSequence, type SequenceOpts } from '../lib/sequencer';

type Voice = { id: string; barId: BarId; startedAt: number; stop: () => void };

type SequenceState = {
  active: boolean;
  name: string;
  currentStep: number;
  totalSteps: number;
  barIds: BarId[];
  voiceIds: string[];
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
};

const Ctx = createContext<AudioApi | null>(null);

const idleSequence: SequenceState = {
  active: false,
  name: '',
  currentStep: 0,
  totalSteps: 0,
  barIds: [],
  voiceIds: [],
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(() => new AudioEngine(), []);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [sequence, setSequence] = useState<SequenceState>(idleSequence);
  const endTimers = useRef(new Map<string, number>());
  const sequenceStepTimers = useRef<number[]>([]);

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
    engine.onFirstGestureUnlock();
    loadBars().then((bars) => engine.setPathMap(Object.fromEntries(bars.map((b) => [b.barId, b.audioPath]))));
    return () => {
      endTimers.current.forEach((timer) => window.clearTimeout(timer));
      endTimers.current.clear();
      clearSequenceStepTimers();
      engine.stopAll();
    };
  }, [clearSequenceStepTimers, engine]);

  const stopVoice = useCallback((id: string) => {
    const timer = endTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      endTimers.current.delete(id);
    }
    engine.stopVoice(id);
    setVoices((v) => v.filter((voice) => voice.id !== id));
  }, [engine]);

  const stopSequence = useCallback(() => {
    clearSequenceStepTimers();
    setSequence((prev) => {
      prev.voiceIds.forEach((id) => {
        const timer = endTimers.current.get(id);
        if (timer) {
          window.clearTimeout(timer);
          endTimers.current.delete(id);
        }
        engine.stopVoice(id);
      });
      if (prev.voiceIds.length) {
        setVoices((v) => v.filter((voice) => !prev.voiceIds.includes(voice.id)));
      }
      return idleSequence;
    });
  }, [clearSequenceStepTimers, engine]);

  const stopBar = useCallback((barId: BarId) => {
    const toStop = voices.filter((v) => v.barId === barId).map((v) => v.id);
    toStop.forEach(stopVoice);
  }, [stopVoice, voices]);

  const playBar = useCallback(async (barId: BarId) => {
    await engine.ensureUnlocked();
    const buffer = await engine.getBuffer(barId);
    const when = engine.context.currentTime;
    const startedAt = performance.now() + Math.max(0, (when - engine.context.currentTime) * 1000);
    const id = engine.playBufferAt(barId, buffer, when, { gain: 1 });
    const voice = scheduleCleanup(id, barId, startedAt, buffer.duration);
    setVoices((v) => [...v, voice]);
  }, [engine, scheduleCleanup]);

  const playSequenceByBarIds = useCallback(async (barIds: BarId[], opts: SequenceOpts, meta?: { name?: string }) => {
    if (!barIds.length) return;
    stopSequence();
    await engine.ensureUnlocked();
    const startAt = engine.context.currentTime + 0.03;
    const startedNow = performance.now();
    const ids = await playSequence(engine, barIds, opts);

    clearSequenceStepTimers();
    setSequence({
      active: true,
      name: meta?.name ?? 'Glissando',
      currentStep: 0,
      totalSteps: barIds.length,
      barIds,
      voiceIds: ids,
    });

    let t = startAt;
    for (let i = 0; i < barIds.length; i += 1) {
      const buffer = await engine.getBuffer(barIds[i]);
      const startedAt = startedNow + (t - engine.context.currentTime) * 1000;
      const voice = scheduleCleanup(ids[i], barIds[i], startedAt, buffer.duration);
      setVoices((v) => [...v, voice]);
      const stepTimer = window.setTimeout(() => {
        setSequence((prev) => {
          if (!prev.active || prev.voiceIds !== ids) return prev;
          const nextStep = i + 1;
          if (nextStep >= prev.totalSteps) {
            return { ...prev, currentStep: nextStep, active: false };
          }
          return { ...prev, currentStep: nextStep };
        });
      }, Math.max(0, startedAt - performance.now()));
      sequenceStepTimers.current.push(stepTimer);

      const dt = opts.mode === 'expAccelerando'
        ? Math.max(opts.minIntervalMs ?? 20, opts.intervalMs * Math.pow(opts.expFactor ?? 0.93, i))
        : opts.intervalMs;
      t += dt / 1000;
    }
  }, [clearSequenceStepTimers, engine, scheduleCleanup, stopSequence]);

  const stopAll = useCallback(() => {
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
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useAudio = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AudioProvider missing');
  return ctx;
};
