import { Github } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { MiniPlayer } from './MiniPlayer';

const navClass = 'rounded-full border border-rim/70 bg-surface/70 px-3 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-surface';

export function AppShell() {
  return (
    <div className="min-h-screen text-text">
      <main className="mx-auto max-w-[1320px] px-4 py-5 pb-32 md:px-8">
        <div className="sticky top-0 z-30 mb-6 flex items-center justify-between rounded-3xl border border-black/10 border-b bg-white/60 px-4 py-3 shadow-glass backdrop-blur-md dark:border-white/10 dark:bg-black/30">
          <Link to="/" className="font-mono text-sm tracking-wide">microtonal marimbas</Link>
          <nav className="flex items-center gap-2">
            <NavLink className={navClass} to="/">Home</NavLink>
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
        <Outlet />
      </main>
      <div className="hidden sm:block">
        <MiniPlayer />
      </div>
    </div>
  );
}
