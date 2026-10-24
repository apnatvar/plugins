#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script with `npm run check:consumer` so npm can be launched portably.');
const allowedFiles = new Set(['package.json', 'README.md', 'LICENSE', 'SECURITY.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'PUBLISHING.md', 'THIRD_PARTY_NOTICES.md']);
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'business-hours-consumer-'));
const tempBase = path.resolve(os.tmpdir());

function assertSafeTempPath(target) {
  const resolved = path.resolve(target);
  if (path.dirname(resolved) !== tempBase || !path.basename(resolved).startsWith('business-hours-consumer-') || resolved === path.parse(resolved).root) {
    throw new Error(`Refusing to remove unexpected temporary path: ${resolved}`);
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

try {
  const packOutput = run(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', tempRoot], packageRoot);
  const [packed] = JSON.parse(packOutput);
  assert.ok(packed?.filename, 'npm pack did not report a tarball filename');
  const tarballPath = path.join(tempRoot, packed.filename);
  const packedPaths = packed.files.map(({ path: file }) => file.replaceAll('\\', '/'));

  for (const required of ['package.json', 'dist/index.js', 'dist/index.d.ts']) {
    assert.ok(packedPaths.includes(required), `tarball is missing ${required}`);
  }
  for (const file of packedPaths) {
    assert.doesNotMatch(file, /(^|\/)(src|test|tests|node_modules|\.git)(\/|$)/i, `unexpected development file in tarball: ${file}`);
    assert.doesNotMatch(file, /(^|\/)(\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx)|secrets?)(\/|$)/i, `possible secret in tarball: ${file}`);
    assert.ok(allowedFiles.has(file) || file.startsWith('dist/'), `unexpected file in tarball: ${file}`);
  }

  const consumerRoot = path.join(tempRoot, 'consumer');
  await mkdir(consumerRoot);
  await writeFile(path.join(consumerRoot, 'package.json'), JSON.stringify({ private: true, type: 'module' }, null, 2));
  run(process.execPath, [npmCli, 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-save', tarballPath], consumerRoot);

  const importedName = JSON.stringify(packageJson.name);
  await writeFile(path.join(consumerRoot, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import { BusinessHours, BusinessHoursError, validateSchedule } from ${importedName};
assert.equal(typeof BusinessHours, 'function');
assert.equal(typeof BusinessHoursError, 'function');
assert.equal(typeof validateSchedule, 'function');
const hours = new BusinessHours({ timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '17:00' }] } });
assert.equal(hours.isOpen('2024-01-08T09:00:00Z'), true);
assert.equal(hours.isOpen('2024-01-08T17:00:00Z'), false);
console.log('ESM consumer import passed');
`);
  run(process.execPath, [path.join(consumerRoot, 'consumer.mjs')], consumerRoot);

  const tscPath = path.join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  const tscPathJs = `${tscPath}.js`;
  let resolvedTsc = tscPath;
  try {
    await readFile(resolvedTsc);
  } catch {
    resolvedTsc = tscPathJs;
    await readFile(resolvedTsc);
  }
  await writeFile(path.join(consumerRoot, 'consumer.ts'), `
import { BusinessHours, BusinessHoursError, validateSchedule } from ${importedName};
const schedule = { timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '17:00' }] } };
validateSchedule(schedule);
const hours: BusinessHours = new BusinessHours(schedule);
const error: typeof BusinessHoursError = BusinessHoursError;
void error;
const open: boolean = hours.isOpen('2024-01-08T10:00:00Z');
void open;
`);
  run(process.execPath, [resolvedTsc, '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--strict', '--skipLibCheck', '--noEmit', 'consumer.ts'], consumerRoot);
  console.log(`Tarball consumer validation passed for ${packageJson.name}@${packageJson.version}`);
  console.log(`Tarball contents checked: ${packedPaths.length} files`);
} finally {
  assertSafeTempPath(tempRoot);
  await rm(tempRoot, { recursive: true, force: true });
}
