import { readFile } from 'node:fs/promises';
import { validateInvoice } from '../dist/index.js';
import { createIndiaRules } from '../dist/india.js';

const invoice = JSON.parse(await readFile(new URL('./india-invoice.json', import.meta.url), 'utf8'));
const result = validateInvoice(invoice, {
  rules: createIndiaRules({
    requirePlaceOfSupply: true,
    requireHsn: true,
    requireReverseChargeFlag: true,
    checkSupplyType: true,
    checkStateConsistency: true,
    allowedStateCodes: ['29'],
  }),
});

if (!result.valid) {
  for (const issue of result.issues) {
    console.error(`${issue.path}: ${issue.code} (${issue.severity}) — ${issue.message}`);
  }
  process.exitCode = 1;
} else {
  console.log('Invoice passed the configured India checks.');
}
