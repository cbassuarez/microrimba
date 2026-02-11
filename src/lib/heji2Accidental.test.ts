import { describe, expect, it } from 'vitest';
import { getPrimeGlyph } from './heji2Mapping';
import { renderHeji2Accidental } from './heji2Accidental';
import { getPitchLabelModel } from './pitchLabel';

describe('heji2 accidental', () => {
  it('does not render arrow characters', () => {
    const sample = renderHeji2Accidental({
      hz: 445.2,
      midiBase: 69,
      diatonicAccidental: '',
      ratioFrac: '27/20',
    });

    const rendered = `${sample.diatonicGlyph}${sample.primeGlyphs.join('')}`;
    expect(rendered).not.toMatch(/[↑↓↗↘]/);
  });

  it('filters prime glyphs by final limit', () => {
    const sample = renderHeji2Accidental({
      hz: 440,
      midiBase: 69,
      diatonicAccidental: '',
      ratioFrac: '7/4',
    });

    const glyph11Up = getPrimeGlyph(11, 1, 'up');
    expect(sample.finalLimit).toBeLessThanOrEqual(7);
    if (glyph11Up) {
      expect(sample.primeGlyphs).not.toContain(glyph11Up);
    }
  });

  it('chooses max rule for final limit', () => {
    const sample = renderHeji2Accidental({
      hz: 440,
      midiBase: 69,
      diatonicAccidental: '',
      ratioFrac: '11/8',
    });

    expect(sample.ratioPrimeLimit).toBe(11);
    expect(sample.finalLimit).toBeGreaterThanOrEqual(11);
  });

  it('falls back with cents indicator when residual exceeds threshold', () => {
    const model = getPitchLabelModel({ hz: 440, ratioFrac: '37/32' });
    expect(model.heji.confidence).toBe('fallback');
    expect(model.display.centsText).toMatch(/^[+-]\d+c$/);
  });
});
