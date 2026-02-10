import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AudioEngine, type Voice } from './AudioEngine';
import { loadBars } from '../data/loaders';
import type { BarId } from '../data/types';

type AudioApi = {
  voices: Voice[];
  playingBarIds: Set<BarId>;
  canPlay: (barId: BarId) => boolean;
  playBar: (barId: BarId) => Promise<void>;
  stopVoice: (id: string) => void;
  stopAll: () => void;
};

const Ctx = createContext<AudioApi | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(() => new AudioEngine(), []);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [pathByBar, setPathByBar] = useState<Record<string, string>>({});

  useEffect(() => {
    loadBars().then((bars) => setPathByBar(Object.fromEntries(bars.map((b) => [b.barId, b.audioPath]))));
  }, []);

  const api: AudioApi = {
    voices,
    playingBarIds: new Set(voices.map((v) => v.barId)),
    canPlay: (barId) => Boolean(pathByBar[barId]),
    playBar: async (barId) => {
      const path = pathByBar[barId];
      if (!path) return console.warn(`audio missing for ${barId}`);
      try {
        const voice = await engine.play(path, barId);
        setVoices((v) => [...v, voice]);
        setTimeout(() => setVoices((v) => v.filter((x) => x.id !== voice.id)), (voice.duration ?? 1) * 1000 + 300);
      } catch (error) {
        console.warn(error);
      }
    },
    stopVoice: (id) => setVoices((v) => {
      const voice = v.find((x) => x.id === id);
      voice?.stop();
      return v.filter((x) => x.id !== id);
    }),
    stopAll: () => setVoices((v) => {
      v.forEach((voice) => voice.stop());
      return [];
    }),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useAudio = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AudioProvider missing');
  return ctx;
};
