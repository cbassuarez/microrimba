import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
  pageIndex: number;
  pageCount: number;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onJump: (page: number) => void;
};

export function PitchListPaginator({ pageIndex, pageCount, rangeLabel, onPrev, onNext, onJump }: Props) {
  const [inputPage, setInputPage] = useState(String(pageIndex + 1));

  useEffect(() => {
    setInputPage(String(pageIndex + 1));
  }, [pageIndex]);

  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 z-20 rounded-2xl border border-rim/80 bg-white/75 px-3 py-2 text-xs shadow-glass backdrop-blur-md dark:bg-slate-950/60">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={pageIndex <= 0}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rim bg-white/75 disabled:opacity-40 dark:bg-black/30"
          aria-label="Previous page"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={pageIndex >= pageCount - 1}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rim bg-white/75 disabled:opacity-40 dark:bg-black/30"
          aria-label="Next page"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <div className="whitespace-nowrap text-[11px]">Page {Math.min(pageIndex + 1, pageCount)} of {pageCount}</div>
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
          className="h-7 w-14 rounded-md border border-rim bg-white/80 px-2 text-center text-[11px] outline-none dark:bg-black/30"
          aria-label="Jump to page"
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-600 dark:text-slate-300">{rangeLabel}</div>
    </div>
  );
}
