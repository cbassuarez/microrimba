import {
  factorizeInt,
  gcd,
  isSupportedByHeji2Factors,
  maxPrimeFactorFromFactorMap,
  reduceFraction,
} from './primeFactor';

export const HEJI2_ALLOWED_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31] as const;

const cents = (x: number) => 1200 * Math.log2(x);

function mergeFactorMaps(a: Map<number, number>, b: Map<number, number>): Map<number, number> {
  const merged = new Map<number, number>();
  for (const [prime, exp] of a.entries()) merged.set(prime, (merged.get(prime) ?? 0) + exp);
  for (const [prime, exp] of b.entries()) merged.set(prime, (merged.get(prime) ?? 0) + exp);
  return merged;
}

export function isSupportedPrimeFactorization(p: number, q: number): boolean {
  const pFactors = factorizeInt(p);
  const qFactors = factorizeInt(q);
  const merged = mergeFactorMaps(pFactors, qFactors);
  const maxPrime = maxPrimeFactorFromFactorMap(merged);
  return maxPrime <= 31 && isSupportedByHeji2Factors(merged);
}

export function computeRatioPrimeLimit(frac: string): number {
  const [pRaw, qRaw] = frac.split('/').map((value) => Number.parseInt(value.trim(), 10));
  if (!Number.isFinite(pRaw) || !Number.isFinite(qRaw) || qRaw === 0) {
    return 3;
  }
  const reduced = reduceFraction(pRaw, qRaw);
  const factors = mergeFactorMaps(factorizeInt(reduced.p), factorizeInt(reduced.q));
  const limit = maxPrimeFactorFromFactorMap(factors, { ignore: [2, 3] });
  return limit > 0 ? limit : 3;
}

export function bestSimpleFractionConstrained(x: number, maxDen = 64): {
  p: number;
  q: number;
  frac: string;
  approx: number;
  errCents: number;
  ratioPrimeLimit: number;
  ratioSupported: boolean;
} {
  let best: { p: number; q: number; err: number; score: number } = {
    p: 1,
    q: 1,
    err: Number.POSITIVE_INFINITY,
    score: Number.POSITIVE_INFINITY,
  };

  for (let q = 1; q <= maxDen; q += 1) {
    const p0 = Math.max(1, Math.round(x * q));
    for (const pTry of [p0 - 1, p0, p0 + 1]) {
      if (pTry <= 0) continue;
      const reduced = reduceFraction(pTry, q);
      if (!isSupportedPrimeFactorization(reduced.p, reduced.q)) {
        continue;
      }

      const approx = reduced.p / reduced.q;
      const err = cents(x / approx);
      const merged = mergeFactorMaps(factorizeInt(reduced.p), factorizeInt(reduced.q));
      const primeLimitPenalty = maxPrimeFactorFromFactorMap(merged);
      const score = Math.abs(err) + (0.08 * reduced.q) + (0.25 * primeLimitPenalty);
      if (score < best.score) {
        best = { p: reduced.p, q: reduced.q, err, score };
      }
    }
  }

  const ratioPrimeLimit = computeRatioPrimeLimit(`${best.p}/${best.q}`);
  return {
    p: best.p,
    q: best.q,
    frac: `${best.p}/${best.q}`,
    approx: best.p / best.q,
    errCents: best.err,
    ratioPrimeLimit,
    ratioSupported: isSupportedPrimeFactorization(best.p, best.q),
  };
}

export { gcd };
