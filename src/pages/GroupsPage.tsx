import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useDataset } from '../data/useDataset';
import { formatHz } from '../lib/format';

export function GroupsPage() {
  const { pitchIndex, loading, error } = useDataset();
  const [tol, setTol] = useState<'5' | '15' | '30'>('15');
  if (loading) return <p>Loading…</p>;
  if (error || !pitchIndex) return <p>{error}</p>;
  const groups = [...pitchIndex.clustersByTolerance[tol]].sort((a, b) => a.repHz - b.repHz);

  return (
    <div>
      <div className="mb-3 flex gap-2">{(['5', '15', '30'] as const).map((v) => <button key={v} className="rounded-md border px-2 py-1" onClick={() => setTol(v)}>{v}c</button>)}</div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Link key={g.groupId} to={`/bar/${g.repBarId}?clusterTol=${tol}`} className="rounded-xl border border-rim bg-surface/60 p-3">
            <div className="font-semibold">{g.repBarId}</div>
            <div>{formatHz(g.repHz).text} Hz</div>
            <div>{g.stats.count} members</div>
            <div>Spread {g.stats.maxCentsSpread.toFixed(2)}c</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
