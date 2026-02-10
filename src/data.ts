import { barsSchema, instrumentsSchema, samplesSchema, scalesSchema, type Bar, type Instrument, type Sample, type Scale } from './models';

type DataBundle = {
  bars: Bar[];
  scales: Scale[];
  instruments: Instrument[];
  samples: Sample[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function loadData(): Promise<DataBundle> {
  const [barsRaw, scalesRaw, instrumentsRaw, samplesRaw] = await Promise.all([
    fetchJson<unknown[]>('/data/bars/bars.json'),
    fetchJson<unknown[]>('/data/bars/scales.json'),
    fetchJson<unknown[]>('/data/bars/instruments.json'),
    fetchJson<unknown[]>('/data/bars/samples.json'),
  ]);

  return {
    bars: barsSchema.parse(barsRaw),
    scales: scalesSchema.parse(scalesRaw),
    instruments: instrumentsSchema.parse(instrumentsRaw),
    samples: samplesSchema.parse(samplesRaw),
  };
}
