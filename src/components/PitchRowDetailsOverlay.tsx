import { AnimatePresence, motion } from 'framer-motion';
import type { RefObject } from 'react';
import { Play, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Bar, PitchGroup } from '../data/types';
import { formatHz } from '../lib/format';
import { formatSignedCents, getPitchLabelModel } from '../lib/pitchLabel';

type PitchRowItem = {
  key: string;
  bar: Bar;
  cluster: PitchGroup | null;
  members: Bar[];
};

type Props = {
  openRow: PitchRowItem | null;
  containerRef: RefObject<HTMLElement | null>;
  anchorEl: HTMLElement | null;
  tolerance: string;
  ratioForDisplay: (bar: Bar) => string;
  formatSignedCents: (value: number) => string;
  instrumentLabel: (bar: Bar) => string;
  barNumber: (barId: string) => string;
  onPlayBar: (barId: string) => void;
  onClose: () => void;
};

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function PitchRowDetailsOverlay({
  openRow,
  containerRef,
  anchorEl,
  tolerance,
  ratioForDisplay,
  formatSignedCents,
  instrumentLabel,
  barNumber,
  onPlayBar,
  onClose,
}: Props) {
  const isMobile = useMedia('(max-width: 640px)');
  const [desktopPos, setDesktopPos] = useState({ top: 0, left: 16, width: 720 });

  useEffect(() => {
    if (!openRow) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, openRow]);

  useEffect(() => {
    if (!openRow || isMobile || !anchorEl || !containerRef.current) return;

    const updatePos = () => {
      const anchorRect = anchorEl.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      setDesktopPos({
        top: anchorRect.bottom - containerRect.top + 6,
        left: Math.max(12, anchorRect.left - containerRect.left + 20),
        width: Math.min(containerRect.width - 24, 820),
      });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    return () => window.removeEventListener('resize', updatePos);
  }, [anchorEl, containerRef, isMobile, openRow]);

  const content = useMemo(() => {
    if (!openRow) return null;

    const debugHeji = import.meta.env.DEV
      ? getPitchLabelModel({
          hz: openRow.bar.hz,
          scaleId: openRow.bar.scaleId,
          barId: openRow.bar.barId,
          ratio_to_step0: openRow.bar.ratioToStep0,
          instrumentId: openRow.bar.instrumentId,
        })
      : null;

    return (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <div>bar_id: <span className="font-mono">{openRow.bar.barId}</span></div>
          <div>step_name: {openRow.bar.stepName}</div>
          <div>cents_from_step0: {openRow.bar.centsFromStep0}</div>
          <div>ratio_to_step0: <span className="font-mono tabular-nums">{ratioForDisplay(openRow.bar)}</span></div>
          <div>Ratio error: <span className="font-mono">{formatSignedCents(openRow.bar.ratioErrorCents)}</span></div>
          <div title={`raw: ${openRow.bar.hz}`}>raw Hz: <span className="font-mono">{openRow.bar.hz}</span></div>
        </div>
        {openRow.cluster && (
          <div className="border-t border-rim pt-2">Tolerance ±{tolerance}c · members {openRow.cluster.stats.count} · max spread {openRow.cluster.stats.maxCentsSpread.toFixed(2)} cents</div>
        )}
        {import.meta.env.DEV && debugHeji ? (
          <div className="rounded border border-rim/60 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300">
            ratio-limit: {debugHeji.heji.ratioPrimeLimit} · residual: {formatSignedCents(debugHeji.heji.residualCents)}
          </div>
        ) : null}

        {openRow.cluster && (
          <div className="space-y-1 pl-4">
            {openRow.members.map((member) => (
              <div key={member.barId} className="grid min-w-0 grid-cols-[40px_90px_1fr_80px_100px_1fr] items-center gap-2">
                <button onClick={() => onPlayBar(member.barId)} className="rounded border border-rim p-1"><Play className="h-3 w-3" /></button>
                <span>{formatHz(member.hz).text}</span>
                <span>{instrumentLabel(member)}</span>
                <span>{barNumber(member.barId)}</span>
                <span className="uppercase">{member.scaleId}</span>
                <span className="font-mono tabular-nums">{Math.abs(member.ratioErrorCents) >= 1 ? '≈ ' : ''}{ratioForDisplay(member)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [barNumber, formatSignedCents, instrumentLabel, onPlayBar, openRow, ratioForDisplay, tolerance]);

  return (
    <AnimatePresence>
      {openRow && (
        <>
          <motion.button
            type="button"
            className="absolute inset-0 z-20 bg-transparent"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close details"
          />
          {isMobile ? (
            <motion.section
              className="absolute inset-x-2 bottom-2 z-30 rounded-2xl border border-rim bg-white/90 p-3 shadow-glass backdrop-blur dark:bg-slate-950/85"
              role="dialog"
              aria-modal="true"
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Row details</h3>
                <button onClick={onClose} className="rounded-full border border-rim p-1"><X className="h-4 w-4" /></button>
              </div>
              {content}
            </motion.section>
          ) : (
            <motion.section
              className="absolute z-30 rounded-2xl border border-rim bg-white/90 p-3 shadow-glass backdrop-blur dark:bg-slate-950/80"
              style={{ top: desktopPos.top, left: desktopPos.left, width: desktopPos.width }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
            >
              {content}
            </motion.section>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
