export const formatHz = (hz: number): string => {
  if (!Number.isFinite(hz) || hz <= 0) return '—';
  return hz.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
};
