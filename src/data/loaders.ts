import type { Bar, PitchIndexJson, Scale } from './types';

const cache = new Map<string, Promise<unknown>>();

const loadJson = <T,>(url: string): Promise<T> => {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then(async (res) => {
        if (!res.ok) throw new Error(`Failed loading ${url}: ${res.status}`);
        return res.json();
      }),
    );
  }
  return cache.get(url) as Promise<T>;
};

export const loadBars = () => loadJson<Bar[]>(`${import.meta.env.BASE_URL}data/bars.json`);
export const loadScales = () => loadJson<Scale[]>(`${import.meta.env.BASE_URL}data/scales.json`);
export const loadPitchIndex = () => loadJson<PitchIndexJson>(`${import.meta.env.BASE_URL}data/pitch_index.json`);
