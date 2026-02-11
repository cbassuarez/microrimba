import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSmuflFontStatus, type SmuflFontStatus } from '../fonts/fontStatus';

type GlossaryTermProps = {
  term: string;
  definition: string;
};

function GlossaryTerm({ term, definition }: GlossaryTermProps) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 12 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      if (!triggerRect || !tooltipRect) return;

      const horizontalPadding = 12;
      const defaultTop = triggerRect.top - tooltipRect.height - 8;
      const top = defaultTop < horizontalPadding ? triggerRect.bottom + 8 : defaultTop;
      const left = Math.min(
        Math.max(triggerRect.left, horizontalPadding),
        window.innerWidth - tooltipRect.width - horizontalPadding,
      );

      setPosition({ top, left });
    };

    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        updatePosition();
      });
    };

    updatePosition();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);

    return () => {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="rounded-md border border-rim/70 bg-white/40 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-700 underline decoration-dotted underline-offset-2 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-black/40"
        aria-label={`${term} definition`}
        aria-expanded={open}
        aria-describedby={`glossary-${term}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {term}
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            // Render tooltips in a body portal so glass-card overflow clipping cannot cut them off.
            <motion.span
              ref={tooltipRef}
              id={`glossary-${term}`}
              role="tooltip"
              className="fixed z-50 pointer-events-auto max-w-[min(320px,calc(100vw-24px))] rounded-xl border border-rim bg-surface p-2 text-xs text-slate-700 shadow-glass backdrop-blur-md dark:text-slate-200"
              style={{ top: position.top, left: position.left }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.16 }}
            >
              {definition}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}


export function AboutPage() {
  const reduced = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [fontStatus, setFontStatus] = useState<SmuflFontStatus>({ heji2: false, heji2Text: false });

  const sectionMotion = (delay: number) =>
    reduced
      ? {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true, amount: 0.25 },
          transition: { duration: 0.25, delay },
        }
      : {
          initial: { opacity: 0, y: 12 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.25 },
          transition: { duration: 0.35, delay, ease: 'easeOut' as const },
        };

  const citation = 'Feeney, Tim; Suarez-Solis, Sebastian. Microtonal Marimba Instruments: recordings, measured pitch analysis, and tuning study set.';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const showDebug = import.meta.env.DEV || params.get('debug') === '1';

    if (!showDebug) {
      return;
    }

    let cancelled = false;

    const updateStatus = async () => {
      const status = await getSmuflFontStatus();
      if (!cancelled) {
        setFontStatus(status);
      }
    };

    void updateStatus();

    document.fonts?.ready.then(() => {
      void updateStatus();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const showFontDebug = import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8 font-condensed">
      <motion.section className="glass-panel glass-rim p-6 md:p-8" {...sectionMotion(0)}>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-600 dark:text-slate-300">About</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-5xl">Microtonal Marimba Instruments</h1>
        <p className="mt-4 max-w-3xl text-base text-slate-700 dark:text-slate-200">
          This is a small instrument library for composers and students, built for composition, pedagogy, and practical tuning exploration.
          Measured pitch means each value is analysis-derived from recordings and reported honestly, with intentionally conservative display precision.
        </p>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.15em] text-slate-600 dark:text-slate-300">
          Recordings • Analysis • Tunings • Credits
        </p>
      </motion.section>

      <motion.section className="glass-panel glass-rim p-6 md:p-7" {...sectionMotion(0.04)}>
        <h2 className="text-2xl font-semibold">Why this exists</h2>
        <div className="mt-3 space-y-3 text-base leading-relaxed text-slate-700 dark:text-slate-200">
          <p>
            This was originally a class assignment to document pitches of 5 new instruments made available to the percussion studio at CalArts. Now that the data has been compiled, why not share it? The goal for this small reference library is to give composers and students a concrete, playable reference for a set of instruments they might not be able to physically access.
          </p>
          <p>
            Typical use-cases include orchestration tests, ear training, timbral comparison across tuning systems, and fast compositional sketching.
          </p>
          <p>
            Pitch values are measured or estimated from recordings, then presented with conservative precision so the data is musical and truthful.
          </p>
        </div>
      </motion.section>

      <motion.section className="glass-panel glass-rim p-6 md:p-7" {...sectionMotion(0.08)}>
        <h2 className="text-2xl font-semibold">Instruments</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-700 dark:text-slate-200">
          The instruments are curated bar sets recorded as playable references. Each set corresponds to a tuning framework, so you can compare how melodic and harmonic behavior changes while keeping a similar timbral palette.
        </p>
        <p className="mt-3 font-mono text-sm text-slate-700 dark:text-slate-200">
          Instrument construction: Chris Banta
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">If you have the authoritative build notes, send a PR / contact.</p>
      </motion.section>

      <motion.section className="glass-panel glass-rim p-6 md:p-7" {...sectionMotion(0.12)}>
        <h2 className="text-2xl font-semibold">Tunings</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-slate-700 dark:text-slate-200">
          <li>5-EDO — equal divisions of the octave into 5 steps (240¢ each).</li>
          <li>7-EDO — 7 equal steps (≈171.4¢).</li>
          <li>8-EDO — 8 equal steps (150¢).</li>
          <li>9-EDO — 9 equal steps (≈133.3¢).</li>
          <li>Harmonic series (partials) — pitches aligned to partial numbers relative to a reference fundamental.</li>
        </ul>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
          Sample sets are recorded bars; harmonic set is partial-indexed; EDO sets are step-indexed.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
          <span>Glossary:</span>
          <GlossaryTerm term="EDO" definition="Equal divisions of the octave: steps evenly spaced in cents." />
          <GlossaryTerm term="¢" definition="Cents: a logarithmic unit for musical intervals (1200¢ per octave)." />
          <GlossaryTerm term="Partials" definition="Harmonic partials: integer multiples of a fundamental frequency." />
        </div>
      </motion.section>

      <motion.section className="grid gap-4 md:grid-cols-2" {...sectionMotion(0.16)}>
        <article className="glass-panel glass-rim p-6">
          <h2 className="text-2xl font-semibold">Credits</h2>
          <div className="mt-3 space-y-2 text-base text-slate-700 dark:text-slate-200">
            <p>Recording & performance: Tim Feeney</p>
            <p>Analysis, code, data & web: Seb Suarez</p>
            <p>Class: Matthew H., Jake L., Paul Y.</p>
            <p>Instrument construction: Chris Banta</p>
          </div>
        </article>
        <article className="glass-panel glass-rim p-6">
          <h2 className="text-2xl font-semibold">Usage</h2>
          <p className="mt-3 text-base leading-relaxed text-slate-700 dark:text-slate-200">
            You can use this library to compose, teach, cite, and reuse material where permitted. Licensing details live in the repository LICENSE and README.
          </p>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
            Fonts: HEJI2 and HEJI2Text are included for notation glyph rendering workflows.
          </p>
        </article>
      </motion.section>

      {showFontDebug ? (
        <motion.section className="glass-panel glass-rim p-3" {...sectionMotion(0.18)}>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Fonts: HEJI2 {fontStatus.heji2 ? '✓' : '✕'} / HEJI2Text {fontStatus.heji2Text ? '✓' : '✕'}
          </p>
        </motion.section>
      ) : null}

      <motion.section className="glass-panel glass-rim p-5" {...sectionMotion(0.2)}>
        <h2 className="text-xl font-semibold">Cite this</h2>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="rounded-xl border border-rim/70 bg-white/40 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-black/20 dark:text-slate-200">{citation}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(citation);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rim px-3 py-2 text-sm font-medium transition hover:bg-white/50 dark:hover:bg-black/20"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy citation'}
          </button>
        </div>
      </motion.section>
    </div>
  );
}
