import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  ValidationError,
  createReceipt,
  createWithdrawal,
  supersedeReceipt,
  canonicalize,
  exportReceipt,
  parseReceipt,
  validateReceipt,
  hashReceipt,
  verifyIntegrity,
  authenticateReceipt,
  verifyAuthenticatedReceipt,
} from '../dist/index.js';

const uuid = '7a6c7e3e-79a6-4f93-8f7e-f15f16e4b421';
const uuid2 = '9f3ea9ea-3a79-46d9-895c-5cbf526751af';
const time = '2026-04-20T10:11:12.123Z';
const subject = { id: 'user-42', namespace: 'crm' };
const canonicalGolden = '{"id":"7a6c7e3e-79a6-4f93-8f7e-f15f16e4b421","policyVersion":"2026-04","purposes":[{"granted":true,"id":"analytics"},{"granted":false,"id":"email"}],"schemaVersion":"1.0","subject":{"id":"user-42","namespace":"crm"},"timestamp":"2026-04-20T10:11:12.123Z","type":"consent"}';
const sha256Golden = '00ca235344f2d86a19cd4a62105280e4ac8e7321b1fbb38a31cff8ddd07d212b';
const hmacGolden = '6ea6c2bbfd9e8f678d1e884057e09c9ccabb9fb6d01baf1da5e6919b86e3d422';
const baseInput = () => ({
  id: uuid,
  timestamp: time,
  subject: { ...subject },
  policyVersion: '2026-04',
  purposes: [{ id: 'analytics', granted: true }, { id: 'email', granted: false }],
});
const receipt = () => createReceipt(baseInput());
const clone = value => JSON.parse(JSON.stringify(value));

function expectValidationError(fn) {
  assert.throws(fn, error => error instanceof ValidationError && Array.isArray(error.errors));
}

