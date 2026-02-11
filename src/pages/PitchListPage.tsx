import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Filter,
  Moon,
  Play,
  Search,
  Square,
  Sun,
  Volume2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAudio } from '../audio/AudioContextProvider';
import { PitchListPaginator } from '../components/PitchListPaginator';
import { PitchGridRow } from '../components/pitch/PitchGridRow';
import { PitchRowDetailsOverlay } from '../components/PitchRowDetailsOverlay';
import { useMicrorimbaData } from '../data/useMicrorimbaData';
import type { Bar, PitchGroup, ScaleId } from '../data/types';
import { usePagedList } from '../hooks/usePagedList';
import { prettyInstrumentLabel } from '../lib/labels';
import { formatHz } from '../lib/format';
import { normalizeFracString } from '../lib/rational';
import { setTheme, type ThemeMode } from '../ui/theme';
import { PITCH_GRID_COLS_DESKTOP, PITCH_GRID_COLS_MOBILE } from '../components/pitch/pitchGridCols';
import { PitchLabel } from '../components/PitchLabel';

type TolKey = '5' | '15' | '30';
type ModeKey = 'unique' | 'all';

type PitchRow = {
  key: string;
  bar: Bar;
  cluster: PitchGroup | null;
  members: Bar[];
  absoluteIndex: number;
};

const SCALE_IDS: ScaleId[] = ['5edo', '7edo', '8edo', '9edo', 'harmonic'];
const SCALE_DESCRIPTIONS: Record<string, string> = {
  '5edo': 'Wide pentatonic interval lattice with bold spacing.',
  '7edo': 'Compact seven-step temperament with bright turns.',
  '8edo': 'Balanced octave weave for angular melodies.',
  '9edo': 'Nine-step grid, gentle asymmetry and floating center.',
  harmonic: 'Ratio-driven harmonic chain with natural color shifts.',
};
const SCALE_ACCENTS: Record<string, string> = {
  '5edo': '198 85% 59%',
  '7edo': '168 77% 47%',
  '8edo': '41 93% 61%',
  '9edo': '265 87% 69%',
  harmonic: '338 83% 68%',
};

function barNumber(barId: string) {
  const match = barId.match(/(\d+)$/);
  return match ? String(Number(match[1])) : '—';
}

function degreeFor(bar: Bar) {
  if (typeof bar.edo !== 'number') return '—';
  return String(((bar.step % bar.edo) + bar.edo) % bar.edo);
}

function instrumentLabel(bar: Bar) {
  return prettyInstrumentLabel(bar.scaleId, bar.instrumentId, bar.edo);
}

function ratioForDisplay(bar: Bar): string {
  return normalizeFracString(bar.ratioToStep0 ?? '');
}

