import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInvoice } from '../dist/index.js';
import { createIndiaRules, isValidGstinFormat, hasValidGstinChecksum, isValidGstin } from '../dist/india.js';
import { invoice } from './helpers.mjs';

test('checks GSTIN structure and checksum without a network lookup', () => {
  const known = '27AAPFU0939F1ZV';
  assert.equal(isValidGstinFormat(known), true);
  assert.equal(hasValidGstinChecksum(known), true);
  assert.equal(isValidGstin(known), true);
  assert.equal(isValidGstinFormat('not-a-gstin'), false);
  assert.equal(isValidGstin('27AAPFU0939F1ZA'), false);
});

test('India rules report missing required fields and malformed GSTINs', () => {
  const validate = (input) => validateInvoice(input, { rules: createIndiaRules({
    requireGstin: 'supplier',
    requirePlaceOfSupply: true,
    requireHsn: true,
    requireReverseChargeFlag: true,
  }) });
  const result = validate(invoice({ supplier: { name: 'Supplier', gstin: 'bad' } }));
  const codes = result.issues.map((issue) => issue.code);
  assert.ok(codes.includes('india.gstin.format'));
  assert.ok(codes.includes('india.place-of-supply.required'));
  assert.ok(codes.includes('india.hsn.required'));
  assert.ok(codes.includes('india.reverse-charge.required'));
});

test('checks GST component labels only when supply type is explicitly configured', () => {
  const input = invoice({
    india: { supplyType: 'inter' },
    items: [{ description: 'Goods', quantity: '1', unitPrice: '100', netAmount: '100', taxes: [{ code: 'CGST', rate: '9', amount: '9' }], total: '109' }],
    totals: { subtotal: '100', tax: '9', total: '109' },
  });
  const result = validateInvoice(input, { rules: createIndiaRules({ checkSupplyType: true }) });
  assert.ok(result.issues.some((issue) => issue.code === 'india.tax-components.interstate'));
});

test('accepts the configured ordinary intra-State and inter-State tax patterns', () => {
  const intra = invoice({
    supplier: { name: 'Supplier', gstin: '27AAPFU0939F1ZV', stateCode: '27' },
    india: { placeOfSupply: '27', supplyType: 'intra' },
    items: [{ description: 'Goods', quantity: '1', unitPrice: '100', netAmount: '100', taxes: [
      { code: 'CGST', rate: '9', amount: '9' }, { code: 'SGST', rate: '9', amount: '9' },
    ], total: '118' }],
    totals: { subtotal: '100', tax: '18', total: '118' },
  });
  const intraResult = validateInvoice(intra, { rules: createIndiaRules({ checkSupplyType: true, checkStateConsistency: true, allowedStateCodes: ['27'] }) });
  assert.equal(intraResult.valid, true, JSON.stringify(intraResult.issues));

  const inter = invoice({
    supplier: { name: 'Supplier', gstin: '27AAPFU0939F1ZV', stateCode: '27' },
    india: { placeOfSupply: '29', supplyType: 'inter' },
    items: [{ description: 'Goods', quantity: '1', unitPrice: '100', netAmount: '100', taxes: [{ code: 'IGST', rate: '18', amount: '18' }], total: '118' }],
    totals: { subtotal: '100', tax: '18', total: '118' },
  });
  const interResult = validateInvoice(inter, { rules: createIndiaRules({ checkSupplyType: true, checkStateConsistency: true, allowedStateCodes: ['27', '29'] }) });
  assert.equal(interResult.valid, true, JSON.stringify(interResult.issues));
});

test('reports intrastate component split mismatches and unknown state codes', () => {
  const split = invoice({
    india: { supplyType: 'intra' },
    items: [{ description: 'Goods', quantity: '1', unitPrice: '100', netAmount: '100', taxes: [
      { code: 'CGST', rate: '9', amount: '9' }, { code: 'SGST', rate: '9', amount: '8' },
    ], total: '117' }],
    totals: { subtotal: '100', tax: '17', total: '117' },
  });
  const splitResult = validateInvoice(split, { rules: createIndiaRules({ checkSupplyType: true }) });
  assert.ok(splitResult.issues.some((issue) => issue.code === 'india.tax-split.amount'));

  const rateSplit = invoice({
    india: { supplyType: 'intra' },
    items: [{ description: 'Goods', quantity: '1', unitPrice: '100', netAmount: '100', taxes: [
      { code: 'CGST', rate: '9', amount: '9' }, { code: 'SGST', rate: '8', amount: '8' },
    ], total: '117' }],
    totals: { subtotal: '100', tax: '17', total: '117' },
  });
  const rateSplitResult = validateInvoice(rateSplit, { rules: createIndiaRules({ checkSupplyType: true }) });
  assert.ok(rateSplitResult.issues.some((issue) => issue.code === 'india.tax-split.rate'));

  const unknown = invoice({
    supplier: { name: 'Supplier', stateCode: '00' },
    india: { placeOfSupply: '00' },
  });
  const unknownResult = validateInvoice(unknown, { rules: createIndiaRules({ checkStateConsistency: true, allowedStateCodes: ['27', '29'] }) });
  assert.ok(unknownResult.issues.some((issue) => issue.code === 'india.state-code.unknown'));
  assert.ok(unknownResult.issues.some((issue) => issue.code === 'india.place-of-supply.unknown-state'));
});
