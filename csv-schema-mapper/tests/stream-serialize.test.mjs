import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapper, parseCsv, serializeCsv } from '../dist/index.js';

test('mapStream handles boundaries inside quoted fields and emits data rows incrementally', async () => {
  const mapper = createMapper({ name: { type: 'string' }, note: { type: 'string' } });
  async function* chunks() {
    yield 'name,note\nAda,"hel';
    yield 'lo, ""friend"""\nGrace,"line one\n';
    yield 'line two"';
  }
  const records = [];
  for await (const item of mapper.mapStream(chunks())) records.push(item);
  assert.equal(records.length, 2);
  assert.equal(records[0].data.name, 'Ada');
  assert.equal(records[0].data.note, 'hello, "friend"');
  assert.equal(records[1].row, 3);
  assert.equal(records[1].data.note, 'line one\nline two');
  assert.deepEqual(records.flatMap(({ errors }) => errors), []);
});

test('stream parsing matches whole-input parsing at every input split point', async () => {
  const csv = 'name,note\r\nAda,"comma, quote ""ok"" and\r\nnewline"\r\nGrace,done';
  const mapper = createMapper({ name: { type: 'string' }, note: { type: 'string' } });
  const expected = mapper.map(csv).rows;
  for (let split = 0; split <= csv.length; split++) {
    async function* chunks() {
      yield csv.slice(0, split);
      yield csv.slice(split);
    }
    const actual = [];
    for await (const item of mapper.mapStream(chunks())) {
      assert.deepEqual(item.errors, [], `split point ${split}`);
      actual.push(item.data);
    }
    assert.deepEqual(actual, expected, `split point ${split}`);
  }
});

test('50 deterministic records round-trip across serialization, parsing, mapping, and every stream split', async () => {
  const fragments = ['', 'comma,value', '"', '""', 'quote " run ""', '\r', '\n', '\r\n', 'café ☕', '東京 🌍', 'line one\r\nline two'];
  const rows = Array.from({ length: 50 }, (_, index) => ({
    left: fragments[index % fragments.length],
    right: `row-${index}:${fragments[(index * 7 + 3) % fragments.length]}`,
  }));
  const csv = serializeCsv(rows, { columns: ['left', 'right'] });
  const expectedValues = [['left', 'right'], ...rows.map(({ left, right }) => [left, right])];
  assert.deepEqual(parseCsv(csv).map(({ values }) => values), expectedValues);

  const mapper = createMapper({ left: { type: 'string', trim: false, emptyValue: 'empty' }, right: { type: 'string', trim: false, emptyValue: 'empty' } });
  const expectedRows = rows;
  assert.deepEqual(mapper.map(csv).rows, expectedRows);

  for (let split = 0; split <= csv.length; split++) {
    async function* chunks() {
      yield csv.slice(0, split);
      yield csv.slice(split);
    }
    const streamed = [];
    for await (const item of mapper.mapStream(chunks())) {
      assert.deepEqual(item.errors, [], `split point ${split}`);
      streamed.push(item.data);
    }
    assert.deepEqual(streamed, expectedRows, `split point ${split}`);
  }

  async function* oneCodeUnitAtATime() {
    for (let index = 0; index < csv.length; index++) yield csv.slice(index, index + 1);
  }
  const charStream = [];
  for await (const item of mapper.mapStream(oneCodeUnitAtATime())) charStream.push(item.data);
  assert.deepEqual(charStream, expectedRows);
});

test('custom backslash quote escaping survives splits at every character', async () => {
  const csv = 'value\n"say \\\"hi\\\""';
  const mapper = createMapper({ value: { type: 'string' } }, { parser: { escape: '\\' } });
  assert.deepEqual(mapper.map(csv).rows, [{ value: 'say "hi"' }]);
  async function* oneCodeUnitAtATime() {
    for (let index = 0; index < csv.length; index++) yield csv.slice(index, index + 1);
  }
  const records = [];
  for await (const item of mapper.mapStream(oneCodeUnitAtATime())) records.push(item);
  assert.deepEqual(records.map(({ data }) => data), [{ value: 'say "hi"' }]);
  assert.deepEqual(records.flatMap(({ errors }) => errors), []);
});

test('mapStream accepts UTF-8 byte chunks and honors an overall error limit', async () => {
  const mapper = createMapper({ amount: { type: 'number', required: true } }, { maxErrors: 1 });
  async function* chunks() {
    yield new TextEncoder().encode('amount\n');
    yield new TextEncoder().encode('bad\nworse\n');
  }
  const records = [];
  for await (const item of mapper.mapStream(chunks())) records.push(item);
  assert.deepEqual(records.map(({ errors }) => errors.map(({ code }) => code)), [['MAX_ERRORS']]);
});

