import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadBars } from '../data/loaders';
import type { BarId } from '../data/types';

type Voice = { id: string; barId: BarId; startedAt: number; stop: () => void };

type AudioApi = {
  voices: Voice[];
  playingBarIds: Set<BarId>;
  canPlay: (barId: BarId) => boolean;
  playBar: (barId: BarId) => Promise<void>;
  stopBar: (barId: BarId) => void;
  toggleBar: (barId: BarId) => Promise<void>;
  stopVoice: (id: string) => void;
  stopAll: () => void;
};

const Ctx = createContext<AudioApi | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [pathByBar, setPathByBar] = useState<Record<string, string>>({});
  const audioByVoiceId = useMemo(() => new Map<string, HTMLAudioElement>(), []);

  useEffect(() => {
    loadBars().then((bars) => setPathByBar(Object.fromEntries(bars.map((b) => [b.barId, b.audioPath]))));
  }, []);

  const stopVoice = useCallback(
    (id: string) => {
      const el = audioByVoiceId.get(id);
      if (el) {
        el.pause();
        el.currentTime = 0;
        audioByVoiceId.delete(id);
      }
      setVoices((v) => v.filter((x) => x.id !== id));
    },
    [audioByVoiceId],
  );

  const stopBar = useCallback(
    (barId: BarId) => {
      const toStop = voices.filter((v) => v.barId === barId).map((v) => v.id);
      toStop.forEach(stopVoice);
    },
    [stopVoice, voices],
  );

  const playBar = useCallback(
    async (barId: BarId) => {
      const path = pathByBar[barId];
      if (!path) return;

      const id = `${barId}-${crypto.randomUUID()}`;
      const src = `${import.meta.env.BASE_URL}${path}`;
      const audio = new Audio(src);
      audio.volume = 1;
      audioByVoiceId.set(id, audio);

      const voice: Voice = {
        id,
        barId,
        startedAt: performance.now(),
        stop: () => {
          audio.pause();
          audio.currentTime = 0;
        },
      };

      const clear = () => {
        audioByVoiceId.delete(id);
        setVoices((v) => v.filter((x) => x.id !== id));
      };

      audio.onended = clear;
      audio.onerror = clear;
      setVoices((v) => [...v, voice]);

      try {
        await audio.play();
      } catch {
        clear();
      }
    },
    [audioByVoiceId, pathByBar],
  );

  const stopAll = useCallback(() => {
    [...audioByVoiceId.keys()].forEach((id) => stopVoice(id));
  }, [audioByVoiceId, stopVoice]);

  const toggleBar = useCallback(
    async (barId: BarId) => {
      const isPlaying = voices.some((v) => v.barId === barId);
      if (isPlaying) stopBar(barId);
      else await playBar(barId);
    },
    [playBar, stopBar, voices],
  );

  const api: AudioApi = {
    voices,
    playingBarIds: new Set(voices.map((v) => v.barId)),
    canPlay: (barId) => Boolean(pathByBar[barId]),
    playBar,
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
