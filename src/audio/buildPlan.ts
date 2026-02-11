import type { BarId } from '../data/types';
import type { SequenceOpts } from '../lib/sequencer';

export type BuiltPlayPlan = {
  barIds: BarId[];
  durationsByIndex: number[];
};

export function buildPlan(barIds: BarId[], opts: SequenceOpts): BuiltPlayPlan {
  const durationsByIndex = barIds.map((_, i) => {
    const dt = opts.mode === 'expAccelerando'
      ? Math.max(opts.minIntervalMs ?? 20, opts.intervalMs * Math.pow(opts.expFactor ?? 0.93, i))
      : opts.intervalMs;
    return dt / 1000;
  });

  return {
    barIds: [...barIds],
    durationsByIndex,
  };
}
