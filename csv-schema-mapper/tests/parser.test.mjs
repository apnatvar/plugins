import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../dist/index.js';

test('parseCsv handles quoted delimiters, escaped quotes, and embedded newlines', () => {
  const parsed = parseCsv('name,note\r\nAda,"said ""hello"", then left"\r\nGrace,"line one\nline two"');
  assert.deepEqual(parsed, [
    { values: ['name', 'note'], row: 1 },
    { values: ['Ada', 'said "hello", then left'], row: 2 },
    { values: ['Grace', 'line one\nline two'], row: 3 },
  ]);
});

test('parseCsv preserves empty cells and trailing empty cells', () => {
  assert.deepEqual(parseCsv('a,b,c\n1,,\n,2,3'), [
    { values: ['a', 'b', 'c'], row: 1 },
    { values: ['1', '', ''], row: 2 },
    { values: ['', '2', '3'], row: 3 },
  ]);
});

test('parseCsv treats a UTF-8 BOM at the start as a header marker', () => {
  const parsed = parseCsv('\uFEFFname,value\nAda,1');
  assert.equal(parsed[0].values[0], 'name');
  assert.deepEqual(parsed[1].values, ['Ada', '1']);
});

test('parseCsv reports the physical starting line for multiline records', () => {
  const parsed = parseCsv('a,b\n1,"line one\nline two"\n2,x');
  assert.deepEqual(parsed.map((record) => record.row), [1, 2, 4]);
});

test('parseCsv preserves CRLF bytes inside quoted multiline cells', () => {
  const parsed = parseCsv('a,b\r\n1,"line one\r\nline two"\r\n2,x');
  assert.equal(parsed[1].values[1], 'line one\r\nline two');
  assert.deepEqual(parsed.map(({ row }) => row), [1, 2, 4]);
});

test('parseCsv rejects an unterminated quoted field with a safe structured error', () => {
  assert.throws(
    () => parseCsv('name,note\nAda,"secret data'),
    (error) => {
      assert.equal(error.name, 'CsvParseError');
      assert.equal(typeof error.code, 'string');
      assert.equal(typeof error.message, 'string');
      assert.equal(error.message.includes('secret data'), false);
      return true;
    },
  );
});
