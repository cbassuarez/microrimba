const HEJI2_SUPPORTED_PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]);

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

export function reduceFraction(p: number, q: number): { p: number; q: number } {
  if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) {
    return { p: 0, q: 1 };
  }
  if (p === 0) {
    return { p: 0, q: 1 };
  }
  const sign = q < 0 ? -1 : 1;
  const pp = Math.trunc(p) * sign;
  const qq = Math.abs(Math.trunc(q));
  const divisor = gcd(pp, qq);
  return { p: pp / divisor, q: qq / divisor };
}

export function factorizeInt(n: number): Map<number, number> {
  const factors = new Map<number, number>();
  let value = Math.abs(Math.trunc(n));

  if (value <= 1) {
    return factors;
  }

  let d = 2;
  while (d * d <= value) {
    while (value % d === 0) {
      factors.set(d, (factors.get(d) ?? 0) + 1);
      value /= d;
    }
    d += d === 2 ? 1 : 2;
  }

  if (value > 1) {
    factors.set(value, (factors.get(value) ?? 0) + 1);
  }

  return factors;
}

export function maxPrimeFactorFromFactorMap(
  map: Map<number, number>,
  opts: { ignore?: number[] } = {},
): number {
  const ignore = new Set(opts.ignore ?? []);
  let max = 0;
  for (const [prime, exp] of map.entries()) {
    if (exp <= 0 || ignore.has(prime)) continue;
    if (prime > max) max = prime;
  }
  return max;
}

export function isSupportedByHeji2Factors(map: Map<number, number>): boolean {
  for (const [prime, exp] of map.entries()) {
    if (exp <= 0) continue;
    if (!HEJI2_SUPPORTED_PRIMES.has(prime) || prime > 31) {
      return false;
    }
  }
  return true;
}

export function getSupportedHeji2Primes(): number[] {
  return [...HEJI2_SUPPORTED_PRIMES].sort((a, b) => a - b);
}
