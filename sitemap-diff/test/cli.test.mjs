import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { urlset } from './helpers.mjs';

const packageDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cli = join(packageDir, 'dist', 'cli.js');
const node = process.execPath;

test('CLI prints a JSON diff by default and supports markdown output', () => {
  withFixture((dir) => {
    const before = writeSitemap(dir, 'before.xml', [{ loc: 'https://example.com/old' }]);
    const after = writeSitemap(dir, 'after.xml', [{ loc: 'https://example.com/new' }]);

    const json = run(before, after);
    assert.equal(json.status, 0, json.stderr);
    const report = JSON.parse(json.stdout);
    assert.equal(report.summary.added, 1);
    assert.equal(report.summary.removed, 1);

    const markdown = run(before, after, '--format', 'markdown');
    assert.equal(markdown.status, 0, markdown.stderr);
    assert.match(markdown.stdout, /Added/i);
    assert.match(markdown.stdout, /Removed/i);
  });
});

test('CLI writes requested report output and supports help', () => {
  withFixture((dir) => {
    const before = writeSitemap(dir, 'before.xml', []);
    const after = writeSitemap(dir, 'after.xml', [{ loc: 'https://example.com/page' }]);
    const output = join(dir, 'report.json');

    const result = run(before, after, '--output', output);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).summary.added, 1);

    const help = spawnSync(node, [cli, '--help'], { encoding: 'utf8' });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /--format/);
    assert.match(help.stdout, /--allow-private-networks/);
  });
});

test('CLI errors exit nonzero and do not print control characters from bad input', () => {
  withFixture((dir) => {
    const before = join(dir, 'before.xml');
    const after = writeSitemap(dir, 'after.xml', []);
    writeFileSync(before, `<urlset>\u001b</urlset>`);

    const result = run(before, after);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/);
  });
});

test('CLI reads gzip-compressed local sitemaps', () => {
  withFixture((dir) => {
    const before = join(dir, 'before.xml.gz');
    const after = writeSitemap(dir, 'after.xml', [{ loc: 'https://example.com/new' }]);
    writeFileSync(before, gzipSync(urlset([{ loc: 'https://example.com/old' }])));

    const result = run(before, after);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.added, 1);
    assert.equal(report.summary.removed, 1);
  });
});

test('CLI rejects invalid formats, missing positional arguments, and missing files', () => {
  withFixture((dir) => {
    const before = writeSitemap(dir, 'before.xml', []);
    const after = writeSitemap(dir, 'after.xml', []);
    assert.notEqual(run(before, after, '--format', 'csv').status, 0);
    assert.notEqual(run(before).status, 0);
    assert.notEqual(run(join(dir, 'missing.xml'), after).status, 0);
  });
});

function run(...args) {
  return spawnSync(node, [cli, ...args], { encoding: 'utf8', timeout: 10_000 });
}

function withFixture(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'sitemap-diff-cli-'));
  try {
    callback(dir);
  } finally {
    const resolvedDir = resolve(dir);
    const rel = relative(resolve(tmpdir()), resolvedDir);
    assert.ok(rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`), 'CLI fixture directory must remain within os.tmpdir()');
    assert.ok(basename(resolvedDir).startsWith('sitemap-diff-cli-'), 'CLI fixture directory must have the expected prefix');
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeSitemap(dir, filename, entries) {
  const path = join(dir, filename);
  writeFileSync(path, urlset(entries), 'utf8');
  return path;
}
