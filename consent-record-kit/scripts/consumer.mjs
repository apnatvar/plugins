#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status ?? result.signal})\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
};
const runNpm = (args, options = {}) => {
  // npm sets this for scripts; invoking npm's JS entry avoids .cmd spawn failures on Windows.
  const npmCli = process.env.npm_execpath;
  if (npmCli) return run(process.execPath, [npmCli, ...args], options);
  if (process.platform === 'win32') return run('npm.cmd', args, { shell: true, ...options });
  return run('npm', args, options);
};

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
assert.ok(packageJson.name, 'package.json must define a package name');
const temp = await mkdtemp(join(tmpdir(), 'consent-record-consumer-'));
let archive;
try {
  const packOutput = runNpm(['pack', '--json', '--offline', '--ignore-scripts']);
  const [packed] = JSON.parse(packOutput);
  const { filename } = packed;
  assert.equal(packed.name, packageJson.name);
  const packedPaths = packed.files.map(file => file.path);
  for (const required of ['dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE', 'SECURITY.md', 'PUBLISHING.md']) assert.ok(packedPaths.includes(required), required);
  for (const name of packedPaths) assert.match(name, /^(?:dist\/[^/]+\.(?:js|d\.ts)|docs\/[^/]+\.md|examples\/[^/]+\.mjs|(?:README|LICENSE|SECURITY|CHANGELOG|CONTRIBUTING|PUBLISHING|RELEASE_CHECKLIST)\.?(?:md)?|package\.json)$/);
  archive = resolve(root, filename);
  const app = join(temp, 'consumer');
  await mkdir(app);
  await writeFile(join(app, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  runNpm(['install', archive, '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: app });

  const consumerSource = `import { createReceipt, canonicalize, hashReceipt, type StorageAdapter } from ${JSON.stringify(packageJson.name)};\n` +
    `const receipt = createReceipt({ subject: { namespace: 'example', id: 'person-1' }, policyVersion: 'v1', purposes: [{ id: 'updates', granted: true }] });\n` +
    `const rows = new Map<string, typeof receipt>();\n` +
    `const storage: StorageAdapter = { async insert(value) { const record = 'receipt' in value ? value.receipt : value; if (rows.has(record.id)) return 'duplicate'; rows.set(record.id, record); return 'inserted'; }, async get(id) { return rows.get(id); } };\n` +
    `async function saveLifecycle() { const first = await storage.insert(receipt); const duplicate = await storage.insert(receipt); if (first !== 'inserted' || duplicate !== 'duplicate') throw new Error('storage contract'); const prior = await storage.get(receipt.id); if (!prior) throw new Error('missing prior record'); }\n` +
    `canonicalize(receipt);\nvoid hashReceipt(receipt);\n`;
  await writeFile(join(app, 'consumer.ts'), consumerSource);
  await writeFile(join(app, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: false },
    files: ['consumer.ts'],
  }, null, 2));

  const tsc = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc');
  try {
    await readFile(tsc);
    run(process.execPath, [tsc, '--project', join(app, 'tsconfig.json')], { cwd: app });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    throw new Error('TypeScript consumer check requires the package development dependency `typescript` to be installed.');
  }

  const consumerEntry = join(app, 'consumer.mjs');
  await writeFile(consumerEntry, `import assert from 'node:assert/strict';\nimport { createReceipt, createWithdrawal, canonicalize, hashReceipt } from ${JSON.stringify(packageJson.name)};\n` +
    `const receipt = createReceipt({ subject: { namespace: 'consumer', id: 'person-1' }, policyVersion: 'v1', purposes: [{ id: 'updates', granted: true }] });\n` +
    `const rows = new Map(); const storage = { async insert(value) { const record = 'receipt' in value ? value.receipt : value; if (rows.has(record.id)) return 'duplicate'; rows.set(record.id, record); return 'inserted'; }, async get(id) { return rows.get(id); } };\n` +
    `assert.deepEqual(await Promise.all([storage.insert(receipt), storage.insert(receipt)]), ['inserted', 'duplicate']);\n` +
    `const withdrawal = createWithdrawal(receipt, { purposes: ['updates'] }); assert.equal(withdrawal.previousRecordId, receipt.id); assert.equal(await storage.insert(withdrawal), 'inserted');\n` +
    `assert.equal((await storage.get(withdrawal.id)).type, 'withdrawal'); assert.equal(receipt.type, 'consent');\n` +
    `assert.ok(canonicalize(receipt)); assert.equal(typeof await hashReceipt(receipt), 'string');\n`);
  run(process.execPath, [consumerEntry], { cwd: app });
  process.stdout.write('Packed package runtime import and TypeScript consumer checks passed.\n');
} finally {
  await rm(temp, { recursive: true, force: true });
  if (archive) await rm(archive, { force: true });
}