function formatSignedCents(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}c`;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

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

export function PitchListPage() {
  const reduced = useReducedMotion();
  const isSmOrUp = useMediaQuery('(min-width: 640px)');
  const cols = isSmOrUp ? PITCH_GRID_COLS_DESKTOP : PITCH_GRID_COLS_MOBILE;
  const { bars, scales, pitchIndex, loading, error } = useMicrorimbaData();
  const { toggleBar, stopAll, playingBarIds, playSequenceByBarIds, sequence } = useAudio();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialInstrument = searchParams.get('instrument');

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ModeKey>((searchParams.get('mode') as ModeKey) === 'all' ? 'all' : 'unique');
  const [tolerance, setTolerance] = useState<TolKey>((['5', '15', '30'] as TolKey[]).includes(searchParams.get('tol') as TolKey) ? (searchParams.get('tol') as TolKey) : '5');
  const [showGroupingMenu, setShowGroupingMenu] = useState(false);
  const [selectedScales, setSelectedScales] = useState<Set<string>>(new Set(SCALE_IDS));
  const [selectedInstruments, setSelectedInstruments] = useState<Set<string>>(new Set(initialInstrument ? [initialInstrument] : ['composite']));
  const [theme, setThemeState] = useState<ThemeMode>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  const [openDetailsKey, setOpenDetailsKey] = useState<string | null>(null);
  const [pageDirection, setPageDirection] = useState(0);
  const [followSequence, setFollowSequence] = useState(false);

  const listSurfaceRef = useRef<HTMLDivElement>(null);
  const listViewportRef = useRef<HTMLDivElement>(null);
  const headerRowRef = useRef<HTMLDivElement>(null);
  const paginatorRef = useRef<HTMLDivElement>(null);
  const wheelThrottleRef = useRef(0);
  const followSequenceRef = useRef(false);
  const rowAnchorRefs = useRef(new Map<string, HTMLDivElement>());

  const barById = useMemo(() => new Map(bars.map((bar) => [bar.barId, bar])), [bars]);
  const instruments = useMemo(() => [...new Set(bars.map((bar) => bar.instrumentId))].sort(), [bars]);
  const instrumentLabels = useMemo(
    () =>
      new Map(
        instruments.map((instrumentId) => {
          const bar = bars.find((entry) => entry.instrumentId === instrumentId);
          return [instrumentId, prettyInstrumentLabel(bar?.scaleId ?? '', instrumentId, bar?.edo)];
        }),
      ),
    [bars, instruments],
  );

  const clusters = useMemo(() => (pitchIndex ? pitchIndex.clustersByTolerance[tolerance] : []), [pitchIndex, tolerance]);

  const filteredBar = (bar?: Bar) => {
    if (!bar) return false;
    if (!selectedScales.has(bar.scaleId)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [bar.barId, bar.instrumentId, bar.scaleId].some((v) => v.toLowerCase().includes(q));
  };

  const allVisible = useMemo(() => {
    if (!pitchIndex) return [] as Bar[];
    return pitchIndex.allBarsSorted.map((id) => barById.get(id)).filter((bar): bar is Bar => filteredBar(bar));
  }, [pitchIndex, barById, query, selectedScales]);

  const uniqueVisible = useMemo(() => {
    return clusters
      .map((cluster) => {
        const rep = barById.get(cluster.repBarId);
        if (!filteredBar(rep)) return null;
        const members = cluster.members.map((id) => barById.get(id)).filter((bar): bar is Bar => Boolean(bar));
        return { cluster, rep, members };
      })
      .filter((item): item is { cluster: PitchGroup; rep: Bar; members: Bar[] } => Boolean(item));
  }, [clusters, barById, query, selectedScales]);

  const visibleRows = useMemo<PitchRow[]>(() => {
    const rows = mode === 'all'
      ? allVisible.map((bar, absoluteIndex) => ({ key: bar.barId, bar, cluster: null as PitchGroup | null, members: [bar], absoluteIndex }))
      : uniqueVisible.map((item, absoluteIndex) => ({ key: item.rep.barId, bar: item.rep, cluster: item.cluster, members: item.members, absoluteIndex }));
    return rows;
  }, [allVisible, mode, uniqueVisible]);

  const keyByAnyBarId = useMemo(() => {
    const map = new Map<string, string>();
    visibleRows.forEach((row) => {
      map.set(row.bar.barId, row.key);
      row.members.forEach((member) => map.set(member.barId, row.key));
    });
    return map;
  }, [visibleRows]);

  const initialPage = Math.max(1, Number(searchParams.get('page') ?? '1')) - 1;

  const rowHeightPx = isSmOrUp ? 60 : 56;
  const [measureDebug, setMeasureDebug] = useState({ viewport: 0, header: 0, pager: 0, row: rowHeightPx, rowsPerPage: 6 });

  const paged = usePagedList<PitchRow>({
    items: visibleRows,
    rowHeightPx,
    minRows: 6,
    maxRows: 40,
    viewportRef: listViewportRef,
    stickyHeaderRef: headerRowRef,
    paginatorRef,
    getAnchorKey: (item) => item.key,
    initialPage,
    onMeasure: setMeasureDebug,
  });

  const openRow = useMemo(() => paged.pageItems.find((item) => item.key === openDetailsKey) ?? null, [openDetailsKey, paged.pageItems]);

  const padBars = useMemo(() => {
    if (mode === 'all') return allVisible;
    return uniqueVisible.map((item) => item.rep);
  }, [allVisible, mode, uniqueVisible]);

  const padsFilteredByInstrument = useMemo(() => {
    const allowComposite = selectedInstruments.has('composite');
    if (allowComposite) return padBars;
    return padBars.filter((bar) => selectedInstruments.has(bar.instrumentId));
  }, [padBars, selectedInstruments]);

  const scalesById = useMemo(() => new Map(scales.map((s) => [s.scaleId, s])), [scales]);

  const motionProps = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: 'easeOut' as const } };

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('mode', mode);
    next.set('tol', tolerance);
    next.set('page', String(Math.min(paged.pageCount, paged.pageIndex + 1)));
    setSearchParams(next, { replace: true });
  }, [mode, tolerance, paged.pageCount, paged.pageIndex, searchParams, setSearchParams]);

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'all' || modeParam === 'unique') setMode(modeParam);
    const tolParam = searchParams.get('tol') as TolKey;
    if ((['5', '15', '30'] as TolKey[]).includes(tolParam)) setTolerance(tolParam);
    const instrumentParam = searchParams.get('instrument');
    if (instrumentParam && bars.some((bar) => bar.instrumentId === instrumentParam)) {
      setSelectedInstruments(new Set([instrumentParam]));
    }
  }, [bars, searchParams]);

  const ensureItemVisible = (barId: string) => {
    const key = keyByAnyBarId.get(barId);
    if (!key) return;
    const index = visibleRows.findIndex((row) => row.key === key);
    if (index < 0) return;
    paged.setPageIndex(Math.floor(index / Math.max(1, paged.rowsPerPage)));
  };

  const setSequenceFollow = (next: boolean) => {
    followSequenceRef.current = next;
    setFollowSequence(next);
  };

  useEffect(() => {
    if (!followSequence || !sequence.active || sequence.barIds.length === 0) return;
    const clampedStep = Math.min(Math.max(sequence.currentStep, 0), sequence.barIds.length - 1);
    const currentBarId = sequence.barIds[clampedStep];
    if (!currentBarId) return;
    const key = keyByAnyBarId.get(currentBarId);
    if (!key) return;
    const index = visibleRows.findIndex((row) => row.key === key);
    if (index < 0) return;
    const targetPage = Math.floor(index / Math.max(1, paged.rowsPerPage));
    if (targetPage !== paged.pageIndex) {
      setPageDirection(targetPage > paged.pageIndex ? 1 : -1);
      paged.setPageIndex(targetPage);
    }
  }, [followSequence, keyByAnyBarId, paged, sequence.active, sequence.barIds, sequence.currentStep, visibleRows]);

  useEffect(() => {
    if (!sequence.active && followSequenceRef.current) {
      setSequenceFollow(false);
    }
  }, [sequence.active]);

  const playBarWithPaging = async (barId: string) => {
    ensureItemVisible(barId);
    await toggleBar(barId);
  };

  const jumpWithDirection = (nextPage: number) => {
    setSequenceFollow(false);
    const clamped = Math.min(Math.max(nextPage, 0), paged.pageCount - 1);
    setPageDirection(clamped > paged.pageIndex ? 1 : clamped < paged.pageIndex ? -1 : 0);
    paged.setPageIndex(clamped);
  };

  const stopAllWithFollowReset = () => {
    setSequenceFollow(false);
    stopAll();
  };

  const stepPrev = () => jumpWithDirection(paged.pageIndex - 1);
  const stepNext = () => jumpWithDirection(paged.pageIndex + 1);

  if (loading) {
    return <section className="glass-panel glass-rim p-8 text-lg">Loading the resonator library…</section>;
  }

  if (error || !pitchIndex) {
    return (
      <section className="glass-panel glass-rim p-8 text-rose-500">
        Data failed to load: {error ?? 'unknown error'}
      </section>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-6 font-condensed">
      <motion.section className="glass-panel glass-rim p-6 md:p-8" {...motionProps}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">VIEWER</p>
            <h1 className="mt-1 text-4xl font-semibold md:text-5xl">Microtonal Marimba Instruments</h1>
            <p className="mt-3 max-w-2xl text-base text-slate-700 dark:text-slate-200">CalArts recently got some microtonal marimbas, and we measured and recorded the bars as a pitch set. View all pitches in a table, hear a whole-set gliss, or listen to the overtone marimba glissando (ooh, ahh).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-full border border-rim bg-white/60 px-4 py-2 text-sm shadow-sm dark:bg-black/20" onClick={() => {
              setSequenceFollow(true);
              void playSequenceByBarIds(uniqueVisible.map((row) => row.rep.barId), { intervalMs: 55, overlapMs: 0, mode: 'constant', gain: 0.9 }, { name: 'Play All (Unique)' });
            }}> <Play className="mr-1 inline h-4 w-4" /> Play All </button>
            <button className="rounded-full border border-rim px-4 py-2 text-sm" onClick={stopAllWithFollowReset}><Square className="mr-1 inline h-4 w-4" /> Stop All</button>
            <button className="rounded-full border border-rim px-3 py-2 text-sm" onClick={() => setShowGroupingMenu((v) => !v)}><Filter className="h-4 w-4" /></button>
            <button
              className="rounded-full border border-rim px-3 py-2 text-sm"
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                setTheme(next);
                setThemeState(next);
              }}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <label className="flex items-center gap-2 rounded-full border border-rim px-3 py-2 text-sm">
              <Search className="h-4 w-4" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-52 bg-transparent outline-none" placeholder="Search bar / instrument / scale" />
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SCALE_IDS.map((scaleId) => {
            const active = selectedScales.has(scaleId);
            return (
              <button
                key={scaleId}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${active ? 'border-transparent text-white shadow-md' : 'border-rim text-slate-700 dark:text-slate-200'}`}
                style={active ? { backgroundColor: `hsl(${SCALE_ACCENTS[scaleId] ?? '220 10% 50%'})` } : undefined}
                onClick={() => {
                  paged.setAnchorByKey(paged.pageItems[0]?.key ?? '');
                  const next = new Set(selectedScales);
                  if (active) next.delete(scaleId);
                  else next.add(scaleId);
                  setSelectedScales(next.size ? next : new Set(SCALE_IDS));
                }}
              >
                {scaleId}
              </button>
            );
          })}
        </div>
        <AnimatePresence>
          {showGroupingMenu && (
            <motion.div className="mt-4 rounded-2xl border border-rim bg-white/55 p-4 text-sm dark:bg-black/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="space-x-2">
                  <button className={`rounded-full border px-3 py-1 ${mode === 'unique' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => {
                    paged.setAnchorByKey(paged.pageItems[0]?.key ?? '');
                    setMode('unique');
                  }}>Unique</button>
                  <button className={`rounded-full border px-3 py-1 ${mode === 'all' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => {
                    paged.setAnchorByKey(paged.pageItems[0]?.key ?? '');
                    setMode('all');
                  }}>All bars</button>
                </div>
                <div className="space-x-2">
                  {(['5', '15', '30'] as TolKey[]).map((tol) => (
                    <button key={tol} className={`rounded-full border px-3 py-1 ${tolerance === tol ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => {
                      paged.setAnchorByKey(paged.pageItems[0]?.key ?? '');
                      setTolerance(tol);
                    }}>±{tol}c</button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <motion.section className="glass-panel glass-rim flex min-h-0 flex-1 flex-col p-4 [--pitch-row-h:56px] sm:[--pitch-row-h:60px]" {...motionProps}>
        <div
          ref={listSurfaceRef}
          tabIndex={0}
          className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-rim/70 bg-white/45 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 dark:bg-slate-900/25"
          onWheel={(event) => {
            const now = performance.now();
            if (now - wheelThrottleRef.current < 300) return;
            if (Math.abs(event.deltaY) < 40) return;
            event.preventDefault();
            wheelThrottleRef.current = now;
            if (event.deltaY > 0) stepNext();
            else stepPrev();
          }}
          onKeyDown={(event) => {
            if (isEditableTarget(event.target)) return;
            if (event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
              event.preventDefault();
              stepNext();
            } else if (event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) {
              event.preventDefault();
              stepPrev();
            } else if (event.key === 'Home') {
              event.preventDefault();
              jumpWithDirection(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              jumpWithDirection(paged.pageCount - 1);
            }
          }}
        >
          {/* This viewport is what rowsPerPage uses so we fill the visible list region exactly. */}
          <div ref={listViewportRef} className="flex min-h-0 flex-1 flex-col px-2 pt-2">
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden overscroll-x-contain">
            <div className="w-max min-w-full">
              {/* Drift prevention: header and data rows must always use PitchGridRow with shared cols constants. */}
              <div ref={headerRowRef}>
                <PitchGridRow
                  variant="header"
                  cols={cols}
                  className="sticky top-0 z-10 border-b border-rim bg-white/70 py-3 text-xs uppercase tracking-wide backdrop-blur dark:bg-slate-900/70"
                >
                <div className="text-left justify-self-start">Index</div>
                <div className="text-left justify-self-start">Pitch</div>
                <div className="text-left justify-self-start">Play</div>
                <div className="tabular-nums text-right justify-self-end">Hz</div>
                <div className="text-left justify-self-start">Instrument</div>
                <div className="tabular-nums text-right justify-self-end">Bar #</div>
                <div className="text-left justify-self-start">Scale</div>
                <div className="tabular-nums text-right justify-self-end">Degree</div>
                <div className="tabular-nums text-right justify-self-end">Ratio</div>
                <div className="text-left justify-self-start">More</div>
                </PitchGridRow>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`page-${paged.pageIndex}`}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: pageDirection >= 0 ? 14 : -14 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: pageDirection >= 0 ? -14 : 14 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="relative z-0"
                >
                  {paged.pageItems.map((row) => {
                    const hz = formatHz(row.bar.hz);
                    const isOpen = openDetailsKey === row.key;
                    return (
                      <div
                        key={row.key}
                        ref={(element) => {
                          if (!element) {
                            rowAnchorRefs.current.delete(row.key);
                            return;
                          }
                          rowAnchorRefs.current.set(row.key, element);
                        }}
                        className="my-1 rounded-2xl border border-rim/80 bg-white/40 py-0.5 dark:bg-slate-900/30"
                        style={{ borderColor: `hsla(${SCALE_ACCENTS[row.bar.scaleId] ?? '220 10% 50%'}, 0.32)`, minHeight: `var(--pitch-row-h)` }}
                      >
                        <PitchGridRow variant="row" cols={cols} className="h-[var(--pitch-row-h)] text-sm">
                          <div className="tabular-nums text-right justify-self-end">{row.absoluteIndex + 1}</div>
                          <div className="min-w-0 text-left justify-self-start">
                            <PitchLabel hz={row.bar.hz} ratio={row.bar.ratioToStep0} instrumentId={row.bar.instrumentId} scaleId={row.bar.scaleId} barId={row.bar.barId} variant="list" />
                          </div>
                          <div className="justify-self-start">
                            <button onClick={() => void playBarWithPaging(row.bar.barId)} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${playingBarIds.has(row.bar.barId) ? 'border-emerald-400 bg-emerald-500/25' : 'border-rim'}`}>
                              {playingBarIds.has(row.bar.barId) ? (
                                <motion.span animate={reduced ? { opacity: [0.55, 1, 0.55] } : { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                                  <Volume2 className="h-4 w-4" />
                                </motion.span>
                              ) : <Play className="h-4 w-4" />}
                            </button>
                          </div>
                          <div className="tabular-nums text-right justify-self-end">{hz.text}</div>
                          <div className="min-w-0 text-left justify-self-start truncate">{instrumentLabel(row.bar)}</div>
                          <div className="tabular-nums text-right justify-self-end">{barNumber(row.bar.barId)}</div>
                          <div className="text-left justify-self-start uppercase">{row.bar.scaleId}</div>
                          <div className="tabular-nums text-right justify-self-end">{degreeFor(row.bar)}</div>
                          <div className="min-w-0 font-mono text-xs tabular-nums text-right justify-self-end truncate">
                            {Math.abs(row.bar.ratioErrorCents) >= 1 ? '≈ ' : ''}
                            {ratioForDisplay(row.bar)}
                          </div>
                          <div className="justify-self-start">
                            <button className="opacity-60 hover:opacity-100" onClick={() => setOpenDetailsKey((prev) => (prev === row.key ? null : row.key))}>{isOpen ? <ChevronDown className="h-4 w-4 rotate-180" /> : <ChevronDown className="h-4 w-4" />}</button>
                          </div>
                        </PitchGridRow>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

            <div ref={paginatorRef} className="pointer-events-auto mt-2 flex items-center justify-end">
              <div className="rounded-2xl border border-black/10 bg-white/55 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-black/30">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={stepPrev}
                    disabled={paged.pageIndex <= 0}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-black/5 active:scale-[0.98] disabled:opacity-40 dark:hover:bg-white/10"
                    aria-label="Previous page"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={stepNext}
                    disabled={paged.pageIndex >= paged.pageCount - 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-black/5 active:scale-[0.98] disabled:opacity-40 dark:hover:bg-white/10"
                    aria-label="Next page"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <div className="text-sm tabular-nums">Page {Math.min(paged.pageIndex + 1, paged.pageCount)}/{paged.pageCount}</div>
                  <div className="text-xs text-slate-600 tabular-nums dark:text-slate-300">{paged.rangeLabel}</div>
                  <PitchListPaginator
                    pageIndex={paged.pageIndex}
                    pageCount={paged.pageCount}
                    rangeLabel={paged.rangeLabel}
                    onPrev={stepPrev}
                    onNext={stepNext}
                    onJump={(page) => jumpWithDirection(page - 1)}
                  />
                </div>
              </div>
            </div>

            {import.meta.env.DEV && (
              <div className="pointer-events-none absolute right-3 top-3 z-30 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-white">
                v:{Math.round(measureDebug.viewport)} h:{Math.round(measureDebug.header)} p:{Math.round(measureDebug.pager)} r:{Math.round(measureDebug.row)} rows:{measureDebug.rowsPerPage}
              </div>
            )}
          </div>

          <PitchRowDetailsOverlay
            openRow={openRow}
            containerRef={listSurfaceRef}
            anchorEl={openDetailsKey ? (rowAnchorRefs.current.get(openDetailsKey) ?? null) : null}
            tolerance={tolerance}
            ratioForDisplay={ratioForDisplay}
            formatSignedCents={formatSignedCents}
            instrumentLabel={instrumentLabel}
            barNumber={barNumber}
            onPlayBar={playBarWithPaging}
            onClose={() => setOpenDetailsKey(null)}
          />
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section className="glass-panel glass-rim p-4" {...motionProps}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-xl font-semibold">Instrument Pads</h2>
            <button className={`rounded-full border px-3 py-1 text-xs ${mode === 'unique' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => setMode('unique')}>Unique</button>
            <button className={`rounded-full border px-3 py-1 text-xs ${mode === 'all' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => setMode('all')}>All bars</button>
            <button className="rounded-full border px-3 py-1 text-xs" onClick={stopAllWithFollowReset}>Stop All</button>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {['composite', ...instruments].map((instrument) => {
              const active = selectedInstruments.has(instrument);
              return (
                <button
                  key={instrument}
                  className={`rounded-full border px-3 py-1 text-xs ${active ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`}
                  onClick={() => {
                    const next = new Set(selectedInstruments);
                    if (active) next.delete(instrument);
                    else next.add(instrument);
                    if (!next.size) next.add('composite');
                    setSelectedInstruments(next);
                  }}
                >
                  {instrument === 'composite' ? 'Composite' : instrumentLabels.get(instrument)}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {padsFilteredByInstrument.map((bar, idx) => {
              const count = uniqueVisible.find((row) => row.rep.barId === bar.barId)?.members.length ?? 1;
              return (
                <button
                  key={bar.barId}
                  onClick={() => void playBarWithPaging(bar.barId)}
                  className="relative rounded-md border border-rim p-3 text-left shadow-sm transition hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(180deg, hsla(${SCALE_ACCENTS[bar.scaleId] ?? '220 8% 60%'}, 0.4), hsla(${SCALE_ACCENTS[bar.scaleId] ?? '220 8% 60%'}, 0.18))`,
                    marginTop: `${(idx % 4) * 6}px`,
                  }}
                >
                  <PitchLabel hz={bar.hz} ratio={bar.ratioToStep0} instrumentId={bar.instrumentId} scaleId={bar.scaleId} barId={bar.barId} variant="pad" />
                  <div className="text-xs font-medium opacity-90">{formatHz(bar.hz).text} Hz</div>
                  <div className="mt-1 text-xs opacity-80">{selectedInstruments.has('composite') ? `×${count}` : instrumentLabel(bar)}</div>
                </button>
              );
            })}
          </div>
        </motion.section>

        <motion.section className="glass-panel glass-rim p-4" {...motionProps}>
          <h2 className="mb-3 text-xl font-semibold">Scales</h2>
          <div className="space-y-3">
            {SCALE_IDS.map((scaleId) => {
              const scale = scalesById.get(scaleId);
              const isScaleOnline = Boolean(scale) || bars.some((bar) => bar.scaleId === scaleId);
              return (
                <div key={scaleId} className="rounded-2xl border border-rim p-3" style={{ backgroundColor: `hsla(${SCALE_ACCENTS[scaleId]}, 0.18)` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold uppercase">{scaleId}</div>
                      <div className="text-xs opacity-75">{SCALE_DESCRIPTIONS[scaleId]}</div>
                      {!isScaleOnline && <div className="text-xs italic text-amber-700 dark:text-amber-300">coming online</div>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={!scale}
                        onClick={() => {
                          if (!scale) return;
                          setSequenceFollow(true);
                          void playSequenceByBarIds(scale.bars, scale.scaleId === 'harmonic' ? { intervalMs: 220, overlapMs: 0, mode: 'expAccelerando', expFactor: 0.92, minIntervalMs: 25, gain: 0.9 } : { intervalMs: 200, overlapMs: 0, mode: 'constant', gain: 0.9 }, { name: scale.title });
                        }}
                        className="rounded-full border border-rim px-3 py-1 text-xs disabled:opacity-50"
                      >
                        Play in order
                      </button>
                      <Link to={scale ? `/scale/${scale.scaleId}` : '#'} className={`rounded-full border border-rim px-3 py-1 text-xs ${!scale ? 'pointer-events-none opacity-50' : ''}`}>Open scale</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
