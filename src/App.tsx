import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { loadData } from './data';
import type { Bar, Sample, Scale } from './models';

type DataState = Awaited<ReturnType<typeof loadData>>;

function useData() {
  const [data, setData] = useState<DataState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData().then(setData).catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return { data, error };
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container">
      <header>
        <h1>Microrimba Explorer</h1>
        <nav>
          <Link to="/">Home</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}

function HomePage({ data }: { data: DataState }) {
  return (
    <div className="grid">
      <section>
        <h2>Scales</h2>
        <ul>
          {data.scales.map((scale) => (
            <li key={scale.scale_id}>
              <Link to={`/scale/${scale.scale_id}`}>{scale.label}</Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Instruments</h2>
        <ul>
          {data.instruments.map((inst) => (
            <li key={inst.instrument_id}>{inst.label}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function findSample(samplesByBar: Map<string, Sample[]>, barId: string): Sample | undefined {
  return samplesByBar.get(barId)?.[0];
}

function ScalePage({ data }: { data: DataState }) {
  const { scaleId } = useParams();
  const bars = useMemo(() => data.bars.filter((bar) => bar.scale_id === scaleId), [data.bars, scaleId]);
  const samplesByBar = useMemo(() => {
    const map = new Map<string, Sample[]>();
    for (const sample of data.samples) {
      const list = map.get(sample.bar_id) ?? [];
      list.push(sample);
      map.set(sample.bar_id, list);
    }
    return map;
  }, [data.samples]);

  if (!scaleId || !data.scales.find((scale) => scale.scale_id === scaleId)) {
    return <p>Scale not found.</p>;
  }

  return (
    <section>
      <h2>{scaleId}</h2>
      <table>
        <thead>
          <tr>
            <th>bar_id</th>
            <th>step_name</th>
            <th>freq_hz</th>
            <th>sample</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => {
            const sample = findSample(samplesByBar, bar.bar_id);
            return (
              <tr key={bar.bar_id}>
                <td>
                  <Link to={`/bar/${bar.bar_id}`}>{bar.bar_id}</Link>
                </td>
                <td>{bar.step_name}</td>
                <td>{bar.freq_hz.toFixed(3)}</td>
                <td>{sample ? <audio controls src={`/${sample.audio_path}`} preload="none" /> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function BarDetailPage({ data }: { data: DataState }) {
  const { barId } = useParams();
  const bar = data.bars.find((item) => item.bar_id === barId);

  if (!bar) {
    return <p>Bar not found.</p>;
  }

  const scale: Scale | undefined = data.scales.find((item) => item.scale_id === bar.scale_id);
  const step0Bar: Bar | undefined = data.bars.find((item) => item.scale_id === bar.scale_id && item.step === 0);
  const samples = data.samples.filter((sample) => sample.bar_id === bar.bar_id);

  const theoreticalHz =
    typeof scale?.edo === 'number' && step0Bar ? step0Bar.freq_hz * Math.pow(2, bar.step / scale.edo) : null;
  const measuredVsTheoreticalCents =
    theoreticalHz && theoreticalHz > 0 ? 1200 * Math.log2(bar.freq_hz / theoreticalHz) : null;

  return (
    <section>
      <h2>{bar.bar_id}</h2>
      <ul>
        <li>scale_id: {bar.scale_id}</li>
        <li>instrument_id: {bar.instrument_id}</li>
        <li>step_name: {bar.step_name}</li>
        <li>freq_hz (measured): {bar.freq_hz.toFixed(6)}</li>
        <li>ratio_to_step0: {bar.ratio_to_step0.toFixed(9)}</li>
        <li>source_manifest: {bar.source_manifest}</li>
      </ul>
      {theoreticalHz ? (
        <p>
          EDO theoretical frequency: {theoreticalHz.toFixed(6)} Hz ({measuredVsTheoreticalCents?.toFixed(3)} cents offset)
        </p>
      ) : (
        <p>Non-EDO scale; theoretical comparison not available.</p>
      )}

      <h3>Samples</h3>
      {samples.length ? (
        <ul>
          {samples.map((sample) => (
            <li key={sample.audio_path}>
              <audio controls src={`/${sample.audio_path}`} preload="none" />
              <div>
                {sample.audio_path} — {sample.duration_seconds.toFixed(2)}s @ {sample.sample_rate_hz} Hz, {sample.channels} ch
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No samples found for this bar.</p>
      )}
    </section>
  );
}

export function App() {
  const { data, error } = useData();

  if (error) {
    return <Layout><p>{error}</p></Layout>;
  }
  if (!data) {
    return <Layout><p>Loading…</p></Layout>;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage data={data} />} />
        <Route path="/scale/:scaleId" element={<ScalePage data={data} />} />
        <Route path="/bar/:barId" element={<BarDetailPage data={data} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
