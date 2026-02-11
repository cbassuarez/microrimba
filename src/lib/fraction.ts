export function parseFracString(input: string): { p: number; q: number } {
  if (typeof input !== 'string') return { p: 1, q: 1 };
  const trimmed = input.trim();
  if (!trimmed) return { p: 1, q: 1 };

  const parts = trimmed.split('/');
  if (parts.length === 1) {
    const p = Number.parseInt(parts[0], 10);
    return Number.isFinite(p) && p !== 0 ? { p, q: 1 } : { p: 1, q: 1 };
  }

  const p = Number.parseInt(parts[0], 10);
  const q = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) return { p: 1, q: 1 };
  return reduce(p, q);
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

export function reduce(p: number, q: number): { p: number; q: number } {
  if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) return { p: 1, q: 1 };
  if (p === 0) return { p: 0, q: 1 };
  const sign = q < 0 ? -1 : 1;
  const pp = Math.trunc(p) * sign;
  const qq = Math.abs(Math.trunc(q));
  const g = gcd(pp, qq);
  return { p: pp / g, q: qq / g };
}

export function primeFactorExponents(n: number): Map<number, number> {
  const result = new Map<number, number>();
  let value = Math.abs(Math.trunc(n));
  if (value < 2) return result;

  while (value % 2 === 0) {
    result.set(2, (result.get(2) ?? 0) + 1);
    value /= 2;
  }

  let d = 3;
  while (d * d <= value) {
    while (value % d === 0) {
      result.set(d, (result.get(d) ?? 0) + 1);
      value /= d;
    }
    d += 2;
  }

  if (value > 1) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

export function factorFrac(p: number, q: number): Map<number, number> {
  const { p: rp, q: rq } = reduce(p, q);
  const numer = primeFactorExponents(Math.abs(rp));
  const denom = primeFactorExponents(rq);
  const result = new Map<number, number>();

  for (const [prime, exp] of numer.entries()) result.set(prime, (result.get(prime) ?? 0) + exp);
  for (const [prime, exp] of denom.entries()) result.set(prime, (result.get(prime) ?? 0) - exp);

  return result;
}
