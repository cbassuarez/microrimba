import { useMemo } from 'react';
import { getPitchLabelModel } from '../lib/pitchLabel';

type PitchLabelProps = {
  hz: number;
  ratioFrac?: string;
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

export function getPitchDisplayStrings(hz: number, ratioFrac = '1/1', scaleId?: string, barId?: string) {
  const model = getPitchLabelModel({ hz, ratioFrac, scaleId, barId });

  return {
    notePrimary: `${model.note.letter}${model.display.hejiAccidentalText}${model.note.octave}`,
    noteLetter: model.note.letter,
    accidentalText: model.display.hejiAccidentalText,
    octaveText: String(model.note.octave),
    centsText: model.display.centsText,
  };
}

export function PitchLabel({ hz, ratioFrac = '1/1', scaleId, barId, variant = 'list', showCents = true }: PitchLabelProps) {
  const model = useMemo(() => getPitchLabelModel({ hz, ratioFrac, scaleId, barId }), [barId, hz, ratioFrac, scaleId]);

  if (model.display.noteText === '—') {
    return <span className="font-mono tracking-tight tabular-nums">—</span>;
  }

  return (
    <div className={`flex items-center gap-2 ${variant === 'pad' ? 'flex-wrap' : ''}`}>
      <span className={`font-mono tracking-tight tabular-nums ${SIZE_BY_VARIANT[variant]}`}>
        <span>{model.note.letter}</span>
        {model.display.hejiAccidentalText ? (
          <span className="font-smufl text-[1.05em] leading-none align-[-0.08em]">{model.display.hejiAccidentalText}</span>
        ) : null}
        <span>{model.note.octave}</span>
      </span>
      {showCents && model.display.centsText ? (
        <span className="rounded-full border border-rim/50 px-1.5 py-0.5 text-[10px] tabular-nums opacity-75">({model.display.centsText})</span>
      ) : null}
      {import.meta.env.DEV ? (
        <span className="hidden text-[10px] text-slate-500 lg:inline">
          limit: {model.heji.finalLimit} (ratio {model.heji.ratioPrimeLimit}, hz-fit {model.heji.hzPrimeLimit}) · micro: {model.heji.microFrac} · residual: {model.display.centsText ?? '0c'}
        </span>
      ) : null}
    </div>
  );
}
