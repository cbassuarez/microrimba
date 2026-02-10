import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useDataset } from '../data/useDataset';
import { useAudio } from '../audio/AudioContextProvider';
import { formatHz } from '../lib/format';
import { prettyInstrumentLabel } from '../lib/labels';

export function BarDetailPage() {
  const { barId = '' } = useParams();
  const [params] = useSearchParams();
  const tol = (params.get('clusterTol') as '5' | '15' | '30' | null) ?? '15';
  const { bars, pitchIndex, loading, error } = useDataset();
  const { playBar, canPlay } = useAudio();
  const bar = bars.find((b) => b.barId === barId);
  const order = pitchIndex?.allBarsSorted ?? [];
  const idx = order.indexOf(barId);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  const cluster = useMemo(() => pitchIndex?.clustersByTolerance[tol].find((g) => g.members.includes(barId)), [barId, pitchIndex, tol]);
  if (loading) return <p>Loading…</p>;
  if (error || !bar || !pitchIndex) return <p>Bar not found</p>;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">{bar.barId}</h1>
      <div>{formatHz(bar.hz).text} Hz · {prettyInstrumentLabel(bar.scaleId, bar.instrumentId, bar.edo)} · {bar.scaleId}</div>
      <button disabled={!canPlay(bar.barId)} onClick={() => playBar(bar.barId)} className="rounded-md border px-3 py-1">Play</button>
      <div className="rounded-xl border border-rim bg-surface/60 p-3 text-sm">
        <div>stepName: {bar.stepName}</div><div>centsFromStep0: {bar.centsFromStep0}</div><div>ratioToStep0: {bar.ratioToStep0}</div>
      </div>
      <div className="flex gap-2">{prev && <Link to={`/bar/${prev}`}>Prev</Link>}{next && <Link to={`/bar/${next}`}>Next</Link>}</div>
      {cluster && (
        <div className="rounded-xl border border-rim bg-surface/60 p-3">
          <div>Cluster ({tol}c): {cluster.groupId}</div>
          {cluster.members.map((m) => <div key={m}><Link to={`/bar/${m}`}>{m}</Link></div>)}
        </div>
      )}
    </div>
  );
}
