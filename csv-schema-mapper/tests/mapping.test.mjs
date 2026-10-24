import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapper, suggestMappings } from '../dist/index.js';

const basicSchema = {
  name: { type: 'string', required: true, aliases: ['Full Name'] },
  age: { type: 'number' },
  active: { type: 'boolean' },
};

test('createMapper maps headers and converts supported primitive types', () => {
  const result = createMapper(basicSchema).map('name,age,active\nAda,36,true\nGrace,85,false');
  assert.deepEqual(result.rows, [
    { name: 'Ada', age: 36, active: true },
    { name: 'Grace', age: 85, active: false },
  ]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.headers, ['name', 'age', 'active']);
  assert.deepEqual(result.mappings.map(({ field, column, index, method }) => ({ field, column, index, method })), [
    { field: 'name', column: 'name', index: 0, method: 'exact' },
    { field: 'age', column: 'age', index: 1, method: 'exact' },
    { field: 'active', column: 'active', index: 2, method: 'exact' },
  ]);
});

test('mapping precedence uses explicit mappings, exact headers, then aliases', () => {
  const schema = {
    name: { type: 'string', aliases: ['Full name'] },
    city: { type: 'string', aliases: ['Town'] },
  };
  const result = createMapper(schema, { mappings: { name: 1 } }).map('name,preferred,Full name,Town\nignored,Ada,Also Ada,London');
  assert.deepEqual(result.rows, [{ name: 'Ada', city: 'London' }]);
  assert.deepEqual(result.mappings.map(({ method }) => method), ['explicit', 'alias']);
});

test('explicit numeric mapping keeps its requested index under duplicate policies', () => {
  const schema = { id: { type: 'string' } };
  const result = createMapper(schema, { mappings: { id: 1 }, duplicateHeaders: 'first' })
    .map('id,id\nfirst,second');
  assert.deepEqual(result.rows, [{ id: 'second' }]);
  assert.equal(result.mappings[0].index, 1);
  assert.equal(result.mappings[0].method, 'explicit');
});

test('header matching can ignore case and normalize punctuation and spaces', () => {
  const schema = { first_name: { type: 'string' }, postal_code: { type: 'string' } };
  const result = createMapper(schema, { matching: { caseInsensitive: true, normalize: true } })
    .map('FIRST NAME,Postal-Code\nAda,12345');
  assert.deepEqual(result.rows, [{ first_name: 'Ada', postal_code: '12345' }]);
});

test('fuzzy suggestions are opt-in and report selected mapping metadata', () => {
  const schema = { email: { type: 'string' } };
  const withoutSuggestion = createMapper(schema).map('e-mail address\na@example.test');
  assert.equal(withoutSuggestion.mappings[0].method, 'missing');
  const withSuggestion = createMapper(schema, { matching: { suggestions: true, minConfidence: 0.1 } })
    .map('e-mail address\na@example.test');
  assert.equal(withSuggestion.mappings[0].method, 'suggestion');
  assert.equal(withSuggestion.rows[0].email, 'a@example.test');
  assert.ok(withSuggestion.mappings[0].confidence >= 0.1);
});

test('suggestMappings returns one result per schema field without reading row data', () => {
  const mapping = suggestMappings(['Full Name', 'years'], {
    name: { type: 'string', aliases: ['Full Name'] },
    age: { type: 'number', aliases: ['years'] },
  });
  assert.deepEqual(mapping.map(({ field, column, index, method }) => ({ field, column, index, method })), [
    { field: 'name', column: 'Full Name', index: 0, method: 'alias' },
    { field: 'age', column: 'years', index: 1, method: 'alias' },
  ]);
});

test('required and conversion failures are structured, bounded, and redact cell contents', () => {
  const mapper = createMapper({
    id: { type: 'number', required: true },
    name: { type: 'string', required: true },
  }, { maxErrors: 3 });
  const result = mapper.map('id,name\nnot-a-number,TOP_SECRET\n,also-secret\ninvalid,more-secret');
  assert.ok(result.errors.length <= 3);
  assert.ok(result.errors.some(({ code }) => code === 'CONVERSION'));
  assert.ok(result.errors.some(({ code }) => code === 'REQUIRED'));
  assert.equal(JSON.stringify(result.errors).includes('secret'), false);
});

test('empty policies distinguish omitted, null, and empty-string values', () => {
  const schema = {
    omitted: { type: 'string', emptyValue: 'omit' },
    nil: { type: 'string', emptyValue: 'null', nullable: true },
    empty: { type: 'string', emptyValue: 'empty' },
  };
  const result = createMapper(schema).map('omitted,nil,empty\n,,');
  assert.deepEqual(result.rows, [{ nil: null, empty: '' }]);
});

