import { describe, expect, it } from 'vitest';
import { getPitchLabelModel } from './pitchLabel';

describe('pitchLabel', () => {
  it('spells A4 correctly at 440 Hz', () => {
    const model = getPitchLabelModel({ hz: 440, ratioFrac: '1/1' });
    expect(model.display.noteText).toBe('A4');
    expect(Math.abs(model.centsOffset)).toBeLessThan(0.01);
  });

  it('uses standard western note text format', () => {
    const values = [110, 220, 261.625565, 329.627557, 415.304698, 880.5];
    for (const hz of values) {
      const model = getPitchLabelModel({ hz, ratioFrac: '1/1' });
      expect(model.display.noteText).toMatch(/^[A-G]-?\d+$/);
    }
  });

  it('forces harmonic first bar to pitch class C', () => {
    const model = getPitchLabelModel({
      hz: 261.625565,
      ratioFrac: '1/1',
      scaleId: 'harmonic',
      barId: 'harmonic-001',
    });

    expect(model.note.letter).toBe('C');
    expect(model.note.diatonicAccidental).toBe('');
  });
});
