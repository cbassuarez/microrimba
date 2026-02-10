import type { PropsWithChildren } from 'react';

type PitchGridRowProps = PropsWithChildren<{
  variant: 'header' | 'row';
  cols: string;
  className?: string;
}>;

export function PitchGridRow({ variant, cols, className, children }: PitchGridRowProps) {
  return (
    <div
      className={`grid items-center gap-x-3 px-3 whitespace-nowrap sm:gap-x-4 sm:px-4 ${variant === 'header' ? 'select-none' : ''} ${className ?? ''}`}
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}
