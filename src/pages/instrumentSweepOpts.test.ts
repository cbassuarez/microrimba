import { describe, expect, it } from 'vitest';
import type { SequenceOpts } from '../lib/sequencer';
import { getSweepOptsForInstrument } from './instrumentSweepOpts';

describe('getSweepOptsForInstrument', () => {
  const baseOpts: SequenceOpts = { intervalMs: 90, overlapMs: 55, mode: 'constant', gain: 0.8 };

  it('uses fast comb-gliss preset for harmonic instrument page', () => {
    const opts = getSweepOptsForInstrument('harmonic', baseOpts);

    expect(opts.intervalMs).toBe(14);
    expect(opts.overlapMs).toBe(110);
    expect(opts.mode).toBe('constant');
    expect(opts.gain).toBe(0.35);
  });

  it('keeps base sweep opts unchanged for non-harmonic instruments', () => {
    const opts = getSweepOptsForInstrument('5edo', baseOpts);

    expect(opts).toBe(baseOpts);
  });
});
