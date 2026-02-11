import { factorFrac } from './fraction';
import { getDiatonicGlyph, getPrimeGlyph, type DiatonicAccidental, type HejiPrime, type PrimeDirection, type PrimeMagnitude } from './heji2Mapping';

export type PitchLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type HejiConfidence = 'exact' | 'fallback';

export type PitchNote = {
  letter: PitchLetter;
  octave: number;
  diatonicAccidental: DiatonicAccidental;
  midi: number;
};

export type PrimeGlyphInfo = { prime: HejiPrime; magnitude: PrimeMagnitude; direction: PrimeDirection; glyph: string };

export type PitchLabelModel = {
  note: PitchNote;
  hz: number;
  expectedHz: number;
  midiFloatExpected: number;
  heji: {
    diatonicGlyph: string;
    primeGlyphs: string[];
    primeGlyphInfo: PrimeGlyphInfo[];
    residualCents: number;
    confidence: HejiConfidence;
    ratioPrimeLimit: number;
    unsupportedPrimeFound: boolean;
  };
  display: {
    noteText: string;
    hejiAccidentalText: string;
    centsText: string | null;
  };
};

export const MAX_TOTAL_PRIME_GLYPHS = 4;

const SAFE_FALLBACK_NOTE: PitchNote = { letter: 'C', octave: 0, diatonicAccidental: '', midi: 12 };
const PRIME_ORDER: HejiPrime[] = [5, 7, 11, 13, 17, 19, 23, 29, 31];
const PITCH_CLASS_SPELLINGS: Array<{ letter: PitchLetter; accidental: '' | '#' | 'b' }> = [
  { letter: 'C', accidental: '' },
  { letter: 'C', accidental: '#' },
  { letter: 'D', accidental: '' },
  { letter: 'E', accidental: 'b' },
  { letter: 'E', accidental: '' },
  { letter: 'F', accidental: '' },
  { letter: 'F', accidental: '#' },
  { letter: 'G', accidental: '' },
  { letter: 'G', accidental: '#' },
  { letter: 'A', accidental: '' },
  { letter: 'B', accidental: 'b' },
  { letter: 'B', accidental: '' },
];

const refHzByInstrument = new Map<string, number>();

function ratioToNumber(p: number, q: number): number {
  if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) return 1;
  return p / q;
}

function getRatioPrimeLimit(factors: Map<number, number>): number {
  let max = 3;
  for (const [prime, exp] of factors.entries()) {
    if (prime <= 3 || exp === 0) continue;
    max = Math.max(max, prime);
  }
  return max;
}

function nearestMidiWithPitchClass(midiFloatExpected: number, pitchClass: number): number {
  const lo = Math.floor(midiFloatExpected) - 24;
  const hi = Math.ceil(midiFloatExpected) + 24;
  let best = lo;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let midi = lo; midi <= hi; midi += 1) {
    if ((((midi % 12) + 12) % 12) !== pitchClass) continue;
    const dist = Math.abs(midi - midiFloatExpected);
    if (dist < bestDist || (dist === bestDist && midi > best)) {
      best = midi;
      bestDist = dist;
    }
  }
  return best;
}

export function parseRatio(ratio: string): { p: number; q: number } | null {
  if (typeof ratio !== 'string') return null;
  const trimmed = ratio.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('/');
  if (parts.length !== 2) return null;
  const p = Number.parseInt(parts[0], 10);
  const q = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) return null;
  return { p, q };
}

function pitchClassToSpelling(pc: number): { letter: PitchLetter; accidental: '' | '#' | 'b' } {
  return PITCH_CLASS_SPELLINGS[((pc % 12) + 12) % 12];
}

export function formatSignedCents(x: number): string {
  const rounded = Math.round(x);
  return `${rounded >= 0 ? '+' : ''}${rounded}c`;
}

function chunksForExponent(absExp: number): PrimeMagnitude[] {
  const chunks: PrimeMagnitude[] = [];
  let remaining = absExp;
  while (remaining > 0) {
    const next = Math.min(3, remaining) as PrimeMagnitude;
    chunks.push(next);
    remaining -= next;
  }
  return chunks;
}

