import type { Decimal, RoundingMode } from './types.js';

export const SCALE = 10n ** 12n;
const MAX = 999999999999999n * SCALE;
/** Fixed 12-place decimal, bounded to 15 integral digits. No exponent syntax. */
export function parseDecimal(value: Decimal): bigint {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Invalid decimal');
  if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) throw new Error('Unsafe number');
  const text = String(value);
  if (text.length > 29 || !/^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,12})?$/.test(text)) throw new Error('Invalid decimal syntax or precision');
  const [whole = '', fraction = ''] = text.replace(/^-/, '').split('.');
  const result = (BigInt(whole) * SCALE + BigInt(fraction.padEnd(12, '0'))) * (text.startsWith('-') ? -1n : 1n);
  if (result > MAX || result < -MAX) throw new Error('Decimal magnitude exceeded');
  return result;
}
export function divideRounded(n: bigint, d: bigint, mode: RoundingMode): bigint {
  const sign = n < 0n ? -1n : 1n;
  const positive = n < 0n ? -n : n;
  const q = positive / d; const r = positive % d;
  const increment = mode !== 'toward-zero' && (r * 2n > d || (r * 2n === d && (mode === 'half-up' || q % 2n !== 0n)));
  return sign * (q + (increment ? 1n : 0n));
}
/** Returns fixed-scale units rounded to currency precision. */
export function quantize(value: bigint, precision: number, mode: RoundingMode): bigint {
  const factor = 10n ** BigInt(12 - precision);
  return divideRounded(value, factor, mode) * factor;
}
/** Percent of fixed-scale base. Use moneyPercentage for a single currency rounding. */
export function percentage(base: bigint, rate: bigint): bigint { return base * rate / (100n * SCALE); }
export function moneyProduct(a: bigint, b: bigint, precision: number, mode: RoundingMode): bigint {
  const factor = 10n ** BigInt(12 - precision);
  return divideRounded(a * b, SCALE * factor, mode) * factor;
}
export function moneyPercentage(base: bigint, rate: bigint, precision: number, mode: RoundingMode): bigint {
  const factor = 10n ** BigInt(12 - precision);
  return divideRounded(base * rate, 100n * SCALE * factor, mode) * factor;
}
export function formatDecimal(value: bigint, precision = 12): string {
  const absolute = value < 0n ? -value : value;
  const fraction = (absolute % SCALE).toString().padStart(12, '0').slice(0, precision);
  return `${value < 0n ? '-' : ''}${absolute / SCALE}${precision ? '.' + fraction : ''}`;
}
