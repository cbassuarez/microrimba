import mapping from '../assets/heji2_mapping.json';

export type DiatonicAccidental = '' | 'b' | '#' | 'bb' | '##';
export type PrimeDirection = 'up' | 'down';
export type PrimeMagnitude = 1 | 2 | 3;
export type HejiPrime = 5 | 7 | 11 | 13 | 17 | 19 | 23 | 29 | 31;

type GlyphRecord = { glyph: string };
type DirGlyph = { up?: GlyphRecord[]; down?: GlyphRecord[] };

type MappingShape = {
  diatonicAccidentals: Record<string, GlyphRecord[] | DirGlyph>;
  primeComponents: Record<string, Record<string, DirGlyph>>;
};

export const HEJI2Mapping = mapping as MappingShape;

function pickFirstGlyph(value: GlyphRecord[] | DirGlyph | undefined, dir?: PrimeDirection): string {
  if (!value) return '';
  if (Array.isArray(value)) return value[0]?.glyph ?? '';
  if (!dir) return '';
  return value[dir]?.[0]?.glyph ?? '';
}

export function getDiatonicGlyph(acc: DiatonicAccidental): string {
  if (acc === '') return '';
  const dir: PrimeDirection = acc.includes('#') ? 'up' : 'down';
  const count = acc.length as 1 | 2;
  const key = String(count);
  const fromOne = pickFirstGlyph(HEJI2Mapping.diatonicAccidentals[key], dir);
  if (fromOne) return fromOne.repeat(count);

  const fallbackKey = acc === '#' ? '1' : acc === 'b' ? '-1' : acc === '##' ? '2' : '-2';
  return pickFirstGlyph(HEJI2Mapping.diatonicAccidentals[fallbackKey], dir);
}

export function getPrimeGlyph(prime: HejiPrime, mag: PrimeMagnitude, dir: PrimeDirection): string {
  return HEJI2Mapping.primeComponents[String(prime)]?.[String(mag)]?.[dir]?.[0]?.glyph ?? '';
}
