import { useEffect, useState } from 'react';
import { loadBars, loadPitchIndex, loadScales } from './loaders';
import type { Bar, PitchIndexJson, Scale } from './types';

export function useMicrorimbaData() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [pitchIndex, setPitchIndex] = useState<PitchIndexJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadBars(), loadScales(), loadPitchIndex()])
      .then(([nextBars, nextScales, nextPitchIndex]) => {
        if (!alive) return;
        setBars(nextBars);
        setScales(nextScales);
        setPitchIndex(nextPitchIndex);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      alive = false;
    };
  }, []);

  return {
    bars,
    scales,
    pitchIndex,
    error,
    loading: !error && !pitchIndex,
  };
}
