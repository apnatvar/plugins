import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(root, '../../sites/bd-plugins/dist');
const page = readFileSync(join(site, 'invoice-rules/index.html'), 'utf8');
const catalog = readFileSync(join(site, 'index.html'), 'utf8');
assert.ok(catalog.includes('href="/invoice-rules/"'));
const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate page IDs');
for (const [, href] of page.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  if (href.startsWith('#')) assert.ok(ids.includes(href.slice(1)), `Missing anchor ${href}`);
  else if (href.startsWith('/')) {
    const local = href.split('#')[0];
    const file = resolve(site, '.' + local, local.endsWith('/') ? 'index.html' : '');
    assert.ok(existsSync(file), `Missing local file ${href}`);
  }
}
const block = [...page.matchAll(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)].map(match => match[1]).find(code => code.includes('const invoice ='));
assert.ok(block, 'Working example missing');
const example = block.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
  .replaceAll("'@brownsmithdynamics/invoice-rules/india'", JSON.stringify(pathToFileURL(join(root, 'dist/india.js')).href))
  .replaceAll("'@brownsmithdynamics/invoice-rules'", JSON.stringify(pathToFileURL(join(root, 'dist/index.js')).href));
await import('data:text/javascript,' + encodeURIComponent(example + '\nif(!result.valid)throw new Error(JSON.stringify(result));'));
console.log('Website checks passed: local links/assets, unique anchors, catalog entry, and executed India example. No browser/layout check performed.');
