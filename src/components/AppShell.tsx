import { Github } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { MiniPlayer } from './MiniPlayer';
import { useMicrorimbaData } from '../data/useMicrorimbaData';
import { getDefaultInstrumentForScale } from '../lib/instruments';
import { useAudio } from '../audio/AudioContextProvider';
import { AnimatedPageOutlet } from './AnimatedPageOutlet';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur transition ${isActive ? 'border-slate-900/40 bg-slate-900/85 text-white dark:border-white/40 dark:bg-white/85 dark:text-slate-900' : 'border-rim/70 bg-surface/70 hover:bg-surface'}`;

export function AppShell() {
  const { instruments } = useMicrorimbaData();
  const { showUnlockHint, unlockToast, requestAudioUnlock } = useAudio();
  const defaultInstrument = getDefaultInstrumentForScale(instruments, '9edo') ?? instruments[0]?.instrumentId;

  return (
    <div className="min-h-screen text-text">
      <main className="mx-auto max-w-[1320px] px-4 py-5 pb-32 md:px-8">
        <div className="sticky top-0 z-30 mb-6 flex items-center justify-between rounded-3xl border border-black/10 border-b bg-white/60 px-4 py-3 shadow-glass backdrop-blur-md dark:border-white/10 dark:bg-black/30">
          <Link to="/" className="font-mono text-sm tracking-wide">Microtonal Marimba Instruments</Link>
          <nav className="flex items-center gap-2">
            <NavLink className={navClass} to="/">Home</NavLink>
            <NavLink className={navClass} to={defaultInstrument ? `/instrument/${defaultInstrument}` : '/'}>Instruments</NavLink>
            <NavLink className={navClass} to="/about">About</NavLink>
            {showUnlockHint && (
              <button
                type="button"
                onClick={() => {
                  void requestAudioUnlock();
                }}
                className="rounded-full border border-rim/70 bg-surface/70 px-3 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-surface"
              >
                Enable sound
              </button>
            )}
            <a
              href="https://github.com/cbassuarez/microrimba"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="GitHub"
              title="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
          </nav>
        </div>
        {showUnlockHint && (
          <div className="mb-4 inline-flex items-center rounded-full border border-rim/70 bg-surface/80 px-3 py-1.5 text-xs shadow-glass backdrop-blur">
            Tap any Play button to enable sound
          </div>
        )}
        {unlockToast && (
          <div className="mb-4 inline-flex items-center rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-xs text-amber-100 shadow-glass backdrop-blur" role="status" aria-live="polite">{unlockToast}</div>
        )}
        <AnimatedPageOutlet />
      </main>
      <div className="hidden sm:block">
        <MiniPlayer />
      </div>
    </div>
  );
}
