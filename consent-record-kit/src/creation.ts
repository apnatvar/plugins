import { randomUUID } from 'node:crypto';
import type { Receipt, ReceiptInput } from './types.js';
import { object } from './validation.js';
import { snapshot } from './serialization.js';
export function createReceipt(input: ReceiptInput): Receipt {
  object(input, '$', ['id', 'timestamp', 'subject', 'policyVersion', 'purposes']);
  return snapshot({ schemaVersion: '1.0', type: 'consent', id: input.id === undefined ? randomUUID() : input.id,
    timestamp: input.timestamp === undefined ? new Date().toISOString() : input.timestamp, subject: input.subject,
    policyVersion: input.policyVersion, purposes: input.purposes });
}