test('mapStream rejects mixed string and binary chunk types', async () => {
  async function* chunks() {
    yield 'value\n1\n';
    yield new TextEncoder().encode('2\n');
  }
  const records = [];
  for await (const item of createMapper({ value: { type: 'string' } }).mapStream(chunks())) records.push(item);
  assert.ok(records.some(({ errors }) => errors.some(({ code }) => code === 'INVALID_INPUT')));
});

test('stream retains completed rows before a malformed record in one chunk', async () => {
  const csv = 'id\n1\n2\n"bad"tail';
  const mapper = createMapper({ id: { type: 'number' } });
  async function* singleChunk() { yield csv; }
  async function* characterChunks() {
    for (let index = 0; index < csv.length; index++) yield csv.slice(index, index + 1);
  }
  async function collect(chunks) {
    const records = [];
    for await (const item of mapper.mapStream(chunks)) records.push(item);
    return records;
  }
  const one = await collect(singleChunk());
  const many = await collect(characterChunks());
  assert.deepEqual(one, many);
  assert.deepEqual(one.slice(0, 2).map(({ data }) => data), [{ id: 1 }, { id: 2 }]);
  assert.ok(one.some(({ errors }) => errors.some(({ code }) => code === 'INVALID_QUOTE')));
});

test('header-only streams emit header setup errors', async () => {
  async function* chunks() { yield 'unmapped\n'; }
  const records = [];
  for await (const item of createMapper({ expected: { type: 'string' } }, { unknownHeaders: 'error' }).mapStream(chunks())) records.push(item);
  assert.equal(records.length, 1);
  assert.equal(records[0].row, 1);
  assert.equal(records[0].data, null);
  assert.ok(records[0].errors.some(({ code }) => code === 'UNKNOWN_HEADER'));
});

test('stream header setup diagnostics retain physical header row 1', async () => {
  async function* chunks() { yield 'id,unused\n1,x\n'; }
  const records = [];
  for await (const item of createMapper({ id: { type: 'number' } }, { unknownHeaders: 'error' }).mapStream(chunks())) records.push(item);
  const setupError = records.flatMap(({ errors }) => errors).find(({ code }) => code === 'UNKNOWN_HEADER');
  assert.equal(setupError.row, 1);
});

test('string and UTF-8 byte streams treat a repeated leading BOM consistently', async () => {
  const input = '\uFEFF\uFEFFvalue\nx\n';
  const mapper = createMapper({ '\uFEFFvalue': { type: 'string' } });
  async function* strings() { yield input; }
  async function* bytes() { yield new TextEncoder().encode(input); }
  const stringRows = [];
  const byteRows = [];
  for await (const item of mapper.mapStream(strings())) stringRows.push(item);
  for await (const item of mapper.mapStream(bytes())) byteRows.push(item);
  assert.deepEqual(stringRows, byteRows);
  assert.deepEqual(stringRows.map(({ data }) => data), [{ '\uFEFFvalue': 'x' }]);
});

test('mapStream emits a terminal error-limit marker and stops consuming later rows', async () => {
  let consumedRows = 0;
  async function* chunks() {
    yield 'value\n';
    consumedRows++; yield 'bad\n';
    consumedRows++; yield 'worse\n';
    consumedRows++; yield '3\n';
  }
  const results = [];
  for await (const item of createMapper({ value: { type: 'number' } }, { maxErrors: 1 }).mapStream(chunks())) results.push(item);
  assert.deepEqual(results.flatMap(({ errors }) => errors.map(({ code }) => code)), ['MAX_ERRORS']);
  assert.equal(consumedRows, 1);
});

test('serializeCsv quotes delimiters, quotes, and newlines and round-trips data', () => {
  const source = [
    { name: 'Ada, Lovelace', note: 'said "hello"' },
    { name: 'Grace', note: 'line one\nline two' },
  ];
  const csv = serializeCsv(source);
  assert.match(csv, /"Ada, Lovelace"/);
  assert.match(csv, /"said ""hello"""/);
  const parsed = parseCsv(csv);
  assert.deepEqual(parsed.map(({ values }) => values), [
    ['name', 'note'],
    ['Ada, Lovelace', 'said "hello"'],
    ['Grace', 'line one\nline two'],
  ]);
});

test('serializeCsv applies its default formula protection to spreadsheet syntax', () => {
  const csv = serializeCsv([{ value: '=1+1' }]);
  assert.equal(parseCsv(csv)[1].values[0], "'=1+1");
});
