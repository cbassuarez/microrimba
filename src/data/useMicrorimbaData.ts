import { useEffect, useState } from 'react';
import { loadBars, loadInstruments, loadPitchIndex, loadScales } from './loaders';
import type { Bar, InstrumentsJson, PitchIndexJson, Scale } from './types';

export function useMicrorimbaData() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [pitchIndex, setPitchIndex] = useState<PitchIndexJson | null>(null);
  const [instruments, setInstruments] = useState<InstrumentsJson>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadBars(), loadScales(), loadPitchIndex(), loadInstruments()])
      .then(([nextBars, nextScales, nextPitchIndex, nextInstruments]) => {
        if (!alive) return;
        setBars(nextBars);
        setScales(nextScales);
        setPitchIndex(nextPitchIndex);
        setInstruments(nextInstruments);
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
    instruments,
    error,
    loading: !error && !pitchIndex,
  };
}
