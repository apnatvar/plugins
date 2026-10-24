import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mapFile, mapFileStream } from '../dist/node.js';

const schema = { id: { type: 'number' }, label: { type: 'string' } };

test('mapFile maps a UTF-8 CSV file using the core schema contract', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'csv-schema-mapper-'));
  try {
    const path = join(dir, 'input.csv');
    await writeFile(path, 'id,label\n7,seven\n', 'utf8');
    const result = await mapFile(path, schema);
    assert.deepEqual(result.rows, [{ id: 7, label: 'seven' }]);
    assert.deepEqual(result.errors, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('mapFileStream yields per-row records from a file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'csv-schema-mapper-'));
  try {
    const path = join(dir, 'input.csv');
    await writeFile(path, 'id,label\n7,seven\n8,eight\n', 'utf8');
    const rows = [];
    for await (const item of mapFileStream(path, schema)) rows.push(item);
    assert.deepEqual(rows.map(({ data }) => data), [
      { id: 7, label: 'seven' },
      { id: 8, label: 'eight' },
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
