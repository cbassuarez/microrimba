import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import hejiMapping from './heji2_mapping.json';
import { chooseHejiFromCents } from './hejiAccidental';
import { getPitchLabelModel } from './pitchLabel';

describe('pitchLabel', () => {
  it('spells A4 correctly at 440 Hz', () => {
    const model = getPitchLabelModel({ hz: 440 });
    expect(model.display.noteText).toBe('A4');
    expect(Math.abs(model.centsOffset)).toBeLessThan(0.01);
  });

  it('uses standard western note text format', () => {
    const values = [110, 220, 261.625565, 329.627557, 415.304698, 880.5];
    for (const hz of values) {
      const model = getPitchLabelModel({ hz });
      expect(model.display.noteText).toMatch(/^[A-G](#|b)?-?\d+$/);
    }
  });

  it('forces harmonic first bar to pitch class C', () => {
    const bars = JSON.parse(readFileSync('data/bars.json', 'utf-8')) as Array<{ barId: string; scaleId: string; hz: number }>;
    const harmonicFirst = bars.find((bar) => bar.scaleId === 'harmonic' && bar.barId === 'harmonic-001');

    expect(harmonicFirst).toBeTruthy();

    const model = getPitchLabelModel({
      hz: harmonicFirst!.hz,
      scaleId: harmonicFirst!.scaleId,
      barId: harmonicFirst!.barId,
    });

    expect(model.note.letter).toBe('C');
    expect(model.note.baseAccidental).toBe('');
  });

  it('never emits arrow characters in pitch labels', () => {
    const values = [261.2, 261.63, 300.1, 440, 442.7, 880.3];
    for (const hz of values) {
      const model = getPitchLabelModel({ hz });
      expect(model.display.noteText).not.toMatch(/[↑↓↗↘]/);
      expect(model.heji.glyph).not.toMatch(/[↑↓↗↘]/);
    }
  });

  it('uses HEJI mapping glyph source (private-use code points) for prime components', () => {
    const fromMapping = hejiMapping.primeComponents['5']['1'].up[0].glyph;
    const heji = chooseHejiFromCents(21.5062895967, '');
    expect(heji.glyph).toContain(fromMapping);
    expect(heji.glyph).toMatch(/[\uE000-\uF8FF]/);
  });
});
