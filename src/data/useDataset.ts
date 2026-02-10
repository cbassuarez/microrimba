import { useEffect, useState } from 'react';
import { loadBars, loadPitchIndex, loadScales } from './loaders';
import type { Bar, PitchIndexJson, Scale } from './types';

export function useDataset() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [pitchIndex, setPitchIndex] = useState<PitchIndexJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadBars(), loadScales(), loadPitchIndex()])
      .then(([b, s, p]) => {
        setBars(b);
        setScales(s);
        setPitchIndex(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return { bars, scales, pitchIndex, error, loading: !pitchIndex && !error };
}
