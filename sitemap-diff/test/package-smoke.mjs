#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, '..');
const packageJson = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
function npmCli() {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) return process.env.npm_execpath;
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    for (const candidate of [join(directory, 'node_modules/npm/bin/npm-cli.js'), join(directory, 'npm')]) {
      if (existsSync(candidate)) {
        const actual = realpathSync(candidate);
        if (actual.endsWith('.js')) return actual;
      }
    }
  }
  throw new Error('Cannot locate npm-cli.js; run this script through npm exec -- node');
}
const tarballArg = process.argv[2];
if (!tarballArg) {
  console.error('Usage: node test/package-smoke.mjs <tarball-path>');
  process.exitCode = 2;
} else {
  const tarball = isAbsolute(tarballArg) ? tarballArg : resolve(process.cwd(), tarballArg);
  const tempDir = mkdtempSync(join(tmpdir(), 'sitemap-diff-package-smoke-'));
  try {
    const install = spawnSync(process.execPath, [npmCli(),
      'install', '--prefix', tempDir, '--ignore-scripts', '--no-audit', '--no-fund', tarball,
    ], {
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, npm_config_cache: join(packageDir, '.npm-cache') },
    });
    assert.equal(install.status, 0, `npm install failed:\n${install.stdout}\n${install.stderr}`);

    const installedPackageDir = join(tempDir, 'node_modules', ...packageJson.name.split('/'));
    const installedPackageJson = JSON.parse(readFileSync(join(installedPackageDir, 'package.json'), 'utf8'));
    const importScript = join(tempDir, 'smoke-import.mjs');
    const subpaths = Object.keys(installedPackageJson.exports ?? {}).filter((entry) => entry.startsWith('./') && entry !== './package.json');
    const importChecks = subpaths.map((entry) => `await import(${JSON.stringify(`${packageJson.name}${entry.slice(1)}`)});`).join('\n');
    writeFileSync(importScript, `
      import assert from 'node:assert/strict';
      const root = await import(${JSON.stringify(packageJson.name)});
      assert.equal(typeof root.loadSitemap, 'function');
      assert.equal(typeof root.diffSitemaps, 'function');
      ${importChecks}
    `, 'utf8');
    const packageImport = spawnSync(process.execPath, [importScript], { encoding: 'utf8', cwd: tempDir, timeout: 10_000 });
    assert.equal(packageImport.status, 0, `package-name imports failed:\n${packageImport.stdout}\n${packageImport.stderr}`);

    for (const [subpath, conditions] of Object.entries(installedPackageJson.exports ?? {})) {
      if (subpath === './package.json') continue;
      const declaration = typeof conditions === 'string' ? undefined : conditions?.types;
      assert.ok(declaration, `export ${subpath} must expose a TypeScript declaration`);
      assert.ok(readFileSync(join(installedPackageDir, declaration), 'utf8').length > 0, `declaration for ${subpath} must be packaged`);
    }

    const binSpec = typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.[packageJson.name] ?? Object.values(packageJson.bin ?? {})[0];
    assert.ok(binSpec, 'package.json must expose a CLI bin');
    const binPath = join(installedPackageDir, binSpec);
    const cli = spawnSync(process.execPath, [binPath, '--help'], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(cli.status, 0, `installed CLI failed:\n${cli.stdout}\n${cli.stderr}`);
    assert.match(cli.stdout, /--format/);

    const before = join(tempDir, 'before.xml');
    const after = join(tempDir, 'after.xml');
    writeFileSync(before, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/old</loc></url></urlset>');
    writeFileSync(after, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/new</loc></url></urlset>');
    const comparison = spawnSync(process.execPath, [binPath, before, after], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(comparison.status, 0, `installed CLI comparison failed:\n${comparison.stdout}\n${comparison.stderr}`);
    assert.equal(JSON.parse(comparison.stdout).summary.added, 1);
    assert.equal(JSON.parse(comparison.stdout).summary.removed, 1);

    console.log(`Package smoke passed for ${packageJson.name}`);
  } finally {
    const resolvedTempDir = resolve(tempDir);
    const rel = relative(resolve(tmpdir()), resolvedTempDir);
    assert.ok(rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`), 'temporary directory must remain within os.tmpdir()');
    assert.ok(basename(resolvedTempDir).startsWith('sitemap-diff-package-smoke-'), 'temporary directory must have the expected prefix');
    rmSync(tempDir, { recursive: true, force: true });
  }
}
