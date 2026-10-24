import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import {createReceipt, canonicalize, hashReceipt, verifyIntegrity, authenticateReceipt, verifyAuthenticatedReceipt, validateReceipt, parseReceipt, createWithdrawal, ValidationError} from '../dist/index.js';
const fixed = {id:'7a6c7e3e-79a6-4f93-8f7e-f15f16e4b421',timestamp:'2026-10-24T00:00:00.000Z',subject:{namespace:'account',id:'opaque'},policyVersion:'v1',purposes:[{id:'analytics',granted:true}]};

test('a forged unkeyed digest verifies but cannot forge the protected authenticator', async () => {
  const key = randomBytes(32);
  const original = createReceipt(fixed);
  const signed = await authenticateReceipt(original,key,'rotation-1');
  const forged = {...original,policyVersion:'attacker-policy'};
  assert.equal((await verifyIntegrity(forged,await hashReceipt(forged))).valid,true);
  assert.equal((await verifyAuthenticatedReceipt({...signed,receipt:forged},key)).valid,false);
  assert.equal((await verifyAuthenticatedReceipt(signed,key)).valid,true);
  // Verification intentionally does not prevent replay.
  assert.equal((await verifyAuthenticatedReceipt(signed,key)).valid,true);
});

test('canonical cryptographic bytes agree with independently constructed platform vectors', async () => {
  const record = createReceipt(fixed);
  const text = '{"id":"7a6c7e3e-79a6-4f93-8f7e-f15f16e4b421","policyVersion":"v1","purposes":[{"granted":true,"id":"analytics"}],"schemaVersion":"1.0","subject":{"id":"opaque","namespace":"account"},"timestamp":"2026-10-24T00:00:00.000Z","type":"consent"}';
  assert.equal(canonicalize(record),text);
  assert.equal(await hashReceipt(record),createHash('sha256').update(text,'utf8').digest('hex'));
  const key = Buffer.alloc(32,42), before = Buffer.from(key);
  const expected = createHmac('sha256',key).update('ConsentRecordKit:HMAC:v1\n{"algorithm":"HMAC-SHA-256","keyId":"test","receipt":'+text+'}').digest('hex');
  assert.equal((await authenticateReceipt(record,key,'test')).authentication.tag,expected);
  assert.deepEqual(key,before);
});

test('Unicode is preserved, keys are deterministically ordered and byte limits use UTF-8', () => {
  const record = createReceipt({...fixed,subject:{namespace:'顧客',id:'😀'},purposes:[{id:'é',granted:true},{id:'é',granted:false}]});
  const json = canonicalize(record);
  assert.deepEqual(parseReceipt(json),record);
  assert.throws(()=>parseReceipt(json,{maxBytes:json.length}),ValidationError);
  const reverse = {...record,purposes:[...record.purposes].reverse()};
  assert.equal(canonicalize(reverse),json);
  assert.notEqual(canonicalize(createReceipt({...fixed,policyVersion:'é'})),canonicalize(createReceipt({...fixed,policyVersion:'é'})));
});

test('hostile JSON and invalid calendar, scalar, and schema inputs fail closed', async () => {
  const record = createReceipt(fixed);
  for (const value of [null, [], 42, 'record', {...record,schemaVersion:'2.0'}, {...record,type:'signature'}, {...record,timestamp:'2026-02-30T00:00:00.000Z'}, {...record,timestamp:'2026-10-24T00:00:00.000+00:00'}, {...record,subject:{namespace:'x',id:'\ud800'}}, {...record,id:record.id.toUpperCase()}]) {
    assert.equal(validateReceipt(value).valid,false);
    assert.equal((await verifyAuthenticatedReceipt({receipt:value,authentication:{}},new Uint8Array(32))).valid,false);
  }
  for (const json of ['{"__proto__":{"polluted":true}}','{"constructor":{"prototype":{"polluted":true}}}', '[]', 'null', '{', ' '.repeat(65537)]) assert.throws(()=>parseReceipt(json),ValidationError);
  assert.equal({}.polluted,undefined);
  for (const bad of [null,{},[],new Uint8Array(0)]) await assert.rejects(authenticateReceipt(record,bad,'key'),ValidationError);
  for (const value of [null,{},[],{receipt:record,authentication:null}]) assert.equal((await verifyAuthenticatedReceipt(value,new Uint8Array(32))).valid,false);
});

test('withdrawal rejects accessor arrays without executing getters or mutating prior records', () => {
  const record = createReceipt(fixed), before = canonicalize(record);
  let calls = 0;
  const purposes = ['analytics'];
  Object.defineProperty(purposes,'0',{enumerable:true,get(){calls++;return 'analytics';}});
  assert.throws(()=>createWithdrawal(record,{purposes}),ValidationError);
  assert.equal(calls,0);
  const withdrawn = createWithdrawal(record,{purposes:['analytics']});
  assert.equal(withdrawn.previousRecordId,record.id);
  assert.equal(canonicalize(record),before);
});
