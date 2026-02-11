import rawMapping from './heji2_mapping.json';

export type DiatonicAccidental = '' | 'b' | '#' | 'bb' | '##';
export type PrimeDirection = 'up' | 'down';
export type PrimeMagnitude = 1 | 2 | 3;
export type HejiPrime = 5 | 7 | 11 | 13 | 17 | 19 | 23 | 29 | 31;

type GlyphRecord = { glyph: string };
type MappingShape = {
  diatonicAccidentals: Record<string, GlyphRecord[]>;
  primeComponents: Record<string, Record<string, Record<PrimeDirection, GlyphRecord[]>>>;
};

const mapping = rawMapping as MappingShape;

const DIATONIC_KEY: Record<DiatonicAccidental, string | null> = {
  '': null,
  b: '-1',
  '#': '1',
  bb: '-2',
  '##': '2',
};

export const HEJI2Mapping = mapping;

export function getDiatonicGlyph(acc: DiatonicAccidental): string {
  const key = DIATONIC_KEY[acc];
  if (!key) return '';
  return HEJI2Mapping.diatonicAccidentals[key]?.[0]?.glyph ?? '';
}

export function getPrimeGlyph(prime: number, mag: PrimeMagnitude, dir: PrimeDirection): string | null {
  return HEJI2Mapping.primeComponents[String(prime)]?.[String(mag)]?.[dir]?.[0]?.glyph ?? null;
}
