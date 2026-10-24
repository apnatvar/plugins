import { randomUUID } from 'node:crypto';
import type { Receipt, ReceiptInput } from './types.js';
import { assertReceipt, fail, object } from './validation.js';
import { snapshot } from './serialization.js';
import { createReceipt } from './creation.js';
function link(previous: Receipt, next: Receipt): Receipt {
  assertReceipt(previous);
  if (previous.type === 'withdrawal') fail('previousRecordId', 'link', 'Use the original consent or a supersession as the prior record');
  if (next.id === previous.id || next.timestamp < previous.timestamp) fail('timestamp', 'link', 'Linked records need a different ID and nondecreasing time');
  if (next.subject.namespace !== previous.subject.namespace || next.subject.id !== previous.subject.id)
    fail('subject', 'link', 'Linked subjects must match');
  return snapshot({...next, previousRecordId: previous.id});
}
export function supersedeReceipt(previous: Receipt, input: ReceiptInput): Receipt {
  return link(previous, {...createReceipt(input), type: 'supersession'});
}
export interface WithdrawalInput { readonly id?: string; readonly timestamp?: string; readonly purposes: readonly string[] }
export function createWithdrawal(previous: Receipt, input: WithdrawalInput): Receipt {
  assertReceipt(previous);
  object(input, '$', ['id', 'timestamp', 'purposes']);
  if (!Array.isArray(input.purposes) || input.purposes.length < 1 || input.purposes.length > 64)
    fail('purposes', 'purposes', 'Select 1 to 64 prior granted purposes');
  // Reuse receipt validation to reject non-data arrays before accessing their elements.
  const desc = Object.getOwnPropertyDescriptors(input.purposes);
  if (Object.getPrototypeOf(input.purposes) !== Array.prototype || Reflect.ownKeys(desc).length !== input.purposes.length + 1)
    fail('purposes', 'array', 'Expected a dense data array');
  const purposes = [];
  for (let i = 0; i < input.purposes.length; i++) {
    const d = desc[String(i)];
    if (!d || !('value' in d) || !d.enumerable || typeof d.value !== 'string') fail('purposes', 'array', 'Expected purpose IDs');
    const id = d.value as string;
    if (!previous.purposes.some(p => p.id === id && p.granted)) fail('purposes', 'withdrawal', 'Only a previously granted purpose can be withdrawn');
    purposes.push({id, granted: false});
  }
  return link(previous, {schemaVersion: '1.0', type: 'withdrawal', id: input.id === undefined ? randomUUID() : input.id,
    timestamp: input.timestamp === undefined ? new Date().toISOString() : input.timestamp, subject: previous.subject,
    policyVersion: previous.policyVersion, purposes});
}
