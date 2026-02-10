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
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAudio } from '../audio/AudioContextProvider';
import { useMicrorimbaData } from '../data/useMicrorimbaData';
import type { Bar, PitchGroup, ScaleId } from '../data/types';
import { formatHz } from '../lib/format';
import { normalizeFracString } from '../lib/rational';
import { prettyInstrumentLabel } from '../lib/labels';
import { setTheme, type ThemeMode } from '../ui/theme';

type TolKey = '5' | '15' | '30';

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

export function PitchListPage() {
  const reduced = useReducedMotion();
  const { bars, scales, pitchIndex, loading, error } = useMicrorimbaData();
  const { toggleBar, stopAll, playingBarIds, playSequenceByBarIds } = useAudio();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'unique' | 'all'>('unique');
  const [tolerance, setTolerance] = useState<TolKey>('5');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showGroupingMenu, setShowGroupingMenu] = useState(false);
  const [selectedScales, setSelectedScales] = useState<Set<string>>(new Set(SCALE_IDS));
  const [selectedInstruments, setSelectedInstruments] = useState<Set<string>>(new Set(['composite']));
  const [theme, setThemeState] = useState<ThemeMode>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));

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
    <div className="space-y-6 font-condensed">
      <motion.section className="glass-panel glass-rim p-6 md:p-8" {...motionProps}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">VIEWER</p>
            <h1 className="mt-1 text-4xl font-semibold md:text-5xl">Microtonal Marimbas!</h1>
            <p className="mt-3 max-w-2xl text-base text-slate-700 dark:text-slate-200">CalArts recently got some microtonal marimbas, and we measured and recorded the bars as a pitch set. View all pitches in a table, hear a whole-set gliss, or listen to the harmonic marimba glissando (ooh, ahh).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-full border border-rim bg-white/60 px-4 py-2 text-sm shadow-sm dark:bg-black/20" onClick={() => void playSequenceByBarIds(uniqueVisible.map((row) => row.rep.barId), { intervalMs: 55, overlapMs: 0, mode: 'constant', gain: 0.9 })}> <Play className="mr-1 inline h-4 w-4" /> Play All </button>
            <button className="rounded-full border border-rim px-4 py-2 text-sm" onClick={stopAll}><Square className="mr-1 inline h-4 w-4" /> Stop All</button>
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
                  <button className={`rounded-full border px-3 py-1 ${mode === 'unique' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => setMode('unique')}>Unique</button>
                  <button className={`rounded-full border px-3 py-1 ${mode === 'all' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => setMode('all')}>All bars</button>
                </div>
                <div className="space-x-2">
                  {(['5', '15', '30'] as TolKey[]).map((tol) => (
                    <button key={tol} className={`rounded-full border px-3 py-1 ${tolerance === tol ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => setTolerance(tol)}>±{tol}c</button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <motion.section className="glass-panel glass-rim p-4" {...motionProps}>
        <div className="h-[520px] overflow-auto rounded-2xl border border-rim/70">
          <table className="w-full table-fixed border-collapse">
            <thead className="sticky top-0 z-20 bg-white/70 text-xs uppercase tracking-wide backdrop-blur dark:bg-slate-900/70">
              <tr className="border-b border-rim">
                {['Play', 'Hz', 'Instrument', 'Bar #', 'Scale', 'Degree', 'Index', 'Ratio', 'More'].map((label) => (
                  <th key={label} className="px-3 py-3 text-left font-normal">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(mode === 'all'
                ? allVisible.map((bar) => ({ key: bar.barId, bar, cluster: null as PitchGroup | null, members: [bar] }))
                : uniqueVisible.map((item) => ({ key: item.rep.barId, bar: item.rep, cluster: item.cluster, members: item.members })))
                .map(({ key, bar, cluster, members }, index) => {
                  const expandedRow = Boolean(expanded[key]);
                  const hz = formatHz(bar.hz);
                  return (
                    <tr key={key} className="align-top">
                      <td className="px-3 py-2 align-top" colSpan={9}>
                        <div className="block w-full min-w-0">
                          <div className="block w-full min-w-0 rounded-2xl border border-rim/80 bg-white/40 p-2 dark:bg-slate-900/30" style={{ borderColor: `hsla(${SCALE_ACCENTS[bar.scaleId] ?? '220 10% 50%'}, 0.32)` }}>
                            <div className="grid w-full min-w-0 grid-cols-[64px_120px_1fr_84px_100px_90px_90px_110px_72px] items-center gap-2 text-sm">
                              <button onClick={() => void toggleBar(bar.barId)} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${playingBarIds.has(bar.barId) ? 'border-emerald-400 bg-emerald-500/25' : 'border-rim'}`}>
                                {playingBarIds.has(bar.barId) ? (
                                  <motion.span animate={reduced ? { opacity: [0.55, 1, 0.55] } : { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                                    <Volume2 className="h-4 w-4" />
                                  </motion.span>
                                ) : <Play className="h-4 w-4" />}
                              </button>
                              <div>{hz.text}</div>
                              <div>{instrumentLabel(bar)}</div>
                              <div>{barNumber(bar.barId)}</div>
                              <div className="uppercase">{bar.scaleId}</div>
                              <div>{degreeFor(bar)}</div>
                              <div>{index + 1}</div>
                              <div className="min-w-0 font-mono text-xs tabular-nums">
                                {Math.abs(bar.ratioErrorCents) >= 1 ? '≈ ' : ''}
                                {ratioForDisplay(bar)}
                              </div>
                              <button className="opacity-60 hover:opacity-100" onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}>{expandedRow ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
                            </div>
                            <AnimatePresence initial={false}>
                              {expandedRow && (
                                <motion.div
                                  className="mt-2 overflow-hidden rounded-xl border border-rim bg-white/50 p-3 text-xs dark:bg-black/25"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                >
                                  <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                                    <div>bar_id: <span className="font-mono">{bar.barId}</span></div>
                                    <div>step_name: {bar.stepName}</div>
                                    <div>cents_from_step0: {bar.centsFromStep0}</div>
                                    <div>ratio_to_step0: <span className="font-mono tabular-nums">{ratioForDisplay(bar)}</span></div>
                                    <div>Ratio error: <span className="font-mono">{formatSignedCents(bar.ratioErrorCents)}</span></div>
                                    <div title={`raw: ${bar.hz}`}>raw Hz: <span className="font-mono">{bar.hz}</span></div>
                                  </div>
                                  {cluster && (
                                    <div className="mt-2 border-t border-rim pt-2">Tolerance ±{tolerance}c · members {cluster.stats.count} · max spread {cluster.stats.maxCentsSpread.toFixed(2)} cents</div>
                                  )}
                                  {cluster && (
                                    <div className="mt-2 space-y-1 pl-4">
                                      {members.map((member) => (
                                        <div key={member.barId} className="grid min-w-0 grid-cols-[40px_90px_1fr_80px_100px_1fr] items-center gap-2">
                                          <button onClick={() => void toggleBar(member.barId)} className="rounded border border-rim p-1"><Play className="h-3 w-3" /></button>
                                          <span>{formatHz(member.hz).text}</span>
                                          <span>{instrumentLabel(member)}</span>
                                          <span>{barNumber(member.barId)}</span>
                                          <span className="uppercase">{member.scaleId}</span>
                                          <span className="font-mono tabular-nums">{Math.abs(member.ratioErrorCents) >= 1 ? '≈ ' : ''}{ratioForDisplay(member)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section className="glass-panel glass-rim p-4" {...motionProps}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-xl font-semibold">Instrument Pads</h2>
            <button className={`rounded-full border px-3 py-1 text-xs ${mode === 'unique' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => setMode('unique')}>Unique</button>
            <button className={`rounded-full border px-3 py-1 text-xs ${mode === 'all' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`} onClick={() => setMode('all')}>All bars</button>
            <button className="rounded-full border px-3 py-1 text-xs" onClick={stopAll}>Stop All</button>
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
                  onClick={() => void toggleBar(bar.barId)}
                  className="relative rounded-md border border-rim p-3 text-left shadow-sm transition hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(180deg, hsla(${SCALE_ACCENTS[bar.scaleId] ?? '220 8% 60%'}, 0.4), hsla(${SCALE_ACCENTS[bar.scaleId] ?? '220 8% 60%'}, 0.18))`,
                    marginTop: `${(idx % 4) * 6}px`,
                  }}
                >
                  <div className="text-sm font-semibold">{formatHz(bar.hz).text}</div>
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
                          void playSequenceByBarIds(scale.bars, scale.scaleId === 'harmonic' ? { intervalMs: 220, overlapMs: 0, mode: 'expAccelerando', expFactor: 0.92, minIntervalMs: 25, gain: 0.9 } : { intervalMs: 200, overlapMs: 0, mode: 'constant', gain: 0.9 });
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
