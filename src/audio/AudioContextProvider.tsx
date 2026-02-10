import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './AudioEngine';
import { loadBars } from '../data/loaders';
import type { BarId } from '../data/types';
import { playSequence, type SequenceOpts } from '../lib/sequencer';

type Voice = { id: string; barId: BarId; startedAt: number; stop: () => void };

type AudioApi = {
  voices: Voice[];
  playingBarIds: Set<BarId>;
  canPlay: (barId: BarId) => boolean;
  playBar: (barId: BarId) => Promise<void>;
  playSequenceByBarIds: (barIds: BarId[], opts: SequenceOpts) => Promise<void>;
  stopBar: (barId: BarId) => void;
  toggleBar: (barId: BarId) => Promise<void>;
  stopVoice: (id: string) => void;
  stopAll: () => void;
};

const Ctx = createContext<AudioApi | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(() => new AudioEngine(), []);
  const [voices, setVoices] = useState<Voice[]>([]);
  const endTimers = useRef(new Map<string, number>());

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
      engine.stopAll();
    };
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

  const playSequenceByBarIds = useCallback(async (barIds: BarId[], opts: SequenceOpts) => {
    if (!barIds.length) return;
    await engine.ensureUnlocked();
    const startAt = engine.context.currentTime + 0.03;
    const startedNow = performance.now();
    const ids = await playSequence(engine, barIds, opts);

    let t = startAt;
    for (let i = 0; i < barIds.length; i += 1) {
      const buffer = await engine.getBuffer(barIds[i]);
      const startedAt = startedNow + (t - engine.context.currentTime) * 1000;
      const voice = scheduleCleanup(ids[i], barIds[i], startedAt, buffer.duration);
      setVoices((v) => [...v, voice]);
      const dt = opts.mode === 'expAccelerando'
        ? Math.max(opts.minIntervalMs ?? 20, opts.intervalMs * Math.pow(opts.expFactor ?? 0.93, i))
        : opts.intervalMs;
      t += dt / 1000;
    }
  }, [engine, scheduleCleanup]);

  const stopAll = useCallback(() => {
    endTimers.current.forEach((timer) => window.clearTimeout(timer));
    endTimers.current.clear();
    engine.stopAll();
    setVoices([]);
  }, [engine]);

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
    canPlay: (barId) => engine.canPlay(barId),
    playBar,
    playSequenceByBarIds,
    stopBar,
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
