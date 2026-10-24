import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run using npm run check:consumer');
const staging = resolve(root, '.consumer-check');
mkdirSync(staging, { recursive: true });
const consumer = mkdtempSync(join(staging, 'project-'));
const configArgs = ['--userconfig', resolve(root, 'scripts/public-user.npmrc'), '--globalconfig', resolve(root, 'scripts/public-global.npmrc'), '--cache', resolve(root, '.npm-cache')];
function npm(args, cwd) {
  const result = spawnSync(process.execPath, [npmCli, ...configArgs, ...args], { cwd, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'npm command failed');
  return result.stdout;
}
const pack = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', consumer], root))[0];
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'csv-schema-mapper-consumer-check', private: true, type: 'module' }));
npm(['install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund', join(consumer, pack.filename)], consumer);
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
writeFileSync(join(consumer, 'check.mjs'), `
import assert from 'node:assert/strict';
import { createMapper, serializeCsv } from '${pkg.name}';
import { mapFile, mapFileStream } from '${pkg.name}/node';
import { writeFileSync } from 'node:fs';
const schema = { name: { type: 'string', required: true, aliases: ['Full Name'] }, age: { type: 'number' } };
const csv = 'Full Name,age\\nAda Lovelace,36';
const result = createMapper(schema).map(csv);
assert.deepEqual(result.rows, [{ name: 'Ada Lovelace', age: 36 }]);
assert.deepEqual(result.errors, []);
assert.equal(serializeCsv(result.rows), 'name,age\\r\\nAda Lovelace,36');
writeFileSync('sample.csv', csv);
assert.deepEqual((await mapFile('sample.csv', schema)).rows, result.rows);
const streamed = []; for await (const row of mapFileStream('sample.csv', schema)) streamed.push(row.data);
assert.deepEqual(streamed, result.rows);
`);
writeFileSync(join(consumer, 'check.ts'), `
import { createMapper, type Schema, type MappingResult, type RowResult } from '${pkg.name}';
import { mapFile, mapFileStream } from '${pkg.name}/node';
const schema = { name: { type: 'string', required: true } } satisfies Schema;
const result: MappingResult = createMapper(schema).map('name\\nAda');
const fileResult: Promise<MappingResult> = mapFile('sample.csv', schema);
const streamResult: AsyncGenerator<RowResult> = mapFileStream('sample.csv', schema);
void [result, fileResult, streamResult];
`);
for (const [args, label] of [
  [[join(consumer, 'check.mjs')], 'ESM root and Node subpath runtime'],
  [[resolve(root, 'node_modules/typescript/bin/tsc'), '--strict', '--noEmit', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', join(consumer, 'check.ts')], 'TypeScript declaration consumption'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: consumer, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(`${label}: ${result.stdout}${result.stderr}`);
  console.log(`PASS ${label}`);
}
console.log(`Packed ${pack.filename}; ${pack.entryCount} entries; ${pack.size} bytes; SHA512 ${pack.integrity}`);
