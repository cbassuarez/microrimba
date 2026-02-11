import { useMemo } from 'react';
import { getPitchLabelModel } from '../lib/pitchLabel';

type PitchLabelProps = {
  hz: number;
  scaleId?: string;
  barId?: string;
  variant?: 'list' | 'pad' | 'mini' | 'inline';
  showCents?: boolean;
};

const SIZE_BY_VARIANT: Record<NonNullable<PitchLabelProps['variant']>, string> = {
  list: 'text-sm font-semibold',
  pad: 'text-base font-semibold',
  mini: 'text-sm font-semibold',
  inline: 'text-sm',
};

export function getPitchDisplayStrings(hz: number, scaleId?: string, barId?: string) {
  const model = getPitchLabelModel({ hz, scaleId, barId });

  return {
    notePrimary: model.display.noteText,
    noteLetter: model.note.letter,
    accidentalText: model.note.baseAccidental,
    octaveText: String(model.note.octave),
    hejiGlyph: model.heji.glyph,
    centsText: model.display.centsText,
  };
}

export function PitchLabel({ hz, scaleId, barId, variant = 'list', showCents = true }: PitchLabelProps) {
  const model = useMemo(() => getPitchLabelModel({ hz, scaleId, barId }), [barId, hz, scaleId]);

  if (model.display.noteText === '—') {
    return <span className="font-mono tracking-tight tabular-nums">—</span>;
  }

  return (
    <div className={`flex items-center gap-2 ${variant === 'pad' ? 'flex-wrap' : ''}`}>
      <span className={`font-mono tracking-tight tabular-nums ${SIZE_BY_VARIANT[variant]}`}>
        <span>{model.note.letter}</span>
        <span>{model.note.baseAccidental}</span>
        {model.heji.glyph ? (
          <span className="font-heji-music text-[1.05em] leading-none align-[-0.08em]">{model.heji.glyph}</span>
        ) : null}
        <span>{model.note.octave}</span>
      </span>
      {showCents && model.display.centsText ? (
        <span className="rounded-full border border-rim/50 px-1.5 py-0.5 text-[10px] tabular-nums opacity-75">{model.display.centsText}</span>
      ) : null}
    </div>
  );
}
