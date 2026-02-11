import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDataset } from '../data/useDataset';
import { useAudio } from '../audio/AudioContextProvider';
import type { ScaleId } from '../data/types';
import { formatHz } from '../lib/format';
import { prettyInstrumentLabel } from '../lib/labels';
import { Meta } from '../components/Meta';

export function ScalePage() {
  const { scaleId } = useParams();
  const { bars, scales, loading, error } = useDataset();
  const { playBar, canPlay, playSequenceByBarIds } = useAudio();
  const sid = scaleId as ScaleId;
  const scale = scales.find((s) => s.scaleId === sid);
  const rows = useMemo(() => bars.filter((b) => b.scaleId === sid).sort((a, b) => a.step - b.step || a.barId.localeCompare(b.barId)), [bars, sid]);
  if (loading) return <><Meta title={scale?.title ?? scaleId ?? 'Scale'} description="Playable profile: measured pitches, range, tuning notes." canonicalPath={scaleId ? `/scale/${scaleId}` : '/scale'} /><p>Loading…</p></>;
  if (error || !scale) return <><Meta title={scaleId ?? 'Scale'} description="Playable profile: measured pitches, range, tuning notes." canonicalPath={scaleId ? `/scale/${scaleId}` : '/scale'} /><p>Scale not found.</p></>;

  const playScale = async () => {
    await playSequenceByBarIds(rows.map((bar) => bar.barId), sid === 'harmonic'
      ? { intervalMs: 220, overlapMs: 0, mode: 'expAccelerando', expFactor: 0.92, minIntervalMs: 25, gain: 0.9 }
      : { intervalMs: 200, overlapMs: 0, mode: 'constant', gain: 0.9 });
  };

  return (
    <>
      <Meta title={scale.title} description="Playable profile: measured pitches, range, tuning notes." canonicalPath={`/scale/${sid}`} />
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">{scale.title}</h1>
      <button className="rounded-md border px-2 py-1" onClick={playScale}>Play scale in order</button>
      {rows.map((bar) => (
        <div key={bar.barId} className="flex justify-between rounded-xl border border-rim bg-surface/60 p-2">
          <Link to={`/bar/${bar.barId}`}>{bar.barId}</Link>
          <span>{bar.stepName}</span><span>{prettyInstrumentLabel(bar.scaleId, bar.instrumentId, bar.edo)}</span><span>{formatHz(bar.hz).text} Hz</span>
          <button disabled={!canPlay(bar.barId)} onClick={() => playBar(bar.barId)}>Play</button>
        </div>
      ))}
    </div>
    </>
  );
}
