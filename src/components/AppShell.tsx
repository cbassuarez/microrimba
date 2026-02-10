import { Link, NavLink, Outlet } from 'react-router-dom';
import { MiniPlayer } from './MiniPlayer';

const navClass = 'rounded-full border border-rim/70 bg-surface/70 px-3 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-surface';

export function AppShell() {
  return (
    <div className="min-h-screen text-text">
      <main className="mx-auto max-w-[1320px] px-4 py-5 pb-32 md:px-8">
        <div className="mb-6 flex items-center justify-between rounded-3xl border border-rim bg-surface/60 px-4 py-3 shadow-glass backdrop-blur-xl">
          <Link to="/" className="font-mono text-sm tracking-wide">microrimba</Link>
          <nav className="flex items-center gap-2">
            <NavLink className={navClass} to="/">Home</NavLink>
            <NavLink className={navClass} to="/groups">Groups</NavLink>
            <NavLink className={navClass} to="/scale/5edo">Scale</NavLink>
          </nav>
        </div>
        <Outlet />
      </main>
      <MiniPlayer />
    </div>
  );
}
