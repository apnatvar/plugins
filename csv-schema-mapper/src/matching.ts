import type { FieldSchema, MatchingOptions, Mapping, Schema } from './types.js';
import { validateSchema, isSafeKey } from './validator.js';

function norm(value: string, options: MatchingOptions): string {
  let result = value.normalize(options.normalize === false ? 'NFC' : 'NFKC').trim();
  if (options.normalize !== false) result = result.replace(/[\s_-]+/g, ' ');
  if (options.caseInsensitive !== false) result = result.toLocaleLowerCase('en-US');
  return result;
}
function editDistance(a: string, b: string): number {
  if (a.length > b.length) [a, b] = [b, a];
  let previous = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    const current = [j];
    for (let i = 1; i <= a.length; i++) current[i] = Math.min(current[i - 1]! + 1, previous[i]! + 1, previous[i - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[a.length]!;
}
function score(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  return Math.max(0, 1 - editDistance(a, b) / Math.max(a.length, b.length));
}
function mapping(field: string, headers: string[], index: number | null, confidence: number, method: Mapping['method']): Mapping {
  return { field, column: index === null ? null : headers[index]!, index, confidence, method };
}
export function suggestMappings(headers: string[], schema: Schema, options: MatchingOptions = {}, duplicatePolicy: 'error' | 'first' | 'last' = 'error'): Mapping[] {
  validateSchema(schema);
  if (!Array.isArray(headers) || headers.length > 10_000 || Object.keys(schema).length > 1_000) throw new Error('Matching input exceeds supported bounds');
  if (headers.some(h => typeof h !== 'string' || h.length > 512)) throw new Error('Matching input exceeds supported bounds');
  const result: Mapping[] = [];
  let dpCells = 0;
  const suggestions = options.suggestions === true;
  const minConfidence = options.minConfidence ?? 0.65;
  if (typeof minConfidence !== 'number' || minConfidence < 0 || minConfidence > 1) throw new Error('minConfidence must be between 0 and 1');
  const normalized = headers.map(h => norm(h, options));
  if (normalized.some(h => h.length > 512) || normalized.length * Math.max(1, Object.keys(schema).length) > 1_000_000) throw new Error('Matching input exceeds supported bounds');
  const headerIndexes = new Map<string, number[]>();
  for (let i = 0; i < normalized.length; i++) {
    const indexes = headerIndexes.get(normalized[i]!) ?? []; indexes.push(i); headerIndexes.set(normalized[i]!, indexes);
  }
  for (const field of Object.keys(schema)) {
    if (!isSafeKey(field)) throw new Error('Unsafe schema field name');
    const aliases = (schema[field] as FieldSchema).aliases ?? [];
    const names = [field, ...aliases].map(alias => norm(alias, options));
    if (suggestions && normalized.length * names.length > 2_048) throw new Error('Suggestion workload exceeds supported bounds');
    let found = -1, method: Mapping['method'] = 'missing', confidence = 0, ambiguous = false;
    const pick = (candidates: number[]): number => {
      if (candidates.length > 1 && duplicatePolicy === 'error') { ambiguous = true; return -1; }
      return duplicatePolicy === 'last' ? candidates.at(-1) ?? -1 : candidates[0] ?? -1;
    };
    const exact = headerIndexes.get(names[0]!) ?? [];
    if (exact.length) { found = pick(exact); if (found >= 0) { method = 'exact'; confidence = 1; } }
    else {
      const aliasCandidates = [...new Set(names.slice(1).flatMap(name => headerIndexes.get(name) ?? []))];
      if (aliasCandidates.length > 1) ambiguous = true;
      else if (aliasCandidates.length === 1) { found = aliasCandidates[0]!; method = 'alias'; confidence = 1; }
    }
    if (found < 0 && suggestions && !ambiguous) {
      let best = 0, bestIndex = -1, tied = false;
      for (let i = 0; i < normalized.length; i++) for (let j = 0; j < names.length; j++) {
        if (normalized[i]!.length > 128 || names[j]!.length > 128) continue;
        dpCells += (normalized[i]!.length + 1) * (names[j]!.length + 1);
        if (dpCells > 2_000_000) throw new Error('Suggestion workload exceeds supported bounds');
        const candidate = score(normalized[i]!, names[j]!);
        if (candidate > best) { best = candidate; bestIndex = i; tied = false; }
        else if (candidate === best && candidate > 0 && bestIndex !== i) tied = true;
      }
      if (best >= minConfidence && !tied) { found = bestIndex; method = 'suggestion'; confidence = best; } else found = -1;
    }
    result.push(mapping(field, headers, found < 0 ? null : found, confidence, method));
  }
  return result;
}

export { norm };
