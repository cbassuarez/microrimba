import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronUp, Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAudio } from '../audio/AudioContextProvider';
import { PitchListPaginator } from '../components/PitchListPaginator';
import { PitchRowDetailsOverlay } from '../components/PitchRowDetailsOverlay';
import { PitchLabel } from '../components/PitchLabel';
import { PitchGridRow } from '../components/pitch/PitchGridRow';
import { PITCH_GRID_COLS_DESKTOP, PITCH_GRID_COLS_MOBILE } from '../components/pitch/pitchGridCols';
import { useMicrorimbaData } from '../data/useMicrorimbaData';
import type { Bar, PitchGroup } from '../data/types';
import { usePagedList } from '../hooks/usePagedList';
import { formatHz } from '../lib/format';
import { getBarsForInstrument, getDefaultInstrumentForScale, getInstrumentMeta } from '../lib/instruments';
import { prettyInstrumentLabel } from '../lib/labels';
import { normalizeFracString } from '../lib/rational';
import { glassHoverMotion } from '../ui/glassHoverMotion';

type ModeKey = 'unique' | 'all';
type TolKey = '5' | '15' | '30';
type PitchRow = { key: string; bar: Bar; cluster: PitchGroup | null; members: Bar[]; absoluteIndex: number };

const SCALE_ACCENTS: Record<string, string> = {
  '5edo': '198 85% 59%',
  '7edo': '168 77% 47%',
  '8edo': '41 93% 61%',
  '9edo': '265 87% 69%',
  harmonic: '338 83% 68%',
};

const ROW_H = 60;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

function barNumber(barId: string) {
  const match = barId.match(/(\d+)$/);
  return match ? String(Number(match[1])) : '—';
}

function ratioForDisplay(bar: Bar): string {
  return normalizeFracString(bar.ratioToStep0 ?? '');
}

function degreeFor(bar: Bar) {
  if (bar.scaleId === 'harmonic') return `H${bar.step + 1}`;
  if (typeof bar.edo !== 'number') return '—';
  return String(((bar.step % bar.edo) + bar.edo) % bar.edo);
}

