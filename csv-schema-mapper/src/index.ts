import { parseCsv, parseCsvStream } from './parser.js';
import { suggestMappings, norm } from './matching.js';
import { validateSchema, isSafeKey } from './schema.js';
import { convertValue, OMIT } from './transformers.js';
import { ConversionError, CsvParseError } from './errors.js';
import type { SafeError } from './errors.js';
import { serializeCsv } from './serializer.js';
import type { Mapping, MapperOptions, MappingResult, RowResult, Schema } from './types.js';

export { parseCsv, CsvParseError, serializeCsv, suggestMappings };
export type { CsvRecord } from './parser.js';
export type { FieldSchema, FieldType, Schema, ParserOptions, MatchingOptions, MapperOptions, Mapping, MappingResult, RowResult } from './types.js';
export type { SafeError } from './errors.js';
export type { SerializeOptions } from './serializer.js';

function maxErrorCount(options: MapperOptions): number {
  const n = options.maxErrors ?? 1_000;
  if (!Number.isSafeInteger(n) || n < 1) throw new TypeError('maxErrors must be a positive safe integer');
  return n;
}
function chooseMappings(headers: string[], schema: Schema, options: MapperOptions): { mappings: Mapping[]; errors: SafeError[]; fatal: boolean; fatalCode?: string } {
  const maxErrors = maxErrorCount(options), errors: SafeError[] = [];
  let setupTruncated = false;
  const add = (e: SafeError) => { if (errors.length < maxErrors) errors.push(e); else setupTruncated = true; };
  const duplicatePolicy = options.duplicateHeaders ?? 'error';
  if (!['error', 'first', 'last'].includes(duplicatePolicy)) throw new TypeError('Invalid duplicateHeaders option');
  if (options.unknownHeaders !== undefined && !['ignore', 'error'].includes(options.unknownHeaders)) throw new TypeError('Invalid unknownHeaders option');
  const normalizedHeaders = headers.map(h => norm(h, options.matching ?? {}));
  const duplicateIndexes = new Set<number>();
  for (let i = 0; i < headers.length; i++) {
    const prior = normalizedHeaders.indexOf(normalizedHeaders[i]!);
    if (prior !== i) {
      duplicateIndexes.add(i); duplicateIndexes.add(prior);
      if (duplicatePolicy === 'error') add({ code: 'DUPLICATE_HEADER', message: 'CSV header contains duplicate column names', row: 1 });
    }
  }
  const explicit = options.mappings ?? {};
  const automaticSchema: Schema = {};
  for (const field of Object.keys(schema)) if (!Object.prototype.hasOwnProperty.call(explicit, field)) automaticSchema[field] = schema[field]!;
  const baseMappings = suggestMappings(headers, automaticSchema, { ...options.matching, suggestions: false }, duplicatePolicy);
  if (options.matching?.suggestions) {
    const fuzzySchema: Schema = {};
    for (const base of baseMappings) if (base.index === null) fuzzySchema[base.field] = schema[base.field]!;
    if (Object.keys(fuzzySchema).length) {
      const proposed = suggestMappings(headers, fuzzySchema, options.matching, duplicatePolicy);
      const byField = new Map(proposed.map(m => [m.field, m]));
      for (let i = 0; i < baseMappings.length; i++) if (baseMappings[i]!.index === null && byField.get(baseMappings[i]!.field)?.method === 'suggestion') baseMappings[i] = byField.get(baseMappings[i]!.field)!;
    }
  }
  const automaticByField = new Map(baseMappings.map(m => [m.field, m]));
  const mappings: Mapping[] = Object.keys(schema).map(field => automaticByField.get(field) ?? { field, column: null, index: null, confidence: 0, method: 'missing' });
  const dangerousHeader = headers.some(h => !isSafeKey(h));
  if (dangerousHeader) add({ code: 'UNSAFE_HEADER', message: 'CSV header contains a forbidden column name', row: 1 });
  for (const field of Object.keys(explicit)) if (!Object.prototype.hasOwnProperty.call(schema, field) || !isSafeKey(field)) throw new TypeError('Explicit mapping refers to an unknown or forbidden schema field');
  const explicitFields = new Set(Object.keys(explicit));
  for (let k = 0; k < mappings.length; k++) {
    const current = mappings[k]!;
    if (!Object.prototype.hasOwnProperty.call(explicit, current.field)) continue;
    const target = explicit[current.field];
    let index: number;
    if (typeof target === 'number') {
      if (!Number.isSafeInteger(target) || target < 0) throw new TypeError(`Invalid explicit column index for ${current.field}`);
      index = target;
    } else {
      if (typeof target !== 'string') throw new TypeError(`Invalid explicit column for ${current.field}`);
      index = normalizedHeaders.findIndex(h => h === norm(target, options.matching ?? {}));
      if (duplicatePolicy === 'last' && index >= 0) index = normalizedHeaders.lastIndexOf(norm(target, options.matching ?? {}));
    }
    if (index < 0 || index >= headers.length) {
      mappings[k] = { field: current.field, column: null, index: null, confidence: 0, method: 'missing' };
      add({ code: 'MISSING_MAPPING', message: 'Explicit mapping does not match a CSV column', row: 1, field: current.field });
    } else mappings[k] = { field: current.field, column: headers[index]!, index, confidence: 1, method: 'explicit' };
  }
  // Duplicate policy resolves otherwise ambiguous automatic matches consistently.
  if (duplicatePolicy !== 'error') {
    for (let k = 0; k < mappings.length; k++) {
      const m = mappings[k]!; if (m.index === null) continue;
      if (explicitFields.has(m.field)) continue;
      const all = normalizedHeaders.reduce<number[]>((acc, value, idx) => { if (value === normalizedHeaders[m.index!]!) acc.push(idx); return acc; }, []);
      const index = duplicatePolicy === 'last' ? all.at(-1)! : all[0]!;
      mappings[k] = { ...m, column: headers[index]!, index };
    }
  }
  const used = new Set(mappings.flatMap(m => m.index === null ? [] : [m.index]));
  if (options.unknownHeaders === 'error') for (let i = 0; i < headers.length; i++) if (!used.has(i)) add({ code: 'UNKNOWN_HEADER', message: 'CSV contains a column that is not mapped by the schema', row: 1 });
  for (const m of mappings) if (m.index === null) add({ code: 'MISSING_MAPPING', message: 'No CSV column matches this schema field', row: 1, field: m.field });
  const fatal = dangerousHeader || (duplicatePolicy === 'error' && duplicateIndexes.size > 0);
  if (setupTruncated && errors.length) errors[errors.length - 1] = { code: 'MAX_ERRORS', message: 'Maximum error count reached', row: 1 };
  return { mappings, errors, fatal, ...(fatal ? { fatalCode: dangerousHeader ? 'UNSAFE_HEADER' : 'DUPLICATE_HEADER' } : {}) };
}

