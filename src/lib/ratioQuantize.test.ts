import { describe, expect, it } from 'vitest';
import { bestSimpleFractionConstrained } from './ratioQuantize';

describe('ratio quantization', () => {
  it('returns fractions with supported prime factors only', () => {
    const best = bestSimpleFractionConstrained(1.47, 64);
    expect(best.ratioSupported).toBe(true);
    const [p, q] = best.frac.split('/').map(Number);
    expect(p).toBeGreaterThan(0);
    expect(q).toBeGreaterThan(0);
  });

  it('never emits a ratio containing unsupported prime 53', () => {
    const best = bestSimpleFractionConstrained(53 / 36, 64);
    expect(best.frac).not.toContain('53');
  });
});
