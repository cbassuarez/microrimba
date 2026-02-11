import mapping from './heji2_mapping.json';
import type { BaseAccidental, HejiConfidence } from './pitchLabel';

export type Prime = 5 | 7 | 11 | 13 | 17 | 19 | 23 | 29 | 31;

export type PrimeComponent = {
  prime: Prime;
  exp: number;
};

export type HejiRender = {
  diatonic: number;
  components: PrimeComponent[];
  glyph: string;
  residualCents: number;
  confidence: HejiConfidence;
};

type Direction = 'up' | 'down';

type PrimeConfig = {
  ratio: number;
  commaCents: number;
};

const PRIME_COMMAS: Record<Prime, PrimeConfig> = {
  5: { ratio: 81 / 80, commaCents: 1200 * Math.log2(81 / 80) },
  7: { ratio: 64 / 63, commaCents: 1200 * Math.log2(64 / 63) },
  11: { ratio: 33 / 32, commaCents: 1200 * Math.log2(33 / 32) },
  13: { ratio: 27 / 26, commaCents: 1200 * Math.log2(27 / 26) },
  17: { ratio: 2187 / 2176, commaCents: 1200 * Math.log2(2187 / 2176) },
  19: { ratio: 513 / 512, commaCents: 1200 * Math.log2(513 / 512) },
  23: { ratio: 736 / 729, commaCents: 1200 * Math.log2(736 / 729) },
  29: { ratio: 261 / 256, commaCents: 1200 * Math.log2(261 / 256) },
  31: { ratio: 32 / 31, commaCents: 1200 * Math.log2(32 / 31) },
};

const PRIMES_ASC: Prime[] = (Object.keys(mapping.primeComponents)
  .map((key) => Number(key))
  .filter((p): p is Prime => p in PRIME_COMMAS)
  .sort((a, b) => a - b)) as Prime[];

const ALLOWED_EXPONENTS = PRIMES_ASC.map((prime) => {
  const levels = Object.keys(mapping.primeComponents[String(prime)] ?? {})
    .map((key) => Number(key))
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);

  const set = new Set<number>([0]);
  for (const level of levels) {
    set.add(level);
    set.add(-level);
  }

  return {
    prime,
    levels,
    exponents: [...set].sort((a, b) => a - b),
  };
});

function confidenceForResidual(residualCents: number): HejiConfidence {
  const absResidual = Math.abs(residualCents);
  if (absResidual <= 1) return 'exact';
  if (absResidual <= 5) return 'approx';
  return 'fallback';
}

function compareChoice(
  residual: number,
  components: PrimeComponent[],
  best: { residual: number; components: PrimeComponent[] },
): boolean {
  const absResidual = Math.abs(residual);
  const absBest = Math.abs(best.residual);
  if (absResidual !== absBest) return absResidual < absBest;

  if (components.length !== best.components.length) {
    return components.length < best.components.length;
  }

  const expWeight = components.reduce((sum, item) => sum + Math.abs(item.exp), 0);
  const bestWeight = best.components.reduce((sum, item) => sum + Math.abs(item.exp), 0);
  if (expWeight !== bestWeight) return expWeight < bestWeight;

  for (let i = 0; i < Math.max(components.length, best.components.length); i += 1) {
    const a = components[i];
    const b = best.components[i];
    if (!a || !b) break;
    if (a.prime !== b.prime) return a.prime < b.prime;
    if (Math.abs(a.exp) !== Math.abs(b.exp)) return Math.abs(a.exp) < Math.abs(b.exp);
  }

  return false;
}

function chooseComponents(centsOffsetFromBase: number): { components: PrimeComponent[]; residualCents: number } {
  const maxRemaining: number[] = new Array(ALLOWED_EXPONENTS.length + 1).fill(0);
  for (let i = ALLOWED_EXPONENTS.length - 1; i >= 0; i -= 1) {
    const { prime, levels } = ALLOWED_EXPONENTS[i];
    const maxExp = levels[levels.length - 1] ?? 0;
    const cents = Math.abs(maxExp * PRIME_COMMAS[prime].commaCents);
    maxRemaining[i] = maxRemaining[i + 1] + cents;
  }

  const best = {
    residual: Number.POSITIVE_INFINITY,
    components: [] as PrimeComponent[],
  };

  const recurse = (index: number, currentCents: number, components: PrimeComponent[]) => {
    const remainingBound = maxRemaining[index];
    const currentResidual = centsOffsetFromBase - currentCents;
    if (Math.abs(currentResidual) - remainingBound > Math.abs(best.residual)) {
      return;
    }

    if (index >= ALLOWED_EXPONENTS.length) {
      if (compareChoice(currentResidual, components, best)) {
        best.residual = currentResidual;
        best.components = [...components];
      }
      return;
    }

    const primeSpec = ALLOWED_EXPONENTS[index];
    const commaCents = PRIME_COMMAS[primeSpec.prime].commaCents;

    for (const exp of primeSpec.exponents) {
      const nextCents = currentCents + exp * commaCents;
      if (exp !== 0) {
        components.push({ prime: primeSpec.prime, exp });
      }
      recurse(index + 1, nextCents, components);
      if (exp !== 0) components.pop();
    }
  };

  recurse(0, 0, []);

  return {
    components: best.components.sort((a, b) => a.prime - b.prime),
    residualCents: Number.isFinite(best.residual) ? best.residual : centsOffsetFromBase,
  };
}

function diatonicAccidentalToValue(baseAccidental: BaseAccidental): number {
  if (baseAccidental === 'b') return -1;
  if (baseAccidental === '#') return 1;
  return 0;
}

function diatonicGlyph(diatonic: number): string {
  if (diatonic === 0) return '';
  return mapping.diatonicAccidentals[String(diatonic)]?.[0]?.glyph ?? '';
}

function primeGlyph(component: PrimeComponent): string {
  const magnitude = Math.abs(component.exp);
  const direction: Direction = component.exp > 0 ? 'up' : 'down';
  return mapping.primeComponents[String(component.prime)]?.[String(magnitude)]?.[direction]?.[0]?.glyph ?? '';
}

export function chooseHejiFromCents(centsOffsetFromBase: number, baseAccidental: BaseAccidental): HejiRender {
  const diatonic = diatonicAccidentalToValue(baseAccidental);
  const { components, residualCents } = chooseComponents(centsOffsetFromBase);

  let confidence = confidenceForResidual(residualCents);
  const diatonicRendered = diatonicGlyph(diatonic);
  const primeRendered = components
    .map((component) => {
      const glyph = primeGlyph(component);
      if (!glyph) {
        confidence = 'fallback';
      }
      return glyph;
    })
    .join('');

  if (diatonic !== 0 && !diatonicRendered) {
    confidence = 'fallback';
  }

  return {
    diatonic,
    components,
    glyph: `${diatonicRendered}${primeRendered}`,
    residualCents,
    confidence,
  };
}