function mapOne(record: { values: string[]; row: number }, schema: Schema, mappings: Mapping[], maxErrors: number, isFatal: boolean, headerWidth: number, fatalCode = 'DUPLICATE_HEADER'): RowResult {
  const errors: SafeError[] = [];
  if (isFatal) return { row: record.row, data: null, errors: [{ code: fatalCode, message: 'Rows cannot be mapped because the CSV header is invalid', row: record.row }] };
  if (record.values.length !== headerWidth) return { row: record.row, data: null, errors: [{ code: 'ROW_WIDTH', message: 'CSV row has a different number of columns than the header', row: record.row }] };
  const data: Record<string, unknown> = {};
  for (const mapping of mappings) {
    const def = schema[mapping.field]!;
    const raw = mapping.index === null ? '' : record.values[mapping.index] ?? '';
    try {
      const value = convertValue(raw, def);
      if (value === OMIT) {
        if (def.required) errors.push({ code: 'REQUIRED', message: 'A required value is missing', row: record.row, field: mapping.field });
      } else Object.defineProperty(data, mapping.field, { value, enumerable: true, writable: true, configurable: true });
    } catch (error) {
      errors.push({ code: error instanceof ConversionError ? 'CONVERSION' : 'TRANSFORM', message: error instanceof ConversionError ? 'Value cannot be converted to the declared field type' : 'Field transformation failed', row: record.row, field: mapping.field });
    }
    if (errors.length >= maxErrors) {
      errors[errors.length - 1] = { code: 'MAX_ERRORS', message: 'Maximum error count reached', row: record.row };
      break;
    }
  }
  return { row: record.row, data: errors.length ? null : data, errors: errors.slice(0, maxErrors) };
}

