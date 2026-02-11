import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronUp, Play, Square, SquareX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../audio/AudioContextProvider';
import { useMicrorimbaData } from '../data/useMicrorimbaData';
import { formatHz } from '../lib/format';
import { prettyInstrumentLabel } from '../lib/labels';
import { getPitchDisplayStrings } from './PitchLabel';

const SCALE_ACCENT: Record<string, string> = {
  '5edo': 'border-amber-400 bg-amber-400/20 text-amber-200',
  '7edo': 'border-emerald-400 bg-emerald-400/20 text-emerald-200',
  '8edo': 'border-cyan-400 bg-cyan-400/20 text-cyan-200',
  '9edo': 'border-sky-400 bg-sky-400/20 text-sky-200',
  harmonic: 'border-fuchsia-400 bg-fuchsia-400/20 text-fuchsia-200',
};

const SCALE_BORDER: Record<string, string> = {
  '5edo': 'border-amber-400/60',
  '7edo': 'border-emerald-400/60',
  '8edo': 'border-cyan-400/60',
  '9edo': 'border-sky-400/60',
  harmonic: 'border-fuchsia-400/60',
};

const COMPACT_HEIGHT = 52;
const EXPANDED_MAX_HEIGHT = 220;

function mergePitchText(letter: string, accidental: string, octave: string): string {
  return `${letter}${accidental}${octave}`;
}

