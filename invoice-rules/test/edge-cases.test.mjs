import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInvoice, validateInvoiceJson, createValidator } from '../dist/index.js';
import { invoice, codes } from './helpers.mjs';

function oneLine({ quantity = '1', unitPrice, netAmount, taxRate = '0', taxAmount = '0', total, discount, code = 'VAT' }) {
  const item = { description: 'Test item', quantity, unitPrice, netAmount, total };
  if (discount) item.discount = discount;
  if (taxRate !== null) item.taxes = [{ code, rate: taxRate, amount: taxAmount }];
  return item;
}

function document(item, totals, overrides = {}) {
  return invoice({ items: Array.isArray(item) ? item : [item], totals, ...overrides });
}

test('rounding modes handle positive and negative exact ties', () => {
  for (const [rounding, expected] of [['half-up', '3'], ['half-even', '2'], ['toward-zero', '2']]) {
    const positive = document(oneLine({ unitPrice: '2.5', netAmount: expected, total: expected }), { subtotal: expected, tax: '0', total: expected });
    assert.equal(validateInvoice(positive, { precision: 0, rounding }).valid, true, `${rounding} positive tie`);

    const negative = document(oneLine({ unitPrice: '-2.5', netAmount: `-${expected}`, total: `-${expected}` }), { subtotal: `-${expected}`, tax: '0', total: `-${expected}` });
    assert.equal(validateInvoice(negative, { precision: 0, rounding, allowNegative: true }).valid, true, `${rounding} negative tie`);
  }
});

test('supports zero, three, and six decimal currency precision', () => {
  const values = [
    { precision: 0, price: '1.5', rounded: '2' },
    { precision: 3, price: '1.2345', rounded: '1.235' },
    { precision: 6, price: '1.2345675', rounded: '1.234568' },
  ];
  for (const { precision, price, rounded } of values) {
    const input = document(oneLine({ unitPrice: price, netAmount: rounded, total: rounded }), { subtotal: rounded, tax: '0', total: rounded });
    assert.equal(validateInvoice(input, { precision }).valid, true, `precision ${precision}`);
  }
});

test('uses all supplied fractional rate digits in tax calculation', () => {
  // $0.03 × 16.666666666667% is just above the half-cent boundary.
  const input = document(oneLine({ unitPrice: '0.03', netAmount: '0.03', taxRate: '16.666666666667', taxAmount: '0.01', total: '0.04' }), { subtotal: '0.03', tax: '0.01', total: '0.04' });
  assert.equal(validateInvoice(input).valid, true);
});

test('validates grouped invoice tax rounding separately from line rounding', () => {
  const lines = [0, 1].map(() => oneLine({ unitPrice: '0.05', netAmount: '0.05', taxRate: '10', taxAmount: '0.01', total: '0.06' }));
  const input = document(lines, { subtotal: '0.10', tax: '0.01', total: '0.11' });
  assert.equal(validateInvoice(input, { taxRounding: 'invoice' }).valid, true);
  assert.ok(codes(validateInvoice(input, { taxRounding: 'line' })).includes('AMOUNT_MISMATCH'));
});

test('rounds fixed and percentage discounts from gross with the configured precision', () => {
  const percent = document(oneLine({ unitPrice: '19.99', netAmount: '17.99', discount: { kind: 'percent', value: '10' }, taxRate: '10', taxAmount: '1.80', total: '19.79' }), { subtotal: '19.99', discount: '2.00', tax: '1.80', total: '19.79' });
  assert.equal(validateInvoice(percent).valid, true, JSON.stringify(validateInvoice(percent).issues));

  const fixed = document(oneLine({ unitPrice: '10', netAmount: '8.99', discount: { kind: 'amount', value: '1.005' }, total: '8.99' }), { subtotal: '10', discount: '1.01', tax: '0', total: '8.99' });
  assert.equal(validateInvoice(fixed).valid, true, JSON.stringify(validateInvoice(fixed).issues));
});

test('accepts a negative refund line with matching negative tax when enabled', () => {
  const refund = document(oneLine({ unitPrice: '-10', netAmount: '-10', taxRate: '10', taxAmount: '-1', total: '-11' }), { subtotal: '-10', tax: '-1', total: '-11' });
  assert.equal(validateInvoice(refund, { allowNegative: true }).valid, true, JSON.stringify(validateInvoice(refund, { allowNegative: true }).issues));
  assert.ok(codes(validateInvoice(refund)).includes('NEGATIVE_AMOUNT'));
});

test('accepts zero-price and zero-value lines while respecting the quantity option', () => {
  const zero = document(oneLine({ quantity: '1', unitPrice: '0', netAmount: '0', total: '0' }), { subtotal: '0', tax: '0', total: '0' });
  assert.equal(validateInvoice(zero).valid, true);
  const zeroQuantity = document(oneLine({ quantity: '0', unitPrice: '10', netAmount: '0', total: '0' }), { subtotal: '0', tax: '0', total: '0' });
  assert.ok(codes(validateInvoice(zeroQuantity, { allowZeroQuantity: false })).includes('ZERO_QUANTITY'));
});