export function createMapper(schema: Schema, options: MapperOptions = {}) {
  validateSchema(schema); maxErrorCount(options);
  const fieldKeys = Object.keys(schema);
  if (fieldKeys.some(key => !isSafeKey(key))) throw new TypeError('Schema contains a forbidden field name');
  const mapStream = async function* (input: AsyncIterable<string | Uint8Array>): AsyncGenerator<RowResult> {
    let headers: string[] | undefined, mappingInfo: Mapping[] = [], setupErrors: SafeError[] = [], fatal = false, fatalCode = 'DUPLICATE_HEADER', remainingErrors = maxErrorCount(options), first = true;
    const emitSetup = () => {
      if (!setupErrors.length || remainingErrors <= 0) return [] as SafeError[];
      const out = setupErrors.slice(0, remainingErrors).map(e => ({ ...e })); remainingErrors -= out.length; setupErrors = []; return out;
    };
    try {
      for await (const record of parseCsvStream(input, options.parser)) {
        if (headers === undefined) {
          headers = record.values;
          const prepared = chooseMappings(headers, schema, options); mappingInfo = prepared.mappings; setupErrors = prepared.errors; fatal = prepared.fatal; fatalCode = prepared.fatalCode ?? fatalCode;
          continue;
        }
        const result = mapOne(record, schema, mappingInfo, Math.max(1, remainingErrors), fatal, headers.length, fatalCode);
        const extras = first ? emitSetup() : []; first = false;
        const rowErrors = result.errors.slice(0, remainingErrors); remainingErrors -= rowErrors.length;
        const emittedErrors = [...extras, ...rowErrors];
        if (remainingErrors <= 0 && (result.errors.length || extras.length) && emittedErrors.length) emittedErrors[emittedErrors.length - 1] = { code: 'MAX_ERRORS', message: 'Maximum error count reached', row: record.row };
        yield { ...result, data: result.errors.length > rowErrors.length ? null : result.data, errors: emittedErrors };
        if (remainingErrors <= 0 && (result.errors.length || extras.length)) return;
      }
      if (headers !== undefined && first && setupErrors.length) yield { row: 1, data: null, errors: emitSetup() };
    } catch (error) {
      if (!(error instanceof CsvParseError)) throw error;
      const e: SafeError = { code: error.code, message: error.message, ...(error.row === undefined ? {} : { row: error.row }) };
      if (remainingErrors > 0) yield { row: e.row ?? (headers ? 2 : 1), data: null, errors: [e] };
    }
  };
  const map = (csv: string): MappingResult => {
    let headers: string[] = [];
    let mappings: Mapping[] = [];
    const errors: SafeError[] = [], rows: Record<string, unknown>[] = [];
    let truncated = false;
    const add = (items: SafeError[]) => {
      for (const e of items) {
        if (errors.length < maxErrorCount(options)) errors.push(e);
        else truncated = true;
      }
    };
    try {
      const records = parseCsv(csv, options.parser);
      if (records.length) {
        headers = records[0]!.values;
        const prepared = chooseMappings(headers, schema, options); mappings = prepared.mappings; add(prepared.errors);
        for (const record of records.slice(1)) {
          if (errors.length >= maxErrorCount(options)) { truncated = true; break; }
          const result = mapOne(record, schema, mappings, maxErrorCount(options) - errors.length, prepared.fatal, headers.length, prepared.fatalCode);
          add(result.errors); if (result.data && !result.errors.length) rows.push(result.data);
        }
      }
    } catch (error) {
      if (!(error instanceof CsvParseError)) throw error;
      add([{ code: error.code, message: error.message, ...(error.row === undefined ? {} : { row: error.row }) }]);
    }
    if (truncated && errors.length) errors[errors.length - 1] = { code: 'MAX_ERRORS', message: 'Maximum error count reached', ...(errors[errors.length - 1]!.row === undefined ? {} : { row: errors[errors.length - 1]!.row }) };
    return { rows, errors, mappings, headers };
  };
  return { map, mapStream };
}
