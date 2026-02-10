import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataset } from '../data/useDataset';
import { useAudio } from '../audio/AudioContextProvider';
import { formatHz } from '../lib/format';

export function PitchListPage() {
  const { bars, pitchIndex, loading, error } = useDataset();
  const { playBar, canPlay, playingBarIds } = useAudio();
  const [grouped, setGrouped] = useState(false);
  const [tol, setTol] = useState<'5' | '15' | '30'>('15');
  const [sort, setSort] = useState('hz-asc');

  const sortedBars = useMemo(() => {
    const clone = [...bars];
    if (sort === 'hz-desc') clone.sort((a, b) => b.hz - a.hz || a.barId.localeCompare(b.barId));
    else if (sort === 'instrument') clone.sort((a, b) => a.instrumentId.localeCompare(b.instrumentId) || a.hz - b.hz);
    else if (sort === 'scale-step') clone.sort((a, b) => a.scaleId.localeCompare(b.scaleId) || a.step - b.step || a.barId.localeCompare(b.barId));
    else clone.sort((a, b) => a.hz - b.hz || a.barId.localeCompare(b.barId));
    return clone;
  }, [bars, sort]);

  if (loading) return <p>Loading…</p>;
  if (error || !pitchIndex) return <p className="text-rose-400">Could not load JSON data: {error}</p>;

  if (grouped) {
    return (
      <div className="space-y-3">
        <header className="flex items-center gap-3">
          <button className="rounded-md border px-2 py-1" onClick={() => setGrouped(false)}>Ungroup</button>
          {(['5', '15', '30'] as const).map((v) => <button key={v} className="rounded-md border px-2 py-1" onClick={() => setTol(v)}>{v}c</button>)}
        </header>
        {pitchIndex.clustersByTolerance[tol].map((g) => (
          <details key={g.groupId} className="rounded-xl border border-rim bg-surface/60 p-3">
            <summary>{g.repBarId} · {formatHz(g.repHz)} Hz · {g.stats.count} bars</summary>
            <div className="mt-2 space-y-1">
              {g.members.map((m) => (
                <div key={m} className="flex items-center justify-between">
                  <Link to={`/bar/${m}`}>{m}</Link>
                  <button disabled={!canPlay(m)} onClick={() => playBar(m)}>{playingBarIds.has(m) ? 'Playing' : 'Play'}</button>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    );
  }

  return (
    <div>
      <header className="mb-3 flex items-center gap-2">
        <button className="rounded-md border px-2 py-1" onClick={() => setGrouped(true)}>Group pitches</button>
        <select className="rounded-md border bg-transparent px-2 py-1" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="hz-asc">Hz asc</option><option value="hz-desc">Hz desc</option><option value="instrument">Instrument</option><option value="scale-step">Scale + step</option>
        </select>
      </header>
      <div className="space-y-1">
        {sortedBars.map((bar) => (
          <div key={bar.barId} className="flex items-center justify-between rounded-xl border border-rim bg-surface/60 p-2">
            <Link to={`/bar/${bar.barId}`}>{bar.barId}</Link>
            <div>{bar.instrumentId}</div>
            <div>{bar.stepName}</div>
            <div>{formatHz(bar.hz)} Hz</div>
            <button disabled={!canPlay(bar.barId)} title={canPlay(bar.barId) ? '' : 'audio missing'} onClick={() => playBar(bar.barId)}>{playingBarIds.has(bar.barId) ? 'Playing' : 'Play'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