test('rejects malformed decimal representations consistently', () => {
  const invalidValues = ['+1', '.1', '1.', '1e2', ' 1', '1 ', '9999999999999999', '1.1234567890123', null, true, 1e21, Number.MAX_SAFE_INTEGER + 1, Number.POSITIVE_INFINITY, Number.NaN, 1n];
  for (const value of invalidValues) {
    const input = document(oneLine({ unitPrice: value, netAmount: '1', total: '1' }), { subtotal: '1', tax: '0', total: '1' });
    assert.ok(codes(validateInvoice(input)).includes(typeof value === 'bigint' ? 'UNSAFE_INPUT' : 'INVALID_NUMBER'), `expected invalid numeric input for ${String(value)}`);
  }
  const fullScale = document(oneLine({ unitPrice: '1.123456789012', netAmount: '1.12', total: '1.12' }), { subtotal: '1.12', tax: '0', total: '1.12' });
  assert.equal(validateInvoice(fullScale).valid, true);
});

test('detects product and aggregate total overflow', () => {
  const maximum = '999999999999999';
  const productOverflow = document(oneLine({ quantity: maximum, unitPrice: maximum, netAmount: maximum, total: maximum }), { subtotal: maximum, tax: '0', total: maximum });
  assert.ok(codes(validateInvoice(productOverflow)).includes('INVALID_NUMBER'));

  const lines = [0, 1].map(() => oneLine({ unitPrice: maximum, netAmount: maximum, total: maximum }));
  const aggregateOverflow = document(lines, { subtotal: maximum, tax: '0', total: maximum });
  assert.ok(codes(validateInvoice(aggregateOverflow)).includes('INVALID_NUMBER'));
});

test('enforces depth, node, tax-count, and JSON-text limits', () => {
  assert.ok(codes(validateInvoice(invoice(), { limits: { maxDepth: 2 } })).includes('INPUT_LIMIT'));
  assert.ok(codes(validateInvoice(invoice(), { limits: { maxNodes: 5 } })).includes('INPUT_LIMIT'));
  const tooManyTaxes = document(oneLine({ unitPrice: '1', netAmount: '1', total: '1', taxRate: null }), { subtotal: '1', tax: '0', total: '1' });
  tooManyTaxes.items[0].taxes = [
    { code: 'A', rate: '0', amount: '0' },
    { code: 'B', rate: '0', amount: '0' },
  ];
  assert.ok(codes(validateInvoice(tooManyTaxes, { limits: { maxTaxesPerItem: 1 } })).includes('INPUT_LIMIT'));
  assert.ok(codes(validateInvoiceJson(JSON.stringify(invoice()), { limits: { maxJsonLength: 16 } })).includes('INPUT_LIMIT'));
});

test('does not mutate valid plain input', () => {
  const input = invoice();
  const before = JSON.stringify(input);
  validateInvoice(input);
  assert.equal(JSON.stringify(input), before);
});

test('contains custom rule exceptions, promises, invalid issues, getters, and cycles', () => {
  const rules = [
    { id: 'throws', validate() { throw new Error('private detail'); } },
    { id: 'promise', validate() { return Promise.resolve([]); } },
    { id: 'wrong-shape', validate() { return { code: 'BAD' }; } },
    { id: 'bad-issue', validate() { return [{ code: 'bad code', path: '', message: 'x', severity: 'error' }]; } },
    { id: 'getter', validate() { const issue = { code: 'CUSTOM', path: '', message: 'x', severity: 'error' }; Object.defineProperty(issue, 'hidden', { get() { throw new Error('should not run'); } }); return [issue]; } },
    { id: 'cycle', validate() { const issue = { code: 'CUSTOM', path: '', message: 'x', severity: 'error' }; issue.self = issue; return [issue]; } },
  ];
  const result = createValidator({ rules })(invoice());
  assert.ok(codes(result).filter((code) => code === 'RULE_FAILURE').length >= rules.length);
  assert.ok(!result.issues.some((issue) => issue.message.includes('private detail')));
});

test('treats global identifier regexes deterministically and checks party identifiers', () => {
  const pattern = /^SUP-[0-9]+$/g;
  const validate = createValidator({ identifiers: { supplier: { pattern, required: true } } });
  const input = invoice({ supplier: { name: 'Supplier', identifier: 'SUP-42' } });
  assert.equal(validate(input).valid, true);
  assert.equal(validate(input).valid, true);
  const invalid = invoice({ supplier: { name: 'Supplier', identifier: 'bad' } });
  assert.ok(codes(validate(invalid)).includes('IDENTIFIER_INVALID'));
  assert.ok(codes(createValidator({ identifiers: { supplier: { pattern, required: true } } })(invoice({ supplier: { name: 'Supplier' } }))).includes('SCHEMA_REQUIRED'));
});

test('validates leap days and rejects impossible calendar dates', () => {
  assert.equal(validateInvoice(invoice({ date: '2024-02-29' })).valid, true);
  assert.ok(codes(validateInvoice(invoice({ date: '2023-02-29' }))).includes('INVALID_DATE'));
});

test('rejects repeated tax codes within a line', () => {
  const input = document(oneLine({ unitPrice: '10', netAmount: '10', total: '12', taxRate: '10', taxAmount: '1' }), { subtotal: '10', tax: '2', total: '12' });
  input.items[0].taxes.push({ code: 'vat', rate: '10', amount: '1' });
  assert.ok(codes(validateInvoice(input)).includes('INVALID_ID'));
});
