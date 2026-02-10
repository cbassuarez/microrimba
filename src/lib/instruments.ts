import type { Bar, InstrumentsJson, ScaleId } from '../data/types';

export function getBarsForInstrument(bars: Bar[], instrumentId: string) {
  return bars.filter((bar) => bar.instrumentId === instrumentId);
}

export function getInstrumentMeta(instruments: InstrumentsJson, instrumentId: string) {
  return instruments.find((instrument) => instrument.instrumentId === instrumentId) ?? null;
}

export function getDefaultInstrumentForScale(instruments: InstrumentsJson, scaleId: ScaleId) {
  const matches = instruments.filter((instrument) => instrument.scaleId === scaleId).sort((a, b) => a.instrumentId.localeCompare(b.instrumentId));
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0].instrumentId;
  return matches[0].instrumentId;
}
