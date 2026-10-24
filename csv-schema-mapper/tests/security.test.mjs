import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapper, parseCsv, serializeCsv } from '../dist/index.js';

test('configured parser limits reject excessive input with a structured parse error', () => {
  assert.throws(
    () => parseCsv('a\n123456', { maxFieldLength: 3 }),
    (error) => typeof error.code === 'string' && !error.message.includes('123456'),
  );
});

test('each parser resource limit has a distinct fail-closed error', () => {
  const cases = [
    ['maxInputBytes', 'a\n1', 2, 'MAX_INPUT_BYTES'],
    ['maxFieldLength', 'a\n123', 2, 'MAX_FIELD_LENGTH'],
    ['maxRecordLength', 'a\n1', 1, 'MAX_RECORD_LENGTH'],
    ['maxRows', 'a\n1', 1, 'MAX_ROWS'],
    ['maxColumns', 'a,b', 1, 'MAX_COLUMNS'],
  ];
  for (const [option, input, limit, code] of cases) {
    assert.throws(
      () => parseCsv(input, { [option]: limit }),
      (error) => error.code === code && !error.message.includes(input),
      `${option} must reject its configured over-limit input`,
    );
  }
});

test('lone UTF-16 surrogate input is rejected as invalid Unicode', () => {
  assert.throws(() => parseCsv('value\n\uD800'), (error) => error.code === 'INVALID_UTF8');
});

test('malformed quote placement fails closed instead of silently changing columns', () => {
  assert.throws(() => parseCsv('a,b\n1,2"3'), (error) => typeof error.code === 'string');
});

test('formula-looking values, headers, controls, and full-width markers are escaped by default', () => {
  const values = ['=1+1', ' +1', '\t=1', '\r=1', '\n=1', '＝1', '＋1', '－1', '＠1'];
  const row = Object.fromEntries(values.map((value, index) => [`column${index}`, value]));
  const parsed = parseCsv(serializeCsv([row]));
  assert.ok(parsed[0].values.every((header) => !/^[=+\-@＝＋－＠]/u.test(header)));
  assert.ok(parsed[1].values.every((value) => value.startsWith("'")));
  assert.equal(parseCsv(serializeCsv([{ safe: 'value' }], { columns: ['=header'] }))[0].values[0], "'=header");
});

test('formula rejection also applies to headers and control-prefixed values', () => {
  assert.throws(() => serializeCsv([{ value: '\t=1' }], { formulaProtection: 'reject' }));
  assert.throws(() => serializeCsv([{ safe: 'value' }], { columns: ['＠header'], formulaProtection: 'reject' }));
});

test('mapper captures parser failures and does not disclose hostile source content', () => {
  const payload = 'DO_NOT_LEAK_THIS_SECRET';
  const result = createMapper({ value: { type: 'string' } }).map(`value\n"${payload}`);
  assert.ok(result.errors.length > 0);
  assert.equal(JSON.stringify(result.errors).includes(payload), false);
});

test('prototype-like header names do not mutate object prototypes', () => {
  const result = createMapper({ safe: { type: 'string' } }).map('__proto__,constructor,prototype,safe\nx,y,z,ok');
  assert.equal(result.rows.length, 0);
  assert.equal({}.polluted, undefined);
  assert.ok(result.errors.some(({ code }) => code === 'UNSAFE_HEADER'));
});

test('forbidden schema keys from JSON are rejected and null-prototype schemas remain safe', () => {
  const unsafe = JSON.parse('{"__proto__":{"type":"string"}}');
  assert.throws(() => createMapper(unsafe));
  const safe = Object.create(null);
  safe.label = { type: 'string' };
  assert.deepEqual(createMapper(safe).map('label\nworks').rows, [{ label: 'works' }]);
});

test('Unicode headers and values survive parsing and mapping', () => {
  const result = createMapper({ '名': { type: 'string' }, 'café': { type: 'string' } })
    .map('名,café\n東京,naïve ☕');
  assert.deepEqual(result.rows, [{ '名': '東京', 'café': 'naïve ☕' }]);
});

test('UTF-8 byte chunks preserve multi-byte characters split between chunks', async () => {
  const bytes = new TextEncoder().encode('value\n☕');
  async function* chunks() {
    yield bytes.slice(0, bytes.length - 2);
    yield bytes.slice(bytes.length - 2);
  }
  const records = [];
  for await (const item of createMapper({ value: { type: 'string' } }).mapStream(chunks())) records.push(item);
  assert.equal(records[0].data.value, '☕');
});

test('invalid UTF-8 byte sequences produce a safe stream error', async () => {
  async function* chunks() {
    yield new TextEncoder().encode('value\n');
    yield new Uint8Array([0xc3, 0x28]);
  }
  const records = [];
  for await (const item of createMapper({ value: { type: 'string' } }).mapStream(chunks())) records.push(item);
  assert.ok(records.some(({ errors }) => errors.some(({ code }) => code === 'INVALID_UTF8')));
});

test('error messages never contain raw invalid cells or transform exception details', () => {
  const result = createMapper({
    amount: { type: 'number' },
    value: { type: 'string', transform: () => { throw new Error('TRANSFORM_SECRET'); } },
  }).map('amount,value\nINVALID_CELL,RAW_CELL');
  const serializedErrors = JSON.stringify(result.errors);
  for (const secret of ['INVALID_CELL', 'RAW_CELL', 'TRANSFORM_SECRET']) {
    assert.equal(serializedErrors.includes(secret), false);
  }
});

test('CSV serializer formula protection prefixes formula-looking values', () => {
  const data = parseCsv(serializeCsv([{ input: '@SUM(A1:A2)' }]))[1].values[0];
  assert.equal(data, "'@SUM(A1:A2)");
  assert.throws(() => serializeCsv([{ input: '@SUM(A1:A2)' }], { formulaProtection: 'reject' }));
});

test('serializer enforces configurable row, column, field, and output bounds', () => {
  assert.throws(() => serializeCsv([{ a: '1' }, { a: '2' }], { maxRows: 1 }));
  assert.throws(() => serializeCsv([{ a: '1', b: '2' }], { maxColumns: 1 }));
  assert.throws(() => serializeCsv([{ a: 'long' }], { maxFieldLength: 3 }));
  assert.throws(() => serializeCsv([{ a: '1' }], { maxOutputBytes: 3 }));
});

test('serializer stops consuming an infinite iterable at its configured row bound', () => {
  let pulled = 0;
  function* infiniteRows() {
    while (true) { pulled++; yield { value: 'x' }; }
  }
  assert.throws(() => serializeCsv(infiniteRows(), { maxRows: 2 }));
  assert.equal(pulled, 3);
});
