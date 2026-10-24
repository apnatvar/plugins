import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateInvoice } from '../dist/index.js';
import { createIndiaRules } from '../dist/india.js';

test('fictional sample fixtures pass their documented configuration', () => {
  const read = name => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
  assert.equal(validateInvoice(read('basic-invoice.json')).valid, true);
  const result = validateInvoice(read('india-invoice.json'), { rules: createIndiaRules({ requireHsn: true, requireReverseChargeFlag: true, requirePlaceOfSupply: true, checkSupplyType: true, checkStateConsistency: true, allowedStateCodes: ['29'] }) });
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test('shipped example scripts execute successfully', () => {
  for (const name of ['validate.mjs', 'india.mjs']) {
    const result = spawnSync(process.execPath, [new URL(`../examples/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
