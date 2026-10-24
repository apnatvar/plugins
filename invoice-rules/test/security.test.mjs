import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInvoice, createValidator } from '../dist/index.js';
import { invoice, codes } from './helpers.mjs';

test('rejects accessor properties without invoking their getter', () => {
  let called = false;
  const input = invoice();
  Object.defineProperty(input, 'id', { enumerable: true, get() { called = true; return 'bad'; } });
  const result = validateInvoice(input);
  assert.equal(called, false);
  assert.ok(codes(result).includes('UNSAFE_INPUT'));
});

test('rejects cycles, non-plain objects, and dangerous own property names', () => {
  const cyclic = invoice();
  cyclic.extra = cyclic;
  assert.ok(codes(validateInvoice(cyclic)).includes('UNSAFE_INPUT'));
  assert.ok(codes(validateInvoice({ ...invoice(), extra: new Date() })).includes('UNSAFE_INPUT'));
  const dangerous = JSON.parse('{"__proto__":{},"id":"x"}');
  assert.ok(codes(validateInvoice(dangerous)).includes('UNSAFE_INPUT'));
});

test('enforces input limits and bounds input strings', () => {
  const many = invoice({ items: Array.from({ length: 3 }, () => invoice().items[0]) });
  assert.ok(codes(validateInvoice(many, { limits: { maxItems: 2 } })).includes('INPUT_LIMIT'));
  const long = invoice({ id: 'x'.repeat(100) });
  assert.ok(codes(validateInvoice(long, { limits: { maxStringLength: 32 } })).includes('INPUT_LIMIT'));
});

test('passes a frozen defensive snapshot to custom rules', () => {
  let seenFrozen = false;
  const validate = createValidator({ rules: [{
    id: 'snapshot-check',
    validate(value) {
      seenFrozen = Object.isFrozen(value) && Object.isFrozen(value.items) && Object.isFrozen(value.items[0]);
      try { value.items[0].description = 'changed'; } catch { /* expected in strict ES modules */ }
      return [];
    },
  }] });
  const original = invoice();
  const result = validate(original);
  assert.equal(result.valid, true);
  assert.equal(seenFrozen, true);
  assert.equal(original.items[0].description, 'Consulting');
});

test('contains malformed nested enum values without coercing objects', () => {
  const result = validateInvoice(invoice({ india: { supplyType: {} } }));
  assert.equal(result.valid, false);
  assert.ok(codes(result).includes('SCHEMA_TYPE'));
});

test('rejects nonfinite extension values and produces JSON-safe issues', () => {
  const result = validateInvoice({ ...invoice(), extra: Infinity });
  assert.equal(result.valid, false);
  assert.ok(codes(result).includes('INVALID_NUMBER'));
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('rejects hidden/symbol/sparse input and nested pollution keys', () => {
  const hidden = invoice();
  Object.defineProperty(hidden, 'secret', { value: 'x' });
  const symbol = invoice(); symbol[Symbol('x')] = true;
  const sparse = invoice(); sparse.extra = Array(2);
  const pollution = invoice(); pollution.extra = JSON.parse('{"constructor":{"prototype":{"polluted":true}}}');
  for (const input of [hidden, symbol, sparse, pollution]) assert.ok(codes(validateInvoice(input)).includes('UNSAFE_INPUT'));
  assert.equal({}.polluted, undefined);
});

test('truncates custom findings without misreporting a rule failure', () => {
  const result = validateInvoice(invoice(), { limits: { maxIssues: 1 }, rules: [{ id: 'many', validate() { return [
    { code: 'CUSTOM', path: '', severity: 'warning', message: 'first' },
    { code: 'CUSTOM', path: '', severity: 'error', message: 'second' },
  ]; } }] });
  assert.equal(result.issues.length, 1);
  assert.equal(result.valid, false);
  assert.equal(result.truncated, true);
  assert.equal(result.issues[0].code, 'CUSTOM');
});

test('ignores inherited severity properties for valid custom codes', () => {
  const result = validateInvoice(invoice(), { severities: {}, rules: [{ id: 'names', validate() { return [
    { code: 'toString', path: 'id', severity: 'error', message: 'Finding' },
  ]; } }] });
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].severity, 'error');
  assert.equal(JSON.parse(JSON.stringify(result)).issues[0].severity, 'error');
});