test('date fields support ISO and date-only output', () => {
  const result = createMapper({
    timestamp: { type: 'date', format: 'iso' },
    day: { type: 'date', format: 'date-only' },
  }).map('timestamp,day\n2024-02-03,2024-02-03');
  assert.ok(result.rows[0].timestamp instanceof Date);
  assert.equal(result.rows[0].timestamp.toISOString(), '2024-02-03T00:00:00.000Z');
  assert.equal(result.rows[0].day, '2024-02-03');
});

test('date parsing handles years 0000-0099 and rejects invalid leap days', () => {
  const result = createMapper({ day: { type: 'date', format: 'iso' } }).map('day\n0000-02-29');
  assert.ok(result.rows[0].day instanceof Date);
  assert.equal(result.rows[0].day.toISOString(), '0000-02-29T00:00:00.000Z');
  const nonLeapCentury = createMapper({ day: { type: 'date', format: 'date-only' } }).map('day\n0100-02-29');
  assert.ok(nonLeapCentury.errors.some(({ code }) => code === 'CONVERSION'));
  const invalid = createMapper({ day: { type: 'date', format: 'date-only' } }).map('day\n1900-02-29');
  assert.ok(invalid.errors.some(({ code }) => code === 'CONVERSION'));
});

test('ragged records are rejected with a structured row-width error', () => {
  const result = createMapper({ a: { type: 'string' }, b: { type: 'string' } }).map('a,b\n1\n2,3,4');
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.filter(({ code }) => code === 'ROW_WIDTH').length, 2);
});

test('number conversion rejects unsafe integer precision', () => {
  const result = createMapper({ value: { type: 'number' } }).map('value\n9007199254740993');
  assert.ok(result.errors.some(({ code }) => code === 'CONVERSION'));
});

test('number conversion rejects nonzero underflow while accepting explicit zero exponents', () => {
  const underflow = createMapper({ value: { type: 'number' } }).map('value\n1e-9999');
  assert.ok(underflow.errors.some(({ code }) => code === 'CONVERSION'));
  const zero = createMapper({ value: { type: 'number' } }).map('value\n0e-10');
  assert.deepEqual(zero.rows, [{ value: 0 }]);
});

test('transform values must remain compatible with the declared field type', () => {
  const result = createMapper({ value: { type: 'number', transform: () => 'not a number' } }).map('value\nx');
  assert.ok(result.errors.some(({ code }) => code === 'TRANSFORM'));
});

test('unknown and duplicate header policies are enforceable', () => {
  const schema = { id: { type: 'string' } };
  const unknown = createMapper(schema, { unknownHeaders: 'error' }).map('id,extra\n1,x');
  assert.ok(unknown.errors.some(({ code }) => code === 'UNKNOWN_HEADER'));
  const duplicate = createMapper(schema, { duplicateHeaders: 'error' }).map('id,id\n1,2');
  assert.ok(duplicate.errors.some(({ code }) => code === 'DUPLICATE_HEADER'));
  assert.equal(createMapper(schema, { duplicateHeaders: 'first' }).map('id,id\n1,2').rows[0].id, '1');
  assert.equal(createMapper(schema, { duplicateHeaders: 'last' }).map('id,id\n1,2').rows[0].id, '2');
});

test('map reports a terminal MAX_ERRORS marker when more failures are truncated', () => {
  const result = createMapper({ value: { type: 'number' } }, { maxErrors: 1 }).map('value\nbad\nworse');
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, 'MAX_ERRORS');
});

test('matching rejects excessive header and alias counts before comparing them', () => {
  assert.throws(() => suggestMappings(Array.from({ length: 10_001 }, (_, i) => `h${i}`), { a: { type: 'string' } }));
  assert.throws(() => suggestMappings(['a'], { a: { type: 'string', aliases: Array.from({ length: 101 }, (_, i) => `a${i}`) } }));
  assert.throws(() => suggestMappings(['h'.repeat(513)], { a: { type: 'string' } }));
  assert.throws(() => suggestMappings(Array.from({ length: 300 }, (_, i) => `h${i}`), {
    a: { type: 'string', aliases: Array.from({ length: 10 }, (_, i) => `alias${i}`) },
  }, { suggestions: true }));
});

test('transform output replaces built-in conversion and thrown transforms become safe errors', () => {
  const ok = createMapper({ score: { type: 'number', transform: (value) => Number(value.replace('%', '')) } })
    .map('score\n42%');
  assert.deepEqual(ok.rows, [{ score: 42 }]);
  const bad = createMapper({ secret: { type: 'string', transform: () => { throw new Error('private detail'); } } })
    .map('secret\nraw-private-value');
  assert.ok(bad.errors.some(({ code }) => code === 'TRANSFORM'));
  assert.equal(JSON.stringify(bad.errors).includes('private'), false);
});
