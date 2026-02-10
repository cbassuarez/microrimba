export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function reduce(n: number, d: number): { n: number; d: number } {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return { n: 0, d: 1 };
  const sign = d < 0 ? -1 : 1;
  const nn = Math.trunc(n) * sign;
  const dd = Math.abs(Math.trunc(d));
  if (nn === 0) return { n: 0, d: 1 };
  const g = gcd(nn, dd);
  return { n: nn / g, d: dd / g };
}

export function approxFraction(x: number, maxDen = 4096, maxIter = 24): { n: number; d: number } {
  if (!Number.isFinite(x) || x <= 0) return { n: 0, d: 1 };

  let hPrev = 0;
  let h = 1;
  let kPrev = 1;
  let k = 0;
  let value = x;

  for (let i = 0; i < maxIter; i += 1) {
    const a = Math.floor(value);
    const hNext = a * h + hPrev;
    const kNext = a * k + kPrev;

    if (kNext > maxDen) {
      if (k === 0) return { n: 0, d: 1 };
      const t = Math.floor((maxDen - kPrev) / k);
      const bounded = reduce(t * h + hPrev, t * k + kPrev);
      return bounded;
    }

    hPrev = h;
    h = hNext;
    kPrev = k;
    k = kNext;

    const frac = value - a;
    if (frac < Number.EPSILON) break;
    value = 1 / frac;
  }

  return reduce(h, k || 1);
}

export function formatFraction(n: number, d: number): string {
  return `${n}/${d}`;
}

export function formatRatioAsFraction(x: number, maxDen = 4096): string {
  const { n, d } = approxFraction(x, maxDen);
  return formatFraction(n, d);
}

export function normalizeFracString(frac: string): string {
  const s = String(frac).trim();
  if (!s.includes('/')) return `${s}/1`;
  const [a, b] = s.split('/').map((x) => x.trim());
  if (!a || !b) return `${a || '1'}/${b || '1'}`;
  return `${a}/${b}`;
}
