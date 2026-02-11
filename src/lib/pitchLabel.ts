import { chooseHejiFromCents, type HejiRender } from './hejiAccidental';

export type PitchLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type BaseAccidental = '' | '#' | 'b';
export type HejiConfidence = 'exact' | 'approx' | 'fallback';

export type PitchNote = {
  letter: PitchLetter;
  octave: number;
  baseAccidental: BaseAccidental;
  midi: number;
};

export type PitchLabelModel = {
  note: PitchNote;
  hz: number;
  midiFloat: number;
  centsOffset: number;
  heji: HejiRender;
  display: { noteText: string; centsText: string | null };
};

const SAFE_FALLBACK_NOTE: PitchNote = { letter: 'C', octave: 0, baseAccidental: '', midi: 12 };

const SHARP_SPELLINGS: Array<{ letter: PitchLetter; baseAccidental: BaseAccidental }> = [
  { letter: 'C', baseAccidental: '' },
  { letter: 'C', baseAccidental: '#' },
  { letter: 'D', baseAccidental: '' },
  { letter: 'D', baseAccidental: '#' },
  { letter: 'E', baseAccidental: '' },
  { letter: 'F', baseAccidental: '' },
  { letter: 'F', baseAccidental: '#' },
  { letter: 'G', baseAccidental: '' },
  { letter: 'G', baseAccidental: '#' },
  { letter: 'A', baseAccidental: '' },
  { letter: 'A', baseAccidental: '#' },
  { letter: 'B', baseAccidental: '' },
];

const HARMONIC_SCALE_ID = 'harmonic';
const HARMONIC_FIRST_BAR_ID = 'harmonic-001';

export function hzToMidiFloat(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

export function midiToSpelling(midi: number): PitchNote {
  const pitchClass = ((midi % 12) + 12) % 12;
  const base = SHARP_SPELLINGS[pitchClass];
  return {
    ...base,
    midi,
    octave: Math.floor(midi / 12) - 1,
  };
}

export function formatSignedCents(x: number): string {
  const rounded = Math.round(x);
  return `${rounded >= 0 ? '+' : ''}${rounded}c`;
}

export function computeCentsOffset(midiFloat: number, midiBase: number): number {
  return (midiFloat - midiBase) * 100;
}

export function nearestMidiForPitchClass(midiFloat: number, pitchClass: number): number {
  const lowerMidi = Math.floor(midiFloat);
  const upperMidi = Math.ceil(midiFloat);

  let bestMidi = upperMidi;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let candidate = lowerMidi - 12; candidate <= upperMidi + 12; candidate += 1) {
    if ((((candidate % 12) + 12) % 12) !== pitchClass) continue;
    const distance = Math.abs(candidate - midiFloat);
    if (distance < bestDistance || (distance === bestDistance && candidate > bestMidi)) {
      bestMidi = candidate;
      bestDistance = distance;
    }
  }

  return bestMidi;
}

export function getPitchLabelModel(args: { hz: number; scaleId?: string; barId?: string }): PitchLabelModel {
  const { hz, scaleId, barId } = args;

  if (!Number.isFinite(hz) || hz <= 0) {
    return {
      note: SAFE_FALLBACK_NOTE,
      hz,
      midiFloat: Number.NaN,
      centsOffset: 0,
      heji: { diatonic: 0, components: [], glyph: '', residualCents: 0, confidence: 'fallback' },
      display: { noteText: '—', centsText: null },
    };
  }

  const midiFloat = hzToMidiFloat(hz);
  let midiBase = Math.round(midiFloat);

  if (scaleId === HARMONIC_SCALE_ID && barId === HARMONIC_FIRST_BAR_ID) {
    midiBase = nearestMidiForPitchClass(midiFloat, 0);
  }

  const centsOffset = computeCentsOffset(midiFloat, midiBase);
  const note = midiToSpelling(midiBase);
  const heji = chooseHejiFromCents(centsOffset, note.baseAccidental);

  const noteText = `${note.letter}${note.baseAccidental}${note.octave}`;
  const centsText = heji.confidence === 'fallback' || Math.abs(heji.residualCents) > 3
    ? formatSignedCents(centsOffset)
    : null;

  return {
    note,
    hz,
    midiFloat,
    centsOffset,
    heji,
    display: {
      noteText,
      centsText,
    },
  };
}
