import type { HejiAccidental, HejiConfidence } from './pitchLabel';

type HejiCandidate = {
  name: 'natural' | 'arrowUp' | 'arrowDown' | 'quarterSharp' | 'quarterFlat';
  targetCents: number;
};

const CANDIDATES: HejiCandidate[] = [
  { name: 'natural', targetCents: 0 },
  { name: 'arrowUp', targetCents: 25 },
  { name: 'arrowDown', targetCents: -25 },
  { name: 'quarterSharp', targetCents: 50 },
  { name: 'quarterFlat', targetCents: -50 },
];

const glyphOverrides = new Map<HejiCandidate['name'], string>();

export function setHejiGlyph(name: HejiCandidate['name'], glyph: string) {
  glyphOverrides.set(name, glyph);
}

export function getHejiGlyph(name: HejiCandidate['name']): string {
  const override = glyphOverrides.get(name);
  if (override) return override;

  switch (name) {
    case 'natural':
      return '';
    case 'arrowUp':
      return '↑';
    case 'arrowDown':
      return '↓';
    case 'quarterSharp':
      return '𝄲';
    case 'quarterFlat':
      return '𝄳';
    default:
      return '';
  }
}

function confidenceForResidual(residualCents: number): HejiConfidence {
  const absResidual = Math.abs(residualCents);
  if (absResidual <= 1) return 'exact';
  if (absResidual <= 5) return 'approx';
  return 'fallback';
}

export function chooseHejiAccidental(centsOffset: number): HejiAccidental {
  const best = CANDIDATES.reduce((currentBest, candidate) => {
    const currentDistance = Math.abs(centsOffset - currentBest.targetCents);
    const nextDistance = Math.abs(centsOffset - candidate.targetCents);
    return nextDistance < currentDistance ? candidate : currentBest;
  }, CANDIDATES[0]);

  const residualCents = centsOffset - best.targetCents;

  return {
    glyph: getHejiGlyph(best.name),
    name: best.name,
    approxCents: best.targetCents,
    residualCents,
    confidence: confidenceForResidual(residualCents),
  };
}
