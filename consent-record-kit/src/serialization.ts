import type { Receipt } from './types.js';
import { assertReceipt, fail, MAX_RECEIPT_BYTES } from './validation.js';
/** Version 1 uses UTF-16 code-unit key order and JSON string escaping; no Unicode normalization. */
export function orderedJSON(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(orderedJSON).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + orderedJSON(obj[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
export function snapshot(receipt: Receipt): Receipt {
  assertReceipt(receipt);
  return Object.freeze({
    schemaVersion: receipt.schemaVersion, type: receipt.type, id: receipt.id,
    timestamp: receipt.timestamp, subject: Object.freeze({namespace: receipt.subject.namespace, id: receipt.subject.id}),
    policyVersion: receipt.policyVersion,
    purposes: Object.freeze(receipt.purposes.map(p => Object.freeze({id: p.id, granted: p.granted})).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    ...(receipt.previousRecordId === undefined ? {} : {previousRecordId: receipt.previousRecordId}),
  });
}
export function canonicalize(receipt: Receipt): string { return orderedJSON(snapshot(receipt)); }
export const exportReceipt = canonicalize;
export function parseReceipt(json: string, options: {maxBytes?: number} = {}): Receipt {
  const max = options.maxBytes ?? MAX_RECEIPT_BYTES;
  if (!Number.isInteger(max) || max < 1 || max > MAX_RECEIPT_BYTES) fail('$', 'size', 'Invalid size limit');
  if (typeof json !== 'string' || json.length > max || Buffer.byteLength(json, 'utf8') > max) fail('$', 'size', 'Input exceeds byte limit');
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { fail('$', 'json', 'Malformed JSON'); }
  assertReceipt(parsed);
  // JSON.parse accepts duplicate keys. Require the accepted JSON spelling to be canonical:
  // this also prevents different parsers interpreting ambiguous JSON differently.
  const result = snapshot(parsed);
  if (json !== canonicalize(result)) fail('$', 'canonical', 'Expected canonical JSON without duplicate keys or alternate formatting');
  return result;
}