export function MiniPlayer() {
  const { voices, stopAll, stopVoice, sequence, stopSequence } = useAudio();
  const { bars } = useMicrorimbaData();
  const reduced = useReducedMotion();

  const [isExpanded, setIsExpanded] = useState(false);
  const [userPinnedExpanded, setUserPinnedExpanded] = useState(false);
  const [lastInteractionAt, setLastInteractionAt] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);

  const barById = useMemo(() => new Map(bars.map((bar) => [bar.barId, bar])), [bars]);
  const sortedVoices = useMemo(() => [...voices].sort((a, b) => b.startedAt - a.startedAt), [voices]);

  const latestVoice = sortedVoices[0] ?? null;
  const latestBar = latestVoice ? barById.get(latestVoice.barId) : null;
  const dominantScaleId = latestBar?.scaleId ?? '9edo';

  useEffect(() => {
    if (!isExpanded || userPinnedExpanded) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);

    const delay = voices.length === 0 ? 1500 : 4000;
    const elapsed = Date.now() - lastInteractionAt;
    const remaining = Math.max(0, delay - elapsed);

    timerRef.current = window.setTimeout(() => setIsExpanded(false), remaining);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isExpanded, lastInteractionAt, userPinnedExpanded, voices.length]);

  useEffect(() => () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const markInteraction = () => setLastInteractionAt(Date.now());

  const toggleExpanded = () => {
    markInteraction();
    setIsExpanded((prev) => {
      const next = !prev;
      setUserPinnedExpanded(next);
      return next;
    });
  };

  const summaryText = useMemo(() => {
    if (!sortedVoices.length) return 'No active voices';
    if (sortedVoices.length === 1 && latestBar) {
      const pitch = getPitchDisplayStrings(latestBar.hz, latestBar.ratioToStep0, latestBar.scaleId, latestBar.barId);
      const pitchText = mergePitchText(pitch.noteLetter, pitch.accidentalText, pitch.octaveText);
      return `${pitchText}${pitch.centsText ? ` ${pitch.centsText}` : ''} • ${formatHz(latestBar.hz).text} Hz • ${prettyInstrumentLabel(latestBar.scaleId, latestBar.instrumentId, latestBar.edo)}`;
    }
    if (latestBar) {
      const pitch = getPitchDisplayStrings(latestBar.hz, latestBar.ratioToStep0, latestBar.scaleId, latestBar.barId);
      const pitchText = mergePitchText(pitch.noteLetter, pitch.accidentalText, pitch.octaveText);
      return `${sortedVoices.length} voices • Polyphonic • ${pitchText}`;
    }
    return `${sortedVoices.length} voices • Polyphonic`;
  }, [latestBar, sortedVoices]);

  const groupedVoices = useMemo(() => {
    const shouldGroup = sortedVoices.length > 6;
    let lastScale = '';
    return sortedVoices.map((voice) => {
      const bar = barById.get(voice.barId);
      const scaleId = bar?.scaleId ?? '';
      const showDivider = shouldGroup && scaleId !== lastScale;
      lastScale = scaleId;
      return { voice, bar, showDivider };
    });
  }, [barById, sortedVoices]);

  return (
    <motion.section
      className={`fixed bottom-4 right-4 left-4 z-30 overflow-hidden border border-rim bg-surface/70 px-3 py-2 shadow-glass backdrop-blur ${isExpanded ? 'rounded-2xl' : 'rounded-full'}`}
      onClickCapture={markInteraction}
      onKeyDownCapture={markInteraction}
      initial={{ opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, height: isExpanded ? EXPANDED_MAX_HEIGHT : COMPACT_HEIGHT }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={reduced ? undefined : { height: isExpanded ? EXPANDED_MAX_HEIGHT : COMPACT_HEIGHT }}
    >
      <div className="flex h-9 items-center justify-between gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-rim px-3 py-1 text-xs"
          onClick={() => {
            markInteraction();
            stopAll();
          }}
        >
          {(voices.length > 0 || sequence.active) ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {(voices.length > 0 || sequence.active) ? 'Stop All' : 'Play All'}
        </button>

        <div className="min-w-0 flex-1 truncate text-xs text-zinc-200">{summaryText}</div>

        <div className="inline-flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] tabular-nums ${SCALE_ACCENT[dominantScaleId] ?? 'border-rim bg-white/10 text-zinc-100'}`}>
            {voices.length}
          </span>
          <button className="rounded-full border border-rim p-1.5" onClick={toggleExpanded} aria-label={isExpanded ? 'Collapse mini player' : 'Expand mini player'}>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="mt-2 rounded-2xl border border-rim/60 bg-black/10 p-2"
            initial={{ opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {sequence.active && (
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{sequence.name || 'Glissando'} • step {Math.max(1, sequence.currentStep)}/{sequence.totalSteps}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-white/70" style={{ width: `${sequence.totalSteps > 0 ? Math.min(100, (Math.max(1, sequence.currentStep) / sequence.totalSteps) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            )}

            <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-300">Voices</div>
            <div className="max-h-[130px] space-y-1 overflow-y-auto pr-1">
              {sequence.active && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-300/60 bg-violet-400/10 p-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-medium">Sequence voice</div>
                    <div className="truncate text-zinc-300">{sequence.name || 'Glissando'} • {Math.max(1, sequence.currentStep)}/{sequence.totalSteps}</div>
                  </div>
                  <button className="inline-flex items-center gap-1 rounded-md border border-rim px-2 py-1" onClick={() => { markInteraction(); stopSequence(); }}>
                    <SquareX className="h-3.5 w-3.5" /> Stop
                  </button>
                </div>
              )}

              {groupedVoices.map(({ voice, bar, showDivider }) => {
                const pitch = bar ? getPitchDisplayStrings(bar.hz, bar.ratioToStep0, bar.scaleId, bar.barId) : null;
                const pitchText = pitch ? mergePitchText(pitch.noteLetter, pitch.accidentalText, pitch.octaveText) : null;

                return (
                <motion.div
                  key={voice.id}
                  className="space-y-1"
                  initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                >
                  {showDivider && <div className="my-1 border-t border-rim/40" />}
                  <div className={`flex items-center justify-between gap-2 rounded-xl border p-2 text-xs ${SCALE_BORDER[bar?.scaleId ?? ''] ?? 'border-rim'}`}>
                    <div className="min-w-0">
                      <div className="truncate font-mono">{bar && pitchText ? `${pitchText}${pitch?.centsText ? ` ${pitch.centsText}` : ''} • ${formatHz(bar.hz).text} Hz` : voice.barId}</div>
                      <div className="truncate text-zinc-300">{bar ? prettyInstrumentLabel(bar.scaleId, bar.instrumentId, bar.edo) : 'Unknown instrument'}</div>
                    </div>
                    <button
                      onClick={() => {
                        markInteraction();
                        stopVoice(voice.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-rim px-2 py-1"
                    >
                      <SquareX className="h-3.5 w-3.5" /> Stop
                    </button>
                  </div>
                </motion.div>
              );})}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