function formatSignedCents(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}c`;
}

function playOpts(scaleId: string) {
  return scaleId === 'harmonic'
    ? { intervalMs: 240, overlapMs: 0, mode: 'expAccelerando' as const, expFactor: 0.9, minIntervalMs: 45, gain: 0.9 }
    : { intervalMs: 200, overlapMs: 0, mode: 'constant' as const, gain: 0.9 };
}

export function InstrumentProfilePage({
  instrumentId: forcedInstrumentId,
  showModeChips = true,
  forcedMode = null,
}: {
  instrumentId?: string;
  showModeChips?: boolean;
  forcedMode?: ModeKey | null;
}) {
  const { instrumentId: routeInstrumentId } = useParams();
  const instrumentId = forcedInstrumentId ?? routeInstrumentId;
  const reduced = useReducedMotion();
  const isSmOrUp = useMediaQuery('(min-width: 640px)');
  const cols = isSmOrUp ? PITCH_GRID_COLS_DESKTOP : PITCH_GRID_COLS_MOBILE;
  const navigate = useNavigate();
  const { bars, pitchIndex, instruments, loading, error } = useMicrorimbaData();
  const [searchParams] = useSearchParams();
  const { toggleBar, stopAll, playingBarIds, playSequenceByBarIds } = useAudio();

  const [mode, setMode] = useState<ModeKey>(() => {
    if (forcedMode) return forcedMode;
    return (searchParams.get('mode') as ModeKey) === 'all' ? 'all' : 'unique';
  });
  const [tolerance] = useState<TolKey>('5');
  const [openDetailsKey, setOpenDetailsKey] = useState<string | null>(null);
  const [pageDirection, setPageDirection] = useState(0);
  const [measureDebug, setMeasureDebug] = useState({ viewport: 0, header: 0, pager: 0, row: ROW_H, rowsPerPage: 4 });

  const listSurfaceRef = useRef<HTMLDivElement>(null);
  const listViewportRef = useRef<HTMLDivElement>(null);
  const listHeaderRef = useRef<HTMLDivElement>(null);
  const paginatorRef = useRef<HTMLDivElement>(null);
  const rowAnchorRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!forcedMode) return;
    setMode(forcedMode);
  }, [forcedMode]);

  const barById = useMemo(() => new Map(bars.map((bar) => [bar.barId, bar])), [bars]);
  const meta = useMemo(() => getInstrumentMeta(instruments, instrumentId ?? ''), [instruments, instrumentId]);
  const barsForInstrument = useMemo(() => getBarsForInstrument(bars, instrumentId ?? '').sort((a, b) => a.hz - b.hz || a.barId.localeCompare(b.barId)), [bars, instrumentId]);

  const rows = useMemo<PitchRow[]>(() => {
    if (!pitchIndex) return [];
    if (mode === 'all') {
      return barsForInstrument.map((bar, index) => ({ key: `${bar.barId}-all`, bar, cluster: null, members: [bar], absoluteIndex: index }));
    }

    const clusters = pitchIndex.clustersByTolerance[tolerance] ?? [];
    const scopedRows: PitchRow[] = [];
    for (const cluster of clusters) {
      const members = cluster.members.map((id) => barById.get(id)).filter((entry): entry is Bar => Boolean(entry));
      const instrumentMembers = members.filter((entry) => entry.instrumentId === instrumentId);
      if (!instrumentMembers.length) continue;
      const rep = barById.get(cluster.repBarId) ?? instrumentMembers[0];
      scopedRows.push({ key: `u-${cluster.groupId}`, bar: rep, cluster, members: instrumentMembers, absoluteIndex: scopedRows.length });
    }
    return scopedRows;
  }, [barById, barsForInstrument, instrumentId, mode, pitchIndex, tolerance]);

  const paged = usePagedList<PitchRow>({
    items: rows,
    rowHeightPx: ROW_H,
    minRows: 4,
    maxRows: 40,
    viewportRef: listViewportRef,
    stickyHeaderRef: listHeaderRef,
    paginatorRef,
    getAnchorKey: (row) => row.key,
    onMeasure: setMeasureDebug,
  });

  const openRow = useMemo(() => paged.pageItems.find((row) => row.key === openDetailsKey) ?? null, [openDetailsKey, paged.pageItems]);

  if (loading) return <p>Loading…</p>;
  if (error || !pitchIndex) return <p>{error ?? 'Failed to load instrument profile.'}</p>;

  if (!meta || !instrumentId) {
    const byScale = instruments.reduce<Record<string, typeof instruments>>((acc, item) => {
      acc[item.scaleId] = acc[item.scaleId] ? [...acc[item.scaleId], item] : [item];
      return acc;
    }, {});
    return (
      <section className="glass-panel glass-rim p-6">
        <h1 className="text-2xl font-semibold">Instrument not found</h1>
        <p className="mt-2 text-sm opacity-80">Try one of the available instrument profiles:</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(byScale).map(([scaleId, items]) => (
            <div key={scaleId} className="rounded-2xl border border-rim p-4">
              <div className="text-xs uppercase opacity-70">{scaleId}</div>
              <div className="mt-2 space-y-1">
                {items.map((item) => (
                  <Link key={item.instrumentId} className="block text-sm underline" to={`/instrument/${item.instrumentId}`}>{item.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const stepSizeLabel = meta.edo === 'harmonic' ? 'partials (harmonic series)' : `step size ≈ ${(1200 / meta.edo).toFixed(1)}¢`;
  const tint = SCALE_ACCENTS[meta.scaleId] ?? '220 10% 50%';

  const playInOrder = async () => {
    await playSequenceByBarIds(meta.barIdsInOrder, playOpts(meta.scaleId));
  };

  const stepNext = () => {
    setPageDirection(1);
    paged.nextPage();
  };
  const stepPrev = () => {
    setPageDirection(-1);
    paged.prevPage();
  };

  const cardsByScale = instruments.reduce<Record<string, typeof instruments>>((acc, item) => {
    const group = typeof item.edo === 'number' ? 'EDO' : (item.edo === 'harmonic' || item.scaleId === 'harmonic' ? 'Harmonic' : item.scaleId);
    acc[group] = acc[group] ? [...acc[group], item] : [item];
    return acc;
  }, {});
  const cardGroups = [
    ['EDO', cardsByScale.EDO ?? []],
    ['Harmonic', cardsByScale.Harmonic ?? []],
  ] as const;

  return (
    <div className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-6 pb-8">
      <section className="sticky top-20 z-20 rounded-3xl border border-rim bg-surface/90 p-5 shadow-glass backdrop-blur-xl" style={{ boxShadow: `inset 0 1px 0 hsla(${tint}, 0.35)` }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold sm:text-3xl">{meta.label}</h1>
            <p className="mt-1 text-sm opacity-85">Measured pitches, conservatively displayed. This tuning profile summarizes playable bars, pitch relationships, and listening-first comparisons.</p>
            <div className="mt-2 text-xs opacity-75">{barsForInstrument.length} bars • {stepSizeLabel} • measured Hz</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-full border border-rim px-3 py-1 text-xs" onClick={() => void playInOrder()}><Play className="mr-1 inline h-3.5 w-3.5" />Play scale in order</button>
            <button className="rounded-full border border-rim px-3 py-1 text-xs" onClick={stopAll}><Square className="mr-1 inline h-3.5 w-3.5" />Stop all</button>
            {showModeChips && (
              <>
                <button className={`rounded-full border px-3 py-1 text-xs ${mode === 'unique' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'border-rim'}`} onClick={() => setMode('unique')}>Unique</button>
                <button className={`rounded-full border px-3 py-1 text-xs ${mode === 'all' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'border-rim'}`} onClick={() => setMode('all')}>All</button>
              </>
            )}
            <Link className="rounded-full border border-rim px-3 py-1 text-xs" to={`/?instrument=${encodeURIComponent(instrumentId)}&mode=${mode}`}>Open global pitch list</Link>
          </div>
        </div>
      </section>

      <section className="glass-panel glass-rim p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Instrument Pads</h2>
          <button className="rounded-full border border-rim px-3 py-1 text-xs" onClick={() => void playSequenceByBarIds((mode === 'all' ? barsForInstrument : rows.map((row) => row.members[0])).map((bar) => bar.barId), { intervalMs: 90, overlapMs: 55, mode: 'constant', gain: 0.8 })}>Play sweep</button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {(mode === 'all' ? barsForInstrument : rows.map((row) => row.members[0])).map((bar) => (
            <motion.button
              key={bar.barId}
              onClick={() => void toggleBar(bar.barId)}
              className="group relative will-change-transform rounded-md border border-rim p-3 text-left shadow-sm"
              style={{ background: `linear-gradient(180deg, hsla(${SCALE_ACCENTS[bar.scaleId] ?? '220 8% 60%'}, 0.38), hsla(${SCALE_ACCENTS[bar.scaleId] ?? '220 8% 60%'}, 0.16))` }}
              whileHover={reduced ? undefined : glassHoverMotion.whileHover}
              whileTap={reduced ? undefined : glassHoverMotion.whileTap}
              transition={reduced ? undefined : glassHoverMotion.transition}
            >
              <span className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-white/10 opacity-0 blur-xl transition-opacity duration-200 group-hover:opacity-100 dark:bg-white/5" />
              <div className="relative z-10">
                <PitchLabel hz={bar.hz} ratio={bar.ratioToStep0} instrumentId={bar.instrumentId} scaleId={bar.scaleId} barId={bar.barId} variant="pad" />
                <div className="text-xs font-medium opacity-90">{formatHz(bar.hz).text} Hz</div>
                <div className="mt-1 text-xs opacity-80">{degreeFor(bar)}</div>
                {playingBarIds.has(bar.barId) && <Volume2 className="absolute right-2 top-2 h-4 w-4 text-emerald-500" />}
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="glass-panel glass-rim flex min-h-0 flex-1 flex-col p-4">
        <h2 className="mb-3 text-xl font-semibold">In this instrument</h2>
        <div ref={listSurfaceRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-rim/70 bg-white/45 dark:bg-slate-900/25">
          <div ref={listViewportRef} className="flex min-h-0 flex-1 flex-col px-2 pt-2">
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain">
              <div className="w-max">
                <div ref={listHeaderRef}>
                  <PitchGridRow variant="header" cols={cols} className="sticky top-0 z-10 border-b border-rim bg-white/70 py-3 text-xs uppercase tracking-wide backdrop-blur dark:bg-slate-900/70">
                    <div className="text-left justify-self-start">Index</div><div className="text-left justify-self-start">Pitch</div><div className="text-left justify-self-center">Play</div><div className="tabular-nums text-right justify-self-end">Hz</div><div className="text-left justify-self-start">Instrument</div><div className="tabular-nums text-right justify-self-end">Bar #</div><div className="text-left justify-self-start">Scale</div><div className="tabular-nums text-right justify-self-end">Degree</div><div className="tabular-nums text-right justify-self-end">Ratio</div><div className="text-left justify-self-center">More</div>
                  </PitchGridRow>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={`instrument-page-${paged.pageIndex}`} initial={reduced ? { opacity: 0 } : { opacity: 0, y: pageDirection >= 0 ? 14 : -14 }} animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: pageDirection >= 0 ? -14 : 14 }} transition={{ duration: 0.2 }}>
                    {paged.pageItems.map((row) => (
                      <div key={row.key} ref={(element) => { if (!element) rowAnchorRefs.current.delete(row.key); else rowAnchorRefs.current.set(row.key, element); }} className="my-1 rounded-2xl border border-rim/80 bg-white/40 py-0.5 dark:bg-slate-900/30" style={{ borderColor: `hsla(${SCALE_ACCENTS[row.bar.scaleId] ?? '220 10% 50%'}, 0.32)`, minHeight: `${ROW_H}px` }}>
                        <PitchGridRow variant="row" cols={cols} className="h-[60px] text-sm">
                          <div className="tabular-nums text-right justify-self-end">{row.absoluteIndex + 1}</div>
                          <div className="min-w-0 text-left justify-self-start"><PitchLabel hz={row.bar.hz} ratio={row.bar.ratioToStep0} instrumentId={row.bar.instrumentId} scaleId={row.bar.scaleId} barId={row.bar.barId} variant="list" /></div>
                          <div className="justify-self-center"><button onClick={() => void toggleBar(row.members[0].barId)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rim">{playingBarIds.has(row.members[0].barId) ? <Volume2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button></div>
                          <div className="tabular-nums text-right justify-self-end">{formatHz(row.bar.hz).text}</div>
                          <div className="min-w-0 truncate text-left justify-self-start">{meta.label}</div>
                          <div className="tabular-nums text-right justify-self-end">{barNumber(row.members[0].barId)}</div>
                          <div className="text-left justify-self-start uppercase">{row.bar.scaleId}</div>
                          <div className="tabular-nums text-right justify-self-end">{degreeFor(row.members[0])}</div>
                          <div className="min-w-0 truncate font-mono text-xs tabular-nums text-right justify-self-end">{Math.abs(row.members[0].ratioErrorCents) >= 1 ? '≈ ' : ''}{ratioForDisplay(row.members[0])}</div>
                          <div className="justify-self-center"><button className="opacity-70" onClick={() => setOpenDetailsKey((prev) => (prev === row.key ? null : row.key))}><ChevronDown className={`h-4 w-4 ${openDetailsKey === row.key ? 'rotate-180' : ''}`} /></button></div>
                        </PitchGridRow>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div ref={paginatorRef} className="pointer-events-auto mt-2 flex items-center justify-end">
              <div className="rounded-2xl border border-black/10 bg-white/55 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-black/30">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button onClick={stepPrev} disabled={paged.pageIndex <= 0} className="inline-flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-40" aria-label="Previous page"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={stepNext} disabled={paged.pageIndex >= paged.pageCount - 1} className="inline-flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-40" aria-label="Next page"><ChevronDown className="h-4 w-4" /></button>
                  <div className="text-sm tabular-nums">Page {Math.min(paged.pageIndex + 1, paged.pageCount)}/{paged.pageCount}</div>
                  <PitchListPaginator pageIndex={paged.pageIndex} pageCount={paged.pageCount} rangeLabel={paged.rangeLabel} onPrev={stepPrev} onNext={stepNext} onJump={(page) => paged.setPageIndex(page - 1)} />
                </div>
              </div>
            </div>
          </div>

          {import.meta.env.DEV && (
            <div className="pointer-events-none absolute right-3 top-3 z-30 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-white">
              viewport:{Math.round(measureDebug.viewport)} header:{Math.round(measureDebug.header)} pager:{Math.round(measureDebug.pager)} row:{Math.round(measureDebug.row)} rowsPerPage:{measureDebug.rowsPerPage}
            </div>
          )}

          <PitchRowDetailsOverlay
            openRow={openRow}
            containerRef={listSurfaceRef}
            anchorEl={openDetailsKey ? (rowAnchorRefs.current.get(openDetailsKey) ?? null) : null}
            tolerance={tolerance}
            ratioForDisplay={ratioForDisplay}
            formatSignedCents={formatSignedCents}
            instrumentLabel={(bar) => prettyInstrumentLabel(bar.scaleId, bar.instrumentId, bar.edo)}
            barNumber={barNumber}
            onPlayBar={async (barId) => void toggleBar(barId)}
            onClose={() => setOpenDetailsKey(null)}
          />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="glass-panel glass-rim p-4"><h3 className="text-sm uppercase opacity-70">Tuning</h3><p className="mt-2 text-sm">{meta.scaleId === 'harmonic' ? 'Harmonic bars follow partial numbers of one series.' : `${meta.edo}-EDO divides the octave into equal steps for consistent melodic motion.`}</p></article>
        <article className="glass-panel glass-rim p-4"><h3 className="text-sm uppercase opacity-70">Measurement</h3><p className="mt-2 text-sm">Pitch values are analysis-derived from recordings and displayed with conservative precision.</p></article>
        <article className="glass-panel glass-rim p-4"><h3 className="text-sm uppercase opacity-70">Ratios</h3><p className="mt-2 text-sm">EDO entries use quantized fractions with error cents; harmonic entries show exact partial ratios from 1/1.</p></article>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Other instruments</h2>
        {cardGroups.map(([groupName, items]) => (
          items.length ? (
            <div key={groupName} className="space-y-2">
              <h3 className="text-sm uppercase opacity-70">{groupName}</h3>
              <div className="grid items-stretch gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                {items.map((item) => (
                  <motion.article
                    key={item.instrumentId}
                    className="glass-panel glass-rim group relative h-full p-4 will-change-transform"
                    style={{ borderColor: `hsla(${SCALE_ACCENTS[item.scaleId] ?? '220 10% 50%'}, 0.5)` }}
                    whileHover={reduced ? undefined : glassHoverMotion.whileHover}
                    whileTap={reduced ? undefined : glassHoverMotion.whileTap}
                    transition={reduced ? undefined : glassHoverMotion.transition}
                  >
                    <span className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-white/10 opacity-0 blur-xl transition-opacity duration-200 group-hover:opacity-100 dark:bg-white/5" />
                    <div className="relative z-10">
                      <button className="w-full text-left" onClick={() => navigate(`/instrument/${item.instrumentId}`)}>
                        <div className="font-semibold">{item.label}</div>
                        <div className="mt-1 text-xs opacity-75">{item.barIdsInOrder.length} bars</div>
                      </button>
                      <button className="mt-3 rounded-full border border-rim px-3 py-1 text-xs" onClick={() => void playSequenceByBarIds(item.barIdsInOrder, playOpts(item.scaleId))}>Play</button>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          ) : null
        ))}
      </section>
    </div>
  );
}

export function ScaleInstrumentProfilePage() {
  const { scaleId } = useParams();
  const { instruments } = useMicrorimbaData();

  if (!scaleId) return <InstrumentProfilePage showModeChips={false} forcedMode="all" />;
  const instrumentId = getDefaultInstrumentForScale(instruments, scaleId);
  return <InstrumentProfilePage instrumentId={instrumentId ?? undefined} showModeChips={false} forcedMode="all" />;
}
