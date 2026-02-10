import { useEffect, useState } from 'react';
import { loadBars, loadInstruments, loadPitchIndex, loadScales } from './loaders';
import type { Bar, InstrumentsJson, PitchIndexJson, Scale } from './types';

export function useDataset() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [pitchIndex, setPitchIndex] = useState<PitchIndexJson | null>(null);
  const [instruments, setInstruments] = useState<InstrumentsJson>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadBars(), loadScales(), loadPitchIndex(), loadInstruments()])
      .then(([b, s, p, i]) => {
        setBars(b);
        setScales(s);
        setPitchIndex(p);
        setInstruments(i);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return { bars, scales, pitchIndex, instruments, error, loading: !pitchIndex && !error };
}
