import { useEffect, useState } from 'react';

type Props = {
  pageIndex: number;
  pageCount: number;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onJump: (page: number) => void;
};

export function PitchListPaginator({ pageIndex, pageCount, onJump }: Props) {
  const [inputPage, setInputPage] = useState(String(pageIndex + 1));

  useEffect(() => {
    setInputPage(String(pageIndex + 1));
  }, [pageIndex]);

  return (
    <input
      type="number"
      min={1}
      max={pageCount}
      value={inputPage}
      onChange={(event) => setInputPage(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        const parsed = Number(inputPage);
        if (Number.isFinite(parsed)) onJump(parsed);
      }}
      className="h-8 w-12 rounded-lg border border-black/10 bg-white/80 px-1.5 text-center text-xs tabular-nums outline-none dark:border-white/10 dark:bg-black/30"
      aria-label="Jump to page"
    />
  );
}
