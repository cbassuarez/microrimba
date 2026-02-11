import { describe, expect, it } from 'vitest';
import { buildPlan } from './buildPlan';
import type { BarId } from '../data/types';

describe('buildPlan', () => {
  const opts = { intervalMs: 200, overlapMs: 0, mode: 'constant' } as const;

  it('preserves requested barIds for each call', () => {
    const first = buildPlan(['A', 'B', 'C'] as BarId[], opts);
    const second = buildPlan(['X', 'Y'] as BarId[], opts);

    expect(first.barIds).toEqual(['A', 'B', 'C']);
    expect(second.barIds).toEqual(['X', 'Y']);
    expect(second.barIds).not.toEqual(first.barIds);
  });

  it('computes durations from opts', () => {
    const expPlan = buildPlan(['A', 'B', 'C'] as BarId[], {
      intervalMs: 220,
      overlapMs: 0,
      mode: 'expAccelerando',
      expFactor: 0.9,
      minIntervalMs: 25,
    });

    expect(expPlan.durationsByIndex[0]).toBeCloseTo(0.22);
    expect(expPlan.durationsByIndex[1]).toBeCloseTo(0.198);
    expect(expPlan.durationsByIndex[2]).toBeCloseTo(0.1782);
  });
});
