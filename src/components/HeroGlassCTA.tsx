import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '../lib/cn';

type HeroGlassCTAProps = {
  isActive: boolean;
  onClick: () => void;
  label?: string;
  activeLabel?: string;
  subLabel?: string;
  activeSubLabel?: string;
  className?: string;
};

const NUDGE_SESSION_KEY = 'microrimba.heroGlassCta.nudged';

export function HeroGlassCTA({
  isActive,
  onClick,
  label = '▶ Play All',
  activeLabel = '■ Stop',
  subLabel = 'Hear the full set in one sweep',
  activeSubLabel = 'Playing…',
  className,
}: HeroGlassCTAProps) {
  const reducedMotion = useReducedMotion();
  const [burstKey, setBurstKey] = useState(0);
  const [flashActive, setFlashActive] = useState(false);
  const [nudged, setNudged] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(NUDGE_SESSION_KEY)) return;

    let endTimer: number | undefined;
    const startTimer = window.setTimeout(() => {
      setNudged(true);
      endTimer = window.setTimeout(() => setNudged(false), 600);
      sessionStorage.setItem(NUDGE_SESSION_KEY, '1');
    }, 800);

    return () => {
      window.clearTimeout(startTimer);
      if (endTimer) window.clearTimeout(endTimer);
    };
  }, []);

  useEffect(() => {
    if (!flashActive) return;
    const timer = window.setTimeout(() => setFlashActive(false), 140);
    return () => window.clearTimeout(timer);
  }, [flashActive]);

  const glowOpacity = isActive ? 0.26 : nudged ? 0.22 : 0.16;

  return (
    <motion.button
      type="button"
      onClick={() => {
        setFlashActive(true);
        onClick();
      }}
      onHoverStart={() => {
        if (reducedMotion || isActive) return;
        setBurstKey((value) => value + 1);
      }}
      className={cn(
        'group relative isolate inline-flex h-[52px] w-full min-w-0 items-center justify-between overflow-hidden rounded-full border border-rim bg-surface px-5 text-left shadow-[0_14px_30px_rgba(7,12,24,0.24),inset_0_1px_0_rgba(255,255,255,0.32)] backdrop-blur-xl',
        'sm:h-[60px] sm:w-auto sm:min-w-[240px] sm:px-6',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white/40 dark:focus-visible:ring-offset-slate-950/40',
        className,
      )}
      animate={
        reducedMotion
          ? { opacity: 1 }
          : {
              y: 0,
              scale: 1,
            }
      }
      whileHover={
        reducedMotion
          ? { opacity: 1 }
          : {
              y: -2,
              scale: 1.01,
            }
      }
      whileTap={reducedMotion ? { opacity: 1 } : { scale: 0.992 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/28 via-white/8 to-black/8" />
      <motion.span
        className="pointer-events-none absolute inset-[1px] rounded-full"
        style={{
          border: '1px solid transparent',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.1) 40%, rgba(17,23,37,0.24)) border-box',
          WebkitMask:
            'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
        animate={{ opacity: isActive ? 0.8 : 0.55 }}
        whileHover={{ opacity: isActive ? 0.9 : 0.75 }}
      />
      <motion.span
        className="pointer-events-none absolute inset-1 rounded-full"
        style={{
          background: 'radial-gradient(120% 90% at 12% 50%, rgba(255,255,255,0.28), rgba(255,255,255,0) 68%)',
          filter: isActive ? 'blur(12px)' : 'blur(16px)',
        }}
        animate={{ opacity: glowOpacity }}
        whileHover={{ opacity: isActive ? 0.32 : 0.24 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      />

      {!reducedMotion && !isActive && (
        <motion.span
          className="pointer-events-none absolute -left-[34%] top-0 h-full w-[24%] rounded-full bg-gradient-to-r from-transparent via-white/35 to-transparent mix-blend-screen"
          animate={{ x: ['0%', '540%'] }}
          transition={{ duration: 7, ease: 'linear', repeat: Infinity, repeatDelay: 0 }}
        />
      )}

      {!reducedMotion && !isActive && burstKey > 0 && (
        <motion.span
          key={burstKey}
          className="pointer-events-none absolute -left-[34%] top-0 h-full w-[24%] rounded-full bg-gradient-to-r from-transparent via-white/45 to-transparent"
          initial={{ x: '0%', opacity: 0 }}
          animate={{ x: '540%', opacity: [0, 0.45, 0] }}
          transition={{ duration: 1.05, ease: 'easeOut' }}
        />
      )}

      <motion.span
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/45 to-transparent"
        initial={false}
        animate={{ opacity: flashActive ? 0.35 : 0 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
      />

      <span className="relative z-10 flex min-w-0 flex-col">
        <span className="inline-block w-fit rounded-full bg-black/10 px-2 py-0.5 text-[1.05rem] font-semibold leading-none text-slate-900 dark:bg-white/10 dark:text-slate-100">
          {isActive ? activeLabel : label}
        </span>
        <span className="mt-1 text-xs leading-tight text-slate-700 dark:text-slate-200">
          {isActive ? activeSubLabel : subLabel}
        </span>
      </span>
    </motion.button>
  );
}
