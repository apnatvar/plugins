// Run after local build: node examples/server.mjs. No network or persistence.
import { randomBytes } from 'node:crypto';
import { createReceipt, createWithdrawal, authenticateReceipt, verifyAuthenticatedReceipt } from '../dist/index.js';

const key = randomBytes(32); // Use a secret manager in production.
const receipt = createReceipt({subject: {namespace: 'demo', id: 'opaque-demo-id'}, policyVersion: 'v1', purposes: [{id: 'updates', granted: true}]});
const envelope = await authenticateReceipt(receipt, key, 'demo-key');
if (!(await verifyAuthenticatedReceipt(envelope, key)).valid) throw new Error('Invalid record');

// Illustrative process-local adapter; a database needs atomic unique constraints.
const records = new Map();
const storage = {
  async insert(value) {
    const id = ('receipt' in value ? value.receipt : value).id;
    if (records.has(id)) return 'duplicate';
    records.set(id, value);
    return 'inserted';
  },
  async get(id) { return records.get(id); },
};
await storage.insert(envelope);
const withdrawal = createWithdrawal(receipt, {purposes: ['updates']});
await storage.insert(await authenticateReceipt(withdrawal, key, 'demo-key'));
console.log('Demo records authenticated and held in memory.');
key.fill(0);
