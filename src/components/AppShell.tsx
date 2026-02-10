import { Link, NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, Moon, Sun } from 'lucide-react';
import { initTheme, setTheme, type ThemeMode } from '../ui/theme';
import { MiniPlayer } from './MiniPlayer';

export function AppShell() {
  const [open, setOpen] = useState(true);
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  useEffect(() => setThemeState(initTheme()), []);
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  return (
    <div className="min-h-screen text-text">
      <div className="flex">
        <aside className={`m-3 rounded-2xl border border-rim bg-surface/80 p-4 backdrop-blur transition-all ${open ? 'w-72' : 'w-16'}`}>
          <button onClick={() => setOpen((x) => !x)} className="mb-4 rounded-md border p-2"><Menu className="h-4 w-4" /></button>
          {open && (
            <nav className="space-y-2 text-sm">
              <NavLink to="/">Pitch list</NavLink><br />
              <NavLink to="/groups">Pitch grouping</NavLink>
              <div className="pt-2 text-xs uppercase opacity-60">Scales</div>
              <NavLink to="/scale/5edo">5-EDO</NavLink><br />
              <NavLink to="/scale/9edo">9-EDO</NavLink><br />
              <NavLink to="/scale/harmonic">Harmonic</NavLink>
              <div className="pt-4 text-xs opacity-50">About (coming soon)</div>
            </nav>
          )}
        </aside>
        <main className="flex-1 p-4 pb-32">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-rim bg-surface/70 px-4 py-3 backdrop-blur">
            <div className="text-sm"><Link to="/">microrimba</Link></div>
            <button
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                setTheme(next);
                setThemeState(next);
              }}
              className="rounded-md border p-2"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <Outlet />
        </main>
      </div>
      <MiniPlayer />
    </div>
  );
}
