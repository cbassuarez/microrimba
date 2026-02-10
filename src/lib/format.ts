export function formatHz(freq: number): { text: string; approx: boolean } {
  if (!Number.isFinite(freq) || freq <= 0) return { text: '—', approx: false };

  const decimals = freq < 100 ? 3 : freq < 1000 ? 2 : 1;
  const roundedText = freq.toFixed(decimals);
  const rounded = Number(roundedText);
  const threshold = 10 ** -(decimals + 1);
  const approx = Math.abs(rounded - freq) > threshold;

  return {
    text: approx ? `≈ ${roundedText}` : roundedText,
    approx,
  };
}

export const formatHzSimple = (hz: number): string => formatHz(hz).text;
