import { describe, expect, it } from 'vitest';
import { getPitchLabelModel } from './pitchLabel';

describe('heji display invariants', () => {
  it('never emits arrows', () => {
    const model = getPitchLabelModel({ hz: 445.2, ratio_to_step0: '27/20', instrumentId: 'test' });
    const rendered = `${model.heji.diatonicGlyph}${model.heji.primeGlyphs.join('')}`;
    expect(rendered).not.toMatch(/[↑↓↗↘]/);
  });

  it('falls back on unsupported prime limits', () => {
    const model = getPitchLabelModel({ hz: 440, ratio_to_step0: '37/32', instrumentId: 'test' });
    expect(model.heji.confidence).toBe('fallback');
    expect(model.display.centsText).toMatch(/^[+-]\d+c$/);
  });
});
