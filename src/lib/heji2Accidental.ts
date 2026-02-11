import { getDiatonicGlyph, getPrimeGlyph, type DiatonicAccidental } from './heji2Mapping';
import {
  factorizeInt,
  maxPrimeFactorFromFactorMap,
  reduceFraction,
} from './primeFactor';
import { computeRatioPrimeLimit, HEJI2_ALLOWED_PRIMES } from './ratioQuantize';

export type Heji2Confidence = 'exact' | 'approx' | 'fallback';

type BestMicro = {
  p: number;
  q: number;
  frac: string;
  errCents: number;
  pFactors: Map<number, number>;
  qFactors: Map<number, number>;
};

export type Heji2AccidentalResult = {
  diatonicGlyph: string;
  primeGlyphs: string[];
  microFrac: string;
  residualCents: number;
  confidence: Heji2Confidence;
  finalLimit: number;
  ratioPrimeLimit: number;
  hzPrimeLimit: number;
};

const cents = (x: number) => 1200 * Math.log2(x);

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function isAllowedPrime(prime: number, limit: number): boolean {
  return HEJI2_ALLOWED_PRIMES.includes(prime as (typeof HEJI2_ALLOWED_PRIMES)[number]) && prime <= limit;
}

export function computeHzMicroRatio(hz: number, midiBase: number): number {
  const baseHz = 440 * 2 ** ((midiBase - 69) / 12);
  return hz / baseHz;
}

export function bestMicroFractionConstrained(microRatio: number, limit: number, maxDen = 64): BestMicro {
  let best: BestMicro = {
    p: 1,
    q: 1,
    frac: '1/1',
    errCents: Number.POSITIVE_INFINITY,
    pFactors: factorizeInt(1),
    qFactors: factorizeInt(1),
  };

  for (let q = 1; q <= maxDen; q += 1) {
    const p0 = Math.max(1, Math.round(microRatio * q));
    for (const pTry of [p0 - 1, p0, p0 + 1]) {
      if (pTry <= 0) continue;
      const reduced = reduceFraction(pTry, q);
      const pFactors = factorizeInt(reduced.p);
      const qFactors = factorizeInt(reduced.q);

      let supported = true;
      for (const prime of [...pFactors.keys(), ...qFactors.keys()]) {
        if (!isAllowedPrime(prime, limit)) {
          supported = false;
          break;
        }
      }
      if (!supported) continue;

      const approx = reduced.p / reduced.q;
      const errCents = cents(microRatio / approx);
      const score = Math.abs(errCents) + 0.08 * reduced.q;

      const currentBestScore = Math.abs(best.errCents) + 0.08 * best.q;
      if (score < currentBestScore) {
        best = {
          p: reduced.p,
          q: reduced.q,
          frac: `${reduced.p}/${reduced.q}`,
          errCents,
          pFactors,
          qFactors,
        };
      }
    }
  }

  return best;
}

export function computeHzPrimeLimit(microRatio: number): { hzPrimeLimit: number; bestByLimit: Record<number, BestMicro> } {
  const limits = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
  const bestByLimit: Record<number, BestMicro> = {};

  for (const limit of limits) {
    const best = bestMicroFractionConstrained(microRatio, limit);
    bestByLimit[limit] = best;
    if (Math.abs(best.errCents) <= 5) {
      return { hzPrimeLimit: limit, bestByLimit };
    }
  }

  return { hzPrimeLimit: 31, bestByLimit };
}

export function computeFinalLimit({ ratioPrimeLimit, hzPrimeLimit }: { ratioPrimeLimit: number; hzPrimeLimit: number }): number {
  return clamp(Math.max(ratioPrimeLimit, hzPrimeLimit), 3, 31);
}

function subtractFactors(num: Map<number, number>, den: Map<number, number>): Map<number, number> {
  const merged = new Map<number, number>();
  for (const [prime, exp] of num.entries()) merged.set(prime, (merged.get(prime) ?? 0) + exp);
  for (const [prime, exp] of den.entries()) merged.set(prime, (merged.get(prime) ?? 0) - exp);
  return merged;
}

export function renderHeji2Accidental({
  hz,
  midiBase,
  diatonicAccidental,
  ratioFrac,
}: {
  hz: number;
  midiBase: number;
  diatonicAccidental: DiatonicAccidental;
  ratioFrac: string;
}): Heji2AccidentalResult {
  const microRatio = computeHzMicroRatio(hz, midiBase);
  const ratioPrimeLimit = computeRatioPrimeLimit(ratioFrac);
  const { hzPrimeLimit } = computeHzPrimeLimit(microRatio);
  const ratioOverLimit = ratioPrimeLimit > 31;
  const finalLimit = ratioOverLimit ? clamp(hzPrimeLimit, 3, 31) : computeFinalLimit({ ratioPrimeLimit, hzPrimeLimit });
  const best = bestMicroFractionConstrained(microRatio, finalLimit);

  const exponentMap = subtractFactors(best.pFactors, best.qFactors);
  const primeGlyphs: string[] = [];
  let forcedFallback = ratioOverLimit;

  for (const prime of [5, 7, 11, 13, 17, 19, 23, 29, 31] as const) {
    if (prime > finalLimit) continue;
    const exponent = exponentMap.get(prime) ?? 0;
    if (exponent === 0) continue;
    const magnitude = Math.abs(exponent);
    if (magnitude > 3) {
      forcedFallback = true;
      continue;
    }
    const glyph = getPrimeGlyph(prime, magnitude as 1 | 2 | 3, exponent > 0 ? 'up' : 'down');
    if (!glyph) {
      forcedFallback = true;
      continue;
    }
    primeGlyphs.push(glyph);
  }

  const diatonicGlyph = getDiatonicGlyph(diatonicAccidental);
  if (diatonicAccidental !== '' && !diatonicGlyph) {
    forcedFallback = true;
  }

  const residualCents = cents(microRatio / (best.p / best.q));
  let confidence: Heji2Confidence = Math.abs(residualCents) <= 1 ? 'exact' : Math.abs(residualCents) <= 5 ? 'approx' : 'fallback';
  if (forcedFallback) {
    confidence = 'fallback';
  }

  return {
    diatonicGlyph,
    primeGlyphs,
    microFrac: best.frac,
    residualCents,
    confidence,
    finalLimit,
    ratioPrimeLimit,
    hzPrimeLimit,
  };
}

export { computeRatioPrimeLimit };
