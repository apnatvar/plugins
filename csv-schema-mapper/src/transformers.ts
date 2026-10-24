import type { FieldSchema } from './types.js';
import { ConversionError, TransformError } from './errors.js';

const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
function validDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const max = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
  return d <= max;
}
function convertDate(raw: string, format: FieldSchema['format']): Date | string {
  const dm = DATE_RE.exec(raw);
  if (dm) {
    const y = Number(dm[1]), m = Number(dm[2]), d = Number(dm[3]);
    if (!validDay(y, m, d)) throw new ConversionError();
    if (format === 'date-only') return raw;
    const value = new Date(0); value.setUTCHours(0, 0, 0, 0); value.setUTCFullYear(y, m - 1, d); return value;
  }
  if (format === 'date-only') throw new ConversionError();
  const match = DATETIME_RE.exec(raw);
  if (!match) throw new ConversionError();
  const [, ys, ms, ds, hs, mins, ss, , zone] = match;
  const y = Number(ys), m = Number(ms), d = Number(ds), h = Number(hs), min = Number(mins), sec = Number(ss);
  if (!validDay(y, m, d) || h > 23 || min > 59 || sec > 59) throw new ConversionError();
  if (zone !== 'Z') {
    if (zone === undefined) throw new ConversionError();
    const [zh, zm] = zone.slice(1).split(':').map(Number);
    if (zh! > 14 || zm! > 59 || (zh === 14 && zm !== 0)) throw new ConversionError();
  }
  const value = new Date(raw);
  if (!Number.isFinite(value.getTime())) throw new ConversionError();
  return value;
}
export function convertValue(rawValue: string, schema: FieldSchema): unknown {
  const raw = schema.trim === false ? rawValue : rawValue.trim();
  if (raw === '') {
    const empty = schema.emptyValue ?? 'omit';
    if (empty === 'null') { if (!schema.nullable) throw new ConversionError(); return null; }
    if (empty === 'empty') { if (schema.type !== 'string') throw new ConversionError(); return ''; }
    return OMIT;
  }
  if (schema.transform) {
    let value: unknown;
    try { value = schema.transform(raw); } catch { throw new TransformError(); }
    if (!validTransformedValue(value, schema)) throw new TransformError();
    return value;
  }
  switch (schema.type) {
    case 'string': return raw;
    case 'number': {
      if (!NUMBER_RE.test(raw)) throw new ConversionError();
      const n = Number(raw); if (!Number.isFinite(n) || (Number.isInteger(n) && !Number.isSafeInteger(n)) || (n === 0 && /[1-9]/.test(raw.split(/[eE]/, 1)[0]!))) throw new ConversionError(); return n;
    }
    case 'boolean':
      if (/^(?:true|1)$/i.test(raw)) return true;
      if (/^(?:false|0)$/i.test(raw)) return false;
      throw new ConversionError();
    case 'date': return convertDate(raw, schema.format);
    default: throw new ConversionError();
  }
}
export const OMIT: unique symbol = Symbol('omit');
function validTransformedValue(value: unknown, schema: FieldSchema): boolean {
  if (value === null) return schema.nullable === true;
  switch (schema.type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
    case 'boolean': return typeof value === 'boolean';
    case 'date':
      if (value instanceof Date) return Number.isFinite(value.getTime());
      if (schema.format === 'date-only' && typeof value === 'string') {
        const match = DATE_RE.exec(value);
        return !!match && validDay(Number(match[1]), Number(match[2]), Number(match[3]));
      }
      return false;
  }
}
