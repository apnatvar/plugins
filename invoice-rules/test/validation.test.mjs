import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInvoice, validateInvoiceJson, createValidator } from '../dist/index.js';
import { invoice, codes } from './helpers.mjs';

test('accepts a balanced invoice with decimal strings', () => {
  const result = validateInvoice(invoice());
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.deepEqual(result.issues, []);
  assert.equal(result.truncated, false);
});

test('reports malformed shape and dates with stable issue codes', () => {
  const result = validateInvoice({ ...invoice(), date: '2026-02-30', items: 'not an array' });
  assert.equal(result.valid, false);
  assert.ok(codes(result).includes('SCHEMA_TYPE'));
  assert.ok(codes(result).includes('INVALID_DATE'));
});

test('detects date order, amount mismatches, and negative amounts by default', () => {
  const bad = invoice({
    date: '2026-11-01', dueDate: '2026-10-31',
    items: [{ description: 'Work', quantity: '1', unitPrice: '-3', netAmount: '-3', total: '-3' }],
    totals: { subtotal: '-3', tax: '0', total: '-3' },
  });
  const result = validateInvoice(bad);
  assert.ok(codes(result).includes('DATE_ORDER'));
  assert.ok(codes(result).includes('NEGATIVE_AMOUNT'));
});

test('checks arithmetic including discounts and tax amounts', () => {
  const bad = invoice({
    items: [{ description: 'Work', quantity: '2', unitPrice: '10', discount: { kind: 'amount', value: '1' }, netAmount: '19', taxes: [{ code: 'VAT', rate: '10', amount: '4' }], total: '23' }],
    totals: { subtotal: '20', discount: '1', tax: '4', total: '23' },
  });
  const result = validateInvoice(bad);
  assert.ok(codes(result).includes('AMOUNT_MISMATCH'));
});

test('allows refund amounts when opted in and permits zero quantity when configured', () => {
  const refund = invoice({ items: [{ description: 'Credit', quantity: '0', unitPrice: '-5', netAmount: '0', total: '0' }], totals: { subtotal: '0', tax: '0', total: '0' } });
  const result = validateInvoice(refund, { allowNegative: true, allowZeroQuantity: true });
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test('enforces discount bounds and rejects unsupported numeric representations', () => {
  const tooMuch = invoice({ items: [{ description: 'Work', quantity: '1', unitPrice: '10', discount: { kind: 'percent', value: '101' }, netAmount: '0', total: '0' }], totals: { subtotal: '10', tax: '0', total: '0' } });
  assert.ok(codes(validateInvoice(tooMuch)).includes('DISCOUNT_RANGE'));

  const invalid = invoice({ items: [{ description: 'Work', quantity: 1e21, unitPrice: '1', netAmount: '1', total: '1' }], totals: { subtotal: '1', tax: '0', total: '1' } });
  assert.ok(codes(validateInvoice(invalid)).includes('INVALID_NUMBER'));
  const nonFinite = invoice({ items: [{ description: 'Work', quantity: Number.NaN, unitPrice: '1', netAmount: '1', total: '1' }], totals: { subtotal: '1', tax: '0', total: '1' } });
  assert.ok(codes(validateInvoice(nonFinite)).includes('INVALID_NUMBER'));
});

test('JSON entry point returns an issue for invalid JSON and accepts valid JSON', () => {
  assert.ok(codes(validateInvoiceJson('{oops')).includes('INVALID_JSON'));
  assert.equal(validateInvoiceJson(JSON.stringify(invoice())).valid, true);
});

test('validator factory captures options and honors severity overrides', () => {
  const validate = createValidator({ severities: { AMOUNT_MISMATCH: 'warning' } });
  const bad = invoice({ totals: { subtotal: '20', tax: '2', total: '99' } });
  const result = validate(bad);
  assert.equal(result.valid, true);
  assert.ok(result.issues.some((issue) => issue.code === 'AMOUNT_MISMATCH' && issue.severity === 'warning'));
});

test('does not allow suppressing structural input safety failures', () => {
  const result = validateInvoice({ ...invoice(), __proto__: { polluted: true } }, { severities: { UNSAFE_INPUT: 'off' } });
  // A normal object literal does not create an own __proto__ key; test the actual unsafe shape below.
  const unsafe = JSON.parse('{"id":"x","__proto__":{},"date":"2026-10-24"}');
  const unsafeResult = validateInvoice(unsafe, { severities: { UNSAFE_INPUT: 'off' } });
  assert.equal(unsafeResult.valid, false);
  assert.ok(codes(unsafeResult).includes('UNSAFE_INPUT'));
  assert.equal(result.valid, false); // incomplete schema remains invalid
});

test('bounds issue lists and rejects invalid options', () => {
  const limited = validateInvoice({}, { limits: { maxIssues: 1 } });
  assert.equal(limited.issues.length, 1);
  assert.equal(limited.truncated, true);
  assert.ok(codes(validateInvoice(invoice(), { precision: 7 })).includes('INVALID_OPTIONS'));
  for (const options of [{ precision: null }, { rounding: null }, { taxRounding: null }, { limits: { toString: 1 } }]) {
    assert.ok(codes(validateInvoice(invoice(), options)).includes('INVALID_OPTIONS'));
  }
});