test('createReceipt produces the versioned consent contract and immutable snapshots', () => {
  const result = createReceipt(baseInput());
  assert.deepEqual(result, {
    schemaVersion: '1.0', type: 'consent', id: uuid, timestamp: time,
    subject, policyVersion: '2026-04',
    purposes: [{ id: 'analytics', granted: true }, { id: 'email', granted: false }],
  });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.subject));
  assert.ok(Object.isFrozen(result.purposes));
  assert.ok(result.purposes.every(Object.isFrozen));
  assert.throws(() => { result.subject.id = 'changed'; }, TypeError);
  assert.throws(() => { result.purposes[0].granted = false; }, TypeError);
  assert.match(createReceipt({ ...baseInput(), id: undefined }).id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('canonical serialization sorts purposes and object keys and exportReceipt is an alias', () => {
  const record = receipt();
  const text = canonicalize(record);
  assert.equal(text, exportReceipt(record));
  assert.equal(text, canonicalGolden);
  const reversed = clone(record);
  reversed.purposes.reverse();
  assert.equal(canonicalize(reversed), text);
  assert.deepEqual(JSON.parse(text), record);
});

test('createReceipt validates limits, canonical identifiers, and rejects unknown or hostile object data', () => {
  for (const bad of [
    { ...baseInput(), extra: true },
    { ...baseInput(), subject: { ...subject, extra: true } },
    { ...baseInput(), purposes: [{ id: 'email', granted: true }, { id: 'email', granted: false }] },
    { ...baseInput(), purposes: [] },
    { ...baseInput(), purposes: Array.from({ length: 65 }, (_, i) => ({ id: `p${i}`, granted: true })) },
    { ...baseInput(), subject: { namespace: '  crm', id: 'user-42' } },
    { ...baseInput(), subject: { namespace: 'crm\u0000', id: 'user-42' } },
    { ...baseInput(), timestamp: '2026-04-20T10:11:12Z' },
    { ...baseInput(), id: 'not-a-uuid' },
    { ...baseInput(), schemaVersion: '2.0' },
  ]) expectValidationError(() => createReceipt(bad));

  const accessor = baseInput();
  Object.defineProperty(accessor, 'policyVersion', { enumerable: true, get() { throw new Error('getter invoked'); } });
  expectValidationError(() => createReceipt(accessor));
  const withSymbol = baseInput();
  withSymbol[Symbol('hidden')] = 1;
  expectValidationError(() => createReceipt(withSymbol));
  const withPrototype = Object.assign(Object.create({ inherited: true }), baseInput());
  expectValidationError(() => createReceipt(withPrototype));
  const sparsePurposes = baseInput();
  sparsePurposes.purposes = new Array(2);
  sparsePurposes.purposes[1] = { id: 'email', granted: false };
  expectValidationError(() => createReceipt(sparsePurposes));
  const accessorPurpose = baseInput();
  Object.defineProperty(accessorPurpose.purposes, '0', { enumerable: true, get() { throw new Error('getter invoked'); } });
  expectValidationError(() => createReceipt(accessorPurpose));
  const customArray = baseInput();
  customArray.purposes.extra = 'hidden';
  expectValidationError(() => createReceipt(customArray));
  expectValidationError(() => createReceipt({ ...baseInput(), policyVersion: 'x'.repeat(129) }));
  expectValidationError(() => createReceipt({ ...baseInput(), subject: { namespace: 'x'.repeat(65), id: 'x' } }));
  expectValidationError(() => createReceipt({ ...baseInput(), subject: { namespace: 'x', id: 'x'.repeat(257) } }));
  expectValidationError(() => createReceipt({ ...baseInput(), purposes: [{ id: 'x'.repeat(129), granted: true }] }));
});

test('createWithdrawal and supersedeReceipt enforce lifecycle constraints', () => {
  const prior = createReceipt({ ...baseInput(), purposes: [
    { id: 'analytics', granted: true }, { id: 'email', granted: false },
  ] });
  const withdrawal = createWithdrawal(prior, { id: uuid2, timestamp: '2026-04-20T10:12:00.000Z', purposes: ['analytics'] });
  assert.equal(withdrawal.type, 'withdrawal');
  assert.equal(withdrawal.previousRecordId, prior.id);
  assert.deepEqual(withdrawal.subject, prior.subject);
  assert.equal(withdrawal.policyVersion, prior.policyVersion);
  assert.deepEqual(withdrawal.purposes, [{ id: 'analytics', granted: false }]);
  assert.ok(Object.isFrozen(withdrawal));
  expectValidationError(() => createWithdrawal(prior, { purposes: ['email'] }));
  expectValidationError(() => createWithdrawal(prior, { purposes: ['missing'] }));
  expectValidationError(() => createWithdrawal(prior, { purposes: ['analytics', 'analytics'] }));
  expectValidationError(() => createWithdrawal(prior, { purposes: [] }));
  expectValidationError(() => createWithdrawal({ ...prior, type: 'withdrawal' }, { purposes: ['analytics'] }));

  const next = supersedeReceipt(prior, {
    id: uuid2, timestamp: '2026-04-20T10:11:12.124Z', subject: { ...prior.subject },
    policyVersion: '2026-05', purposes: [{ id: 'analytics', granted: true }],
  });
  assert.equal(next.type, 'supersession');
  assert.equal(next.previousRecordId, prior.id);
  assert.deepEqual(next.subject, prior.subject);
  expectValidationError(() => supersedeReceipt(prior, {
    ...baseInput(), subject: { namespace: 'crm', id: 'someone-else' }, timestamp: '2026-04-20T10:11:12.124Z',
  }));
  expectValidationError(() => supersedeReceipt(prior, {
    ...baseInput(), timestamp: '2026-04-20T10:11:12.122Z',
  }));
});

test('validateReceipt returns structured success and failure results; parser enforces size and shape', () => {
  const valid = receipt();
  assert.deepEqual(validateReceipt(valid), { valid: true, errors: [] });
  const invalid = clone(valid);
  invalid.unexpected = true;
  const result = validateReceipt(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.every(e => typeof e.path === 'string' && typeof e.code === 'string' && typeof e.message === 'string'));
  assert.deepEqual(parseReceipt(canonicalize(valid)), valid);
  assert.throws(() => parseReceipt('{'), ValidationError);
  assert.throws(() => parseReceipt(' '.repeat(65537)), ValidationError);
  assert.throws(() => parseReceipt(canonicalize(valid), { maxBytes: 65537 }), ValidationError);
  assert.throws(() => parseReceipt('{"__proto__":{"polluted":true}}'), ValidationError);
  assert.throws(() => parseReceipt(canonicalGolden.replace('{"id":', '{ "id":')), ValidationError);
  assert.throws(() => parseReceipt(canonicalGolden.replace('"type":"consent"', '"type":"consent","type":"consent"')), ValidationError);
  assert.equal({}.polluted, undefined);
  const future = createReceipt({ ...baseInput(), timestamp: '2099-12-31T23:59:59.999Z' });
  assert.equal(validateReceipt(future).valid, true); // Timestamp validity is syntactic; callers own clock policy.
});

test('hashReceipt matches SHA-256 of canonical UTF-8 and detects digest tampering', async () => {
  const record = receipt();
  const digest = await hashReceipt(record);
  assert.equal(digest, sha256Golden);
  assert.deepEqual(await verifyIntegrity(record, digest), { valid: true, errors: [] });
  const forged = await verifyIntegrity(record, '0'.repeat(64));
  assert.equal(forged.valid, false);
  assert.ok(forged.errors.length > 0);
});

test('HMAC authentication is domain separated, reproducible, and rejects tampering and wrong keys', async () => {
  const record = receipt();
  const key = Uint8Array.from({ length: 32 }, (_, i) => i);
  const keyId = 'test-key-1';
  const envelope = await authenticateReceipt(record, key, keyId);
  assert.deepEqual(envelope.receipt, record);
  assert.equal(envelope.authentication.algorithm, 'HMAC-SHA-256');
  assert.equal(envelope.authentication.keyId, keyId);
  assert.equal(envelope.authentication.tag, hmacGolden);
  assert.deepEqual(await verifyAuthenticatedReceipt(envelope, key), { valid: true, errors: [] });
  assert.equal((await verifyAuthenticatedReceipt(envelope, Uint8Array.from(key, x => x ^ 1))).valid, false);
  const changed = clone(envelope);
  changed.receipt.purposes[0].granted = false;
  assert.equal((await verifyAuthenticatedReceipt(changed, key)).valid, false);
  const badTag = clone(envelope);
  badTag.authentication.tag = 'f'.repeat(64);
  assert.equal((await verifyAuthenticatedReceipt(badTag, key)).valid, false);
  for (const tag of ['f'.repeat(63), 'F'.repeat(64), 'g'.repeat(64), '']) {
    const malformed = clone(envelope);
    malformed.authentication.tag = tag;
    assert.equal((await verifyAuthenticatedReceipt(malformed, key)).valid, false);
  }
  for (const mutate of [
    value => { value.authentication.algorithm = 'HMAC-SHA-512'; },
    value => { value.authentication.keyId = 'other-key'; },
    value => { value.receipt.id = uuid2; },
    value => { value.receipt.timestamp = '2026-04-20T10:11:13.000Z'; },
    value => { value.receipt.subject.namespace = 'other-system'; },
  ]) {
    const modified = clone(envelope);
    mutate(modified);
    assert.equal((await verifyAuthenticatedReceipt(modified, key)).valid, false);
  }
  assert.equal((await verifyAuthenticatedReceipt({ ...envelope, unexpected: 1 }, key)).valid, false);
  const hostile = {};
  Object.defineProperty(hostile, 'receipt', { enumerable: true, get() { throw new Error('getter invoked'); } });
  hostile.authentication = envelope.authentication;
  assert.equal((await verifyAuthenticatedReceipt(hostile, key)).valid, false);
  await assert.rejects(authenticateReceipt(record, new Uint8Array(31), keyId), ValidationError);
  await assert.rejects(authenticateReceipt(record, new Uint8Array(4097), keyId), ValidationError);
  await assert.rejects(authenticateReceipt(record, new Uint8Array(32), 'x'.repeat(129)), ValidationError);
  assert.equal((await verifyAuthenticatedReceipt(envelope, new Uint8Array(31))).valid, false);
});

test('IDs are caller supplied and lifecycle creation remains stateless across repeated calls', () => {
  const first = createReceipt({ ...baseInput(), id: uuid });
  const second = createReceipt({ ...baseInput(), id: uuid });
  assert.equal(first.id, second.id);
  const withdrawalA = createWithdrawal(first, { id: uuid2, timestamp: time, purposes: ['analytics'] });
  const withdrawalB = createWithdrawal(first, { id: uuid2, timestamp: time, purposes: ['analytics'] });
  assert.deepEqual(withdrawalA, withdrawalB);
  assert.notEqual(randomUUID(), uuid);
});
