import { readFile } from 'node:fs/promises';
import { validateInvoiceJson } from '@brownsmithdynamics/invoice-rules';

const json = await readFile(new URL('./basic-invoice.json', import.meta.url), 'utf8');
const result = validateInvoiceJson(json);

if (!result.valid) {
  console.error('Invoice validation failed:');
  for (const issue of result.issues) {
    console.error(`- ${issue.path}: ${issue.code} (${issue.severity}) — ${issue.message}`);
  }
  process.exitCode = 1;
} else {
  console.log('Invoice is structurally and arithmetically valid.');
}
