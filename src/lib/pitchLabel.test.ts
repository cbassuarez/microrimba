import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chooseHejiAccidental } from './heji';
import { getPitchLabelModel } from './pitchLabel';

describe('pitchLabel', () => {
  it('spells A4 correctly at 440 Hz', () => {
    const model = getPitchLabelModel({ hz: 440 });
    expect(model.display.noteText).toBe('A4');
    expect(Math.abs(model.centsOffset)).toBeLessThan(0.01);
  });

  it('spells C4 near 261.625565 Hz', () => {
    const model = getPitchLabelModel({ hz: 261.625565 });
    expect(model.display.noteText).toBe('C4');
    expect(Math.abs(model.centsOffset)).toBeLessThan(0.1);
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
    expect(Math.abs(model.centsOffset)).toBeLessThan(50);
  });

  it('chooses expected HEJI candidates', () => {
    expect(chooseHejiAccidental(0).name).toBe('natural');
    expect(chooseHejiAccidental(24).name).toBe('arrowUp');
    expect(chooseHejiAccidental(-24).name).toBe('arrowDown');
    expect(chooseHejiAccidental(49).name).toBe('quarterSharp');
    expect(chooseHejiAccidental(10).confidence).toBe('fallback');
  });
});
