import type { SequenceOpts } from '../lib/sequencer';

const HARMONIC_SWEEP_PRESET: SequenceOpts = { intervalMs: 14, overlapMs: 110, mode: 'constant', gain: 0.35 };

export function getSweepOptsForInstrument(instrumentId: string, baseOpts: SequenceOpts): SequenceOpts {
  return instrumentId === 'harmonic' ? HARMONIC_SWEEP_PRESET : baseOpts;
}
