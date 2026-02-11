import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PlayAllCTAProps = {
  isPlaying: boolean;
  onToggle: () => void;
  label?: string;
  playingLabel?: string;
  subLabel?: string;
  className?: string;
  sticky?: boolean;
};

type Star = {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
};

function useIsPageVisible() {
  const [isVisible, setIsVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const onVisibilityChange = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return isVisible;
}

export function PlayAllCTA({
  isPlaying,
  onToggle,
  label = 'Play All',
  playingLabel = 'Stop All',
  subLabel = 'gliss through the full set',
  className,
  sticky = false,
}: PlayAllCTAProps) {
  const prefersReducedMotion = useReducedMotion();
  const isVisible = useIsPageVisible();
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const currentSpeedRef = useRef(0.15);
  const targetSpeedRef = useRef(0.15);
  const flashRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [isInView, setIsInView] = useState(true);

  const starCount = useMemo(() => {
    if (typeof window === 'undefined') return 220;
    return window.matchMedia('(max-width: 640px)').matches ? 190 : 300;
  }, []);

  const resetStar = useCallback((star: Star) => {
    star.x = (Math.random() * 2 - 1) * 1.8;
    star.y = (Math.random() * 2 - 1) * 1.8;
    star.z = Math.random() * 0.98 + 0.02;
    star.px = 0;
    star.py = 0;
  }, []);

  useEffect(() => {
    const stars = starsRef.current;
    if (stars.length) return;
    for (let i = 0; i < starCount; i += 1) {
      const star = { x: 0, y: 0, z: 1, px: 0, py: 0 };
      resetStar(star);
      stars.push(star);
    }
  }, [resetStar, starCount]);

  useEffect(() => {
    if (!rootRef.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { root: null, threshold: 0.1 },
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    targetSpeedRef.current = isPlaying ? 0.65 : hovered ? 1 : 0.15;
  }, [hovered, isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let mounted = true;
    const resize = () => {
      if (!rootRef.current || !canvas) return;
      const rect = rootRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const resizeObserver = typeof ResizeObserver !== 'undefined' && rootRef.current
      ? new ResizeObserver(resize)
      : null;
    if (resizeObserver && rootRef.current) resizeObserver.observe(rootRef.current);
    window.addEventListener('resize', resize);

    const render = (now: number) => {
      if (!mounted) return;
      const rafActive = isVisible && isInView;
      if (!rafActive) {
        return;
      }

      const last = lastFrameRef.current || now;
      const dtRaw = now - last;
      lastFrameRef.current = now;
      if (dtRaw <= 0) {
        rafRef.current = window.requestAnimationFrame(render);
        return;
      }

      const fullRate = hovered || isPlaying;
      if (!fullRate && dtRaw < 30) {
        rafRef.current = window.requestAnimationFrame(render);
        return;
      }

      const dt = Math.min(dtRaw, 48);
      const cssWidth = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
      const cssHeight = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
      const cx = cssWidth * 0.5;
      const cy = cssHeight * 0.5;
      const f = Math.min(cssWidth, cssHeight) * 0.8;

      currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * 0.08;
      flashRef.current *= 0.85;
      const brightness = 0.22 + currentSpeedRef.current * 0.28 + flashRef.current * 0.5;

      context.clearRect(0, 0, cssWidth, cssHeight);
      context.fillStyle = 'rgba(8, 14, 30, 0.28)';
      context.fillRect(0, 0, cssWidth, cssHeight);
      context.lineWidth = 1;
      context.strokeStyle = `rgba(170,220,255,${Math.min(0.72, brightness)})`;

      const stars = starsRef.current;
      const zStep = currentSpeedRef.current * (dt / 16.666) * 0.028;

      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i];
        star.z -= zStep;

        if (star.z <= 0.015) {
          resetStar(star);
          continue;
        }

        const sx = (star.x / star.z) * f + cx;
        const sy = (star.y / star.z) * f + cy;

        if (star.px === 0 && star.py === 0) {
          star.px = sx;
          star.py = sy;
        }

        if (sx < -40 || sx > cssWidth + 40 || sy < -40 || sy > cssHeight + 40) {
          resetStar(star);
          continue;
        }

        context.beginPath();
        context.moveTo(star.px, star.py);
        context.lineTo(sx, sy);
        context.stroke();

        star.px = sx;
        star.py = sy;
      }

      rafRef.current = window.requestAnimationFrame(render);
    };

    rafRef.current = window.requestAnimationFrame(render);

    return () => {
      mounted = false;
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      window.removeEventListener('resize', resize);
      resizeObserver?.disconnect();
    };
  }, [hovered, isInView, isPlaying, isVisible, prefersReducedMotion, resetStar]);

  const ctaLabel = isPlaying ? playingLabel : label;

  return (
    <motion.button
      ref={rootRef}
      type="button"
      aria-label={ctaLabel}
      aria-pressed={isPlaying}
      onClick={onToggle}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={() => {
        flashRef.current = 1;
      }}
      whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }}
      className={`group relative h-[54px] w-full overflow-hidden rounded-2xl border border-white/15 bg-white/10 text-left shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-md dark:border-white/10 dark:bg-black/20 sm:h-[64px] ${sticky ? 'max-w-xs' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30 ${className ?? ''}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(143,196,255,0.24),transparent_55%),radial-gradient(circle_at_78%_82%,rgba(147,127,255,0.2),transparent_50%)]" />
      <div
        className={`pointer-events-none absolute inset-[-20%] rounded-[28px] bg-[radial-gradient(circle,rgba(142,212,255,0.36)_0%,rgba(142,212,255,0)_62%)] blur-2xl transition-opacity duration-300 ${hovered || isPlaying ? 'opacity-100' : 'opacity-35'}`}
      />
      {!prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ['0%', '260%'] }}
          transition={{ duration: 3.6, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:radial-gradient(rgba(255,255,255,0.6)_0.5px,transparent_0.5px)] [background-size:3px_3px]" />
      {!prefersReducedMotion ? (
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[conic-gradient(from_200deg_at_60%_45%,rgba(74,144,226,0.35),rgba(29,49,91,0.22),rgba(153,116,255,0.3),rgba(74,144,226,0.35))] opacity-50" />
      )}
      <div className="relative z-10 flex h-full items-center justify-between px-4 sm:px-5">
        <div className="rounded-xl bg-slate-950/32 px-3 py-1.5 backdrop-blur">
          <p className="text-base font-semibold tracking-tight text-white sm:text-lg">{ctaLabel}</p>
          <p className="text-[11px] text-white/80 sm:text-xs">{subLabel}</p>
        </div>
        <div className={`rounded-full border border-white/25 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/85 transition-opacity sm:px-3 ${hovered || isPlaying ? 'opacity-100' : 'opacity-70'}`}>
          {isPlaying ? 'Live' : 'Hero'}
        </div>
      </div>
    </motion.button>
  );
}
