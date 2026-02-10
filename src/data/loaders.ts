import type { Bar, PitchIndexJson, Scale } from './types';

const cache = new Map<string, Promise<unknown>>();

const loadJson = <T,>(path: string): Promise<T> => {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(path).then(async (res) => {
        if (!res.ok) throw new Error(`Failed loading ${path}: ${res.status}`);
        return res.json();
      }),
    );
  }
  return cache.get(path) as Promise<T>;
};

export const loadBars = () => loadJson<Bar[]>('data/bars.json');
export const loadScales = () => loadJson<Scale[]>('data/scales.json');
export const loadPitchIndex = () => loadJson<PitchIndexJson>('data/pitch_index.json');