export function getPitchLabelModel(args: {
  hz: number;
  ratio_to_step0: string;
  instrumentId?: string;
  refHzStep0?: number;
  scaleId?: string;
  barId?: string;
}): PitchLabelModel {
  const { hz, ratio_to_step0, instrumentId, refHzStep0 } = args;

  if (!Number.isFinite(hz) || hz <= 0) {
    return {
      note: SAFE_FALLBACK_NOTE,
      hz,
      expectedHz: hz,
      midiFloatExpected: Number.NaN,
      heji: {
        diatonicGlyph: '',
        primeGlyphs: [],
        primeGlyphInfo: [],
        residualCents: 0,
        confidence: 'fallback',
        ratioPrimeLimit: 3,
        unsupportedPrimeFound: false,
      },
      display: { noteText: '—', hejiAccidentalText: '', centsText: null },
    };
  }

  const parsedRatio = parseRatio(ratio_to_step0);
  const { p, q } = parsedRatio ?? { p: 1, q: 1 };
  const factors = factorFrac(p, q);
  const midiFloat = 69 + 12 * Math.log2(hz / 440);
  const ratioFloat = parsedRatio ? ratioToNumber(parsedRatio.p, parsedRatio.q) : Number.NaN;
  const semitonesFloat = Number.isFinite(ratioFloat) && ratioFloat > 0 ? 12 * Math.log2(ratioFloat) : Number.NaN;
  const semitonesRounded = Number.isFinite(semitonesFloat) ? Math.round(semitonesFloat) : Number.NaN;
  const pitchClass = Number.isFinite(semitonesRounded)
    ? ((semitonesRounded % 12) + 12) % 12
    : ((Math.round(midiFloat) % 12) + 12) % 12;

  const spelling = pitchClassToSpelling(pitchClass);
  const ratio = ratioToNumber(p, q);
  let step0Ref = refHzStep0;

  if (!step0Ref && instrumentId && refHzByInstrument.has(instrumentId)) {
    step0Ref = refHzByInstrument.get(instrumentId);
  }
  if (!step0Ref || step0Ref <= 0) {
    step0Ref = hz / (ratio || 1);
  }

  if (instrumentId && Number.isFinite(step0Ref) && step0Ref > 0) {
    refHzByInstrument.set(instrumentId, step0Ref);
  }

  const expectedHz = step0Ref * ratio;
  const midiFloatExpected = 69 + 12 * Math.log2(expectedHz / 440);
  const midiBase = nearestMidiWithPitchClass(midiFloat, pitchClass);

  const note: PitchNote = {
    letter: spelling.letter,
    diatonicAccidental: spelling.accidental,
    midi: midiBase,
    octave: Math.floor(midiBase / 12) - 1,
  };

  const diatonicGlyph = getDiatonicGlyph(spelling.accidental);
  const primeGlyphInfo: PrimeGlyphInfo[] = [];
  const primeGlyphs: string[] = [];
  let confidence: HejiConfidence = 'exact';
  let unsupportedPrimeFound = false;

  for (const [prime, exp] of factors.entries()) {
    if (prime <= 3 || exp === 0) continue;
    if (!PRIME_ORDER.includes(prime as HejiPrime)) {
      unsupportedPrimeFound = true;
      confidence = 'fallback';
    }
  }

  for (const prime of PRIME_ORDER) {
    const exp = factors.get(prime) ?? 0;
    if (exp === 0) continue;
    const direction: PrimeDirection = exp > 0 ? 'up' : 'down';
    for (const magnitude of chunksForExponent(Math.abs(exp))) {
      if (primeGlyphInfo.length >= MAX_TOTAL_PRIME_GLYPHS) {
        confidence = 'fallback';
        break;
      }
      const glyph = getPrimeGlyph(prime, magnitude, direction);
      if (!glyph) {
        confidence = 'fallback';
        continue;
      }
      primeGlyphInfo.push({ prime, magnitude, direction, glyph });
      primeGlyphs.push(glyph);
    }
    if (primeGlyphInfo.length >= MAX_TOTAL_PRIME_GLYPHS) break;
  }

  const residualCents = 1200 * Math.log2(hz / expectedHz);
  if (unsupportedPrimeFound) {
    confidence = 'fallback';
  }

  const noteText = `${note.letter}${note.diatonicAccidental}${note.octave}`;
  const hejiAccidentalText = `${diatonicGlyph}${primeGlyphs.join('')}`;
  const centsText = confidence === 'fallback' || Math.abs(residualCents) > 5 ? formatSignedCents(residualCents) : null;

  return {
    note,
    hz,
    expectedHz,
    midiFloatExpected,
    heji: {
      diatonicGlyph,
      primeGlyphs,
      primeGlyphInfo,
      residualCents,
      confidence,
      ratioPrimeLimit: getRatioPrimeLimit(factors),
      unsupportedPrimeFound,
    },
    display: {
      noteText,
      hejiAccidentalText,
      centsText,
    },
  };
}
