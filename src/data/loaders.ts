import { assetUrl } from '../lib/assetUrl';
import type { Bar, PitchIndexJson, Scale } from './types';

const cache = new Map<string, Promise<unknown>>();

const loadJson = <T,>(path: string): Promise<T> => {
  const url = assetUrl(path);
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

export const loadBars = () => loadJson<Bar[]>('data/bars.json');
export const loadScales = () => loadJson<Scale[]>('data/scales.json');
export const loadPitchIndex = () => loadJson<PitchIndexJson>('data/pitch_index.json');
