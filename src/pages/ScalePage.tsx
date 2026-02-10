import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDataset } from '../data/useDataset';
import { useAudio } from '../audio/AudioContextProvider';
import type { ScaleId } from '../data/types';
import { formatHz } from '../lib/format';

export function ScalePage() {
  const { scaleId } = useParams();
  const { bars, scales, loading, error } = useDataset();
  const { playBar, canPlay } = useAudio();
  const sid = scaleId as ScaleId;
  const scale = scales.find((s) => s.scaleId === sid);
  const rows = useMemo(() => bars.filter((b) => b.scaleId === sid).sort((a, b) => a.step - b.step || a.barId.localeCompare(b.barId)), [bars, sid]);
  if (loading) return <p>Loading…</p>;
  if (error || !scale) return <p>Scale not found.</p>;

  const playScale = async () => {
    for (const bar of rows) {
      void playBar(bar.barId);
      await new Promise((r) => setTimeout(r, 180));
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">{scale.title}</h1>
      <button className="rounded-md border px-2 py-1" onClick={playScale}>Play scale in order</button>
      {rows.map((bar) => (
        <div key={bar.barId} className="flex justify-between rounded-xl border border-rim bg-surface/60 p-2">
          <Link to={`/bar/${bar.barId}`}>{bar.barId}</Link>
          <span>{bar.stepName}</span><span>{formatHz(bar.hz)} Hz</span>
          <button disabled={!canPlay(bar.barId)} onClick={() => playBar(bar.barId)}>Play</button>
        </div>
      ))}
    </div>
  );
}
