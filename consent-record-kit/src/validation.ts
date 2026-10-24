import { SCHEMA_VERSION, type Receipt, type ValidationIssue, type VerificationResult } from './types.js';
export const MAX_RECEIPT_BYTES = 65_536;
export class ValidationError extends Error {
  constructor(public readonly errors: readonly ValidationIssue[]) {
    super('Invalid consent record'); this.name = 'ValidationError';
  }
}
export function fail(path: string, code: string, message: string): never {
  throw new ValidationError([{ path, code, message }]);
}
/** Read only own data properties. Accessors, symbols and exotic prototypes are rejected. */
export function object(value: unknown, path: string, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    fail(path, 'object', 'Expected a plain data object');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !allowed.includes(key)) fail(path, 'field', 'Unexpected field');
    const descriptor = descriptors[key];
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) fail(path, 'field', 'Expected enumerable data properties');
  }
  return value as Record<string, unknown>;
}
export function string(value: unknown, path: string, max: number): asserts value is string {
  if (typeof value !== 'string' || !value.length || value.length > max || value.trim() !== value || /[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value))
    fail(path, 'string', 'Expected a bounded, nonempty string without controls or unpaired surrogates');
}
export function uuid(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value))
    fail(path, 'id', 'Expected a lowercase UUID v4');
}
export function assertReceipt(value: unknown): asserts value is Receipt {
  const r = object(value, '$', ['schemaVersion', 'type', 'id', 'timestamp', 'subject', 'policyVersion', 'purposes', 'previousRecordId']);
  if (r.schemaVersion !== SCHEMA_VERSION) fail('schemaVersion', 'version', 'Unsupported schema version');
  if (!['consent', 'withdrawal', 'supersession'].includes(r.type as string)) fail('type', 'type', 'Unknown record type');
  uuid(r.id, 'id');
  if (typeof r.timestamp !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.timestamp) || !Number.isFinite(Date.parse(r.timestamp)) || new Date(r.timestamp).toISOString() !== r.timestamp)
    fail('timestamp', 'timestamp', 'Expected an exact UTC ISO timestamp with milliseconds');
  const subject = object(r.subject, 'subject', ['namespace', 'id']);
  string(subject.namespace, 'subject.namespace', 64); string(subject.id, 'subject.id', 256);
  string(r.policyVersion, 'policyVersion', 128);
  if (!Array.isArray(r.purposes) || Object.getPrototypeOf(r.purposes) !== Array.prototype || r.purposes.length < 1 || r.purposes.length > 64)
    fail('purposes', 'purposes', 'Expected 1 to 64 purposes');
  // Reject array accessors, holes and attached properties before reading elements.
  const descriptors = Object.getOwnPropertyDescriptors(r.purposes);
  if (Reflect.ownKeys(descriptors).length !== r.purposes.length + 1) fail('purposes', 'array', 'Expected a dense data array');
  const ids = new Set<string>();
  for (let i = 0; i < r.purposes.length; i++) {
    const d = descriptors[String(i)];
    if (!d || !('value' in d) || !d.enumerable) fail('purposes', 'array', 'Expected a dense data array');
    const p = object(d.value, `purposes.${i}`, ['id', 'granted']);
    string(p.id, `purposes.${i}.id`, 128);
    if (typeof p.granted !== 'boolean') fail(`purposes.${i}.granted`, 'boolean', 'Expected a boolean');
    if (ids.has(p.id)) fail('purposes', 'duplicate', 'Purpose IDs must be unique');
    ids.add(p.id);
    if (r.type === 'withdrawal' && p.granted) fail('purposes', 'withdrawal', 'Withdrawal purposes must be false');
  }
  if (r.type === 'consent') {
    if (Object.hasOwn(r, 'previousRecordId')) fail('previousRecordId', 'link', 'Initial consent cannot reference a previous record');
  } else {
    uuid(r.previousRecordId, 'previousRecordId');
    if (r.previousRecordId === r.id) fail('previousRecordId', 'link', 'A record cannot reference itself');
  }
}
export function validateReceipt(value: unknown): VerificationResult {
  try { assertReceipt(value); return { valid: true, errors: [] }; }
  catch (error) {
    return { valid: false, errors: error instanceof ValidationError ? error.errors : [{path: '$', code: 'object', message: 'Unreadable input'}] };
  }
}
