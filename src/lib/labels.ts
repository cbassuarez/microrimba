export function prettyInstrumentLabel(
  scaleId: string,
  instrumentId: string,
  edo?: number | 'harmonic',
) {
  if (scaleId === 'harmonic') return 'C Overtone Marimba';
  if (typeof edo === 'number') return `${edo}-EDO Marimba`;

  const m = scaleId.match(/^(\d+)edo$/);
  if (m) return `${m[1]}-EDO Marimba`;

  return instrumentId
    .replace(/_/g, ' ')
    .replace(/\bMICRORIMBA\b/g, 'Marimba')
    .replace(/\bEDO\b/g, 'EDO');
}
