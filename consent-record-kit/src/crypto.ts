import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedReceipt, Receipt, VerificationResult } from './types.js';
import { canonicalize, orderedJSON, snapshot } from './serialization.js';
import { fail, object, string, validateReceipt, ValidationError } from './validation.js';
const DOMAIN = 'ConsentRecordKit:HMAC:v1\n';
function keyCopy(key: Uint8Array): Buffer {
  if (!(key instanceof Uint8Array) || key.byteLength < 32 || key.byteLength > 4096) fail('key', 'key', 'Expected 32 to 4096 key bytes');
  return Buffer.from(key);
}
function equalHex(expected: string, actual: unknown): boolean {
  return typeof actual === 'string' && /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}
function result(valid: boolean, code: string): VerificationResult {
  return {valid, errors: valid ? [] : [{path: '$', code, message: 'Verification failed'}]};
}
export async function hashReceipt(receipt: Receipt): Promise<string> {
  return createHash('sha256').update(canonicalize(receipt), 'utf8').digest('hex');
}
export async function verifyIntegrity(receipt: Receipt, digest: string): Promise<VerificationResult> {
  const validation = validateReceipt(receipt);
  if (!validation.valid) return validation;
  return result(equalHex(await hashReceipt(receipt), digest), 'integrity');
}
export async function authenticateReceipt(receipt: Receipt, key: Uint8Array, keyId: string): Promise<AuthenticatedReceipt> {
  const record = snapshot(receipt);
  string(keyId, 'keyId', 128);
  const secret = keyCopy(key);
  try {
    const algorithm = 'HMAC-SHA-256' as const;
    const message = DOMAIN + orderedJSON({algorithm, keyId, receipt: record});
    const tag = createHmac('sha256', secret).update(message, 'utf8').digest('hex');
    return Object.freeze({receipt: record, authentication: Object.freeze({algorithm, keyId, tag})});
  } finally { secret.fill(0); }
}
export async function verifyAuthenticatedReceipt(value: unknown, key: Uint8Array): Promise<VerificationResult> {
  try {
    const envelope = object(value, '$', ['receipt', 'authentication']);
    const validation = validateReceipt(envelope.receipt);
    if (!validation.valid) return validation;
    const auth = object(envelope.authentication, 'authentication', ['algorithm', 'keyId', 'tag']);
    if (auth.algorithm !== 'HMAC-SHA-256') return result(false, 'algorithm');
    string(auth.keyId, 'authentication.keyId', 128);
    const expected = await authenticateReceipt(envelope.receipt as Receipt, key, auth.keyId);
    return result(equalHex(expected.authentication.tag, auth.tag), 'authentication');
  } catch (error) {
    return {valid: false, errors: error instanceof ValidationError ? error.errors : [{path: '$', code: 'input', message: 'Unreadable input'}]};
  }
}
