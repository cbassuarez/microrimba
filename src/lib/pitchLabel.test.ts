import { describe, expect, it } from 'vitest';
import { MAX_TOTAL_PRIME_GLYPHS, getPitchLabelModel } from './pitchLabel';

describe('pitchLabel ratio-driven HEJI', () => {
  it('no arrows invariant', () => {
    const ratios = ['1/1', '27/25', '49/32', '81/80', '1024/675'];
    for (const ratio of ratios) {
      const model = getPitchLabelModel({ hz: 440, ratio_to_step0: ratio, instrumentId: 'test' });
      const rendered = `${model.heji.diatonicGlyph}${model.heji.primeGlyphs.join('')}`;
      expect(rendered).not.toContain('↑');
      expect(rendered).not.toContain('↓');
    }
  });

  it('ratio 1/1 has no prime glyphs and starts on C', () => {
    const model = getPitchLabelModel({ hz: 261.625565, ratio_to_step0: '1/1', instrumentId: 'harmonic' });
    expect(model.heji.primeGlyphs).toHaveLength(0);
    expect(model.heji.diatonicGlyph).toBe('');
    expect(model.display.noteText.startsWith('C')).toBe(true);
  });

  it('ratio 27/25 only renders prime-5 components', () => {
    const model = getPitchLabelModel({ hz: 440, ratio_to_step0: '27/25', instrumentId: 'test' });
    expect(model.heji.primeGlyphInfo.length).toBeGreaterThan(0);
    expect(model.heji.primeGlyphInfo.every((info) => info.prime === 5)).toBe(true);
    expect(model.heji.primeGlyphInfo.every((info) => info.direction === 'down')).toBe(true);
    expect(model.heji.primeGlyphInfo.some((info) => info.magnitude === 2)).toBe(true);
  });

  it('caps total prime glyphs and falls back', () => {
    const model = getPitchLabelModel({ hz: 440, ratio_to_step0: '390625/16807', instrumentId: 'test' }); // 5^8 / 7^5
    expect(model.heji.primeGlyphs.length).toBeLessThanOrEqual(MAX_TOTAL_PRIME_GLYPHS);
    expect(model.heji.confidence).toBe('fallback');
  });
});
