import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSitemap, diffSitemaps } from '../dist/index.js';
import { SITEMAP_NS, urlset } from './helpers.mjs';

test('loads a sitemap XML string into URL entries with sitemap metadata', async () => {
  const entries = await loadSitemap(urlset([
    { loc: 'https://example.com/a', lastmod: '2026-10-20', changefreq: 'weekly', priority: '0.8' },
    { loc: 'https://example.com/b' },
  ]));

  assert.deepEqual(entries, [
    { loc: 'https://example.com/a', lastmod: '2026-10-20', changefreq: 'weekly', priority: '0.8' },
    { loc: 'https://example.com/b' },
  ]);
});

test('accepts already-parsed sitemap objects and entry arrays', async () => {
  assert.deepEqual(await loadSitemap({ type: 'urlset', entries: [{ loc: 'https://example.com/a' }] }), [
    { loc: 'https://example.com/a' },
  ]);
  assert.deepEqual(await loadSitemap([{ loc: 'https://example.com/b' }]), [
    { loc: 'https://example.com/b' },
  ]);
  assert.deepEqual(await loadSitemap({ type: 'sitemapindex', entries: [] }), []);
});

test('rejects malformed XML, a non-sitemap namespace, and invalid fields', async (t) => {
  const invalidDocuments = [
    ['malformed XML', '<urlset><url>'],
    ['wrong namespace', '<urlset xmlns="urn:wrong"><url><loc>https://example.com</loc></url></urlset>'],
    ['missing loc', `<urlset xmlns="${SITEMAP_NS}"><url><lastmod>2026-10-20</lastmod></url></urlset>`],
    ['invalid priority', `<urlset xmlns="${SITEMAP_NS}"><url><loc>https://example.com</loc><priority>1.1</priority></url></urlset>`],
    ['external entities', `<!DOCTYPE urlset [<!ENTITY x SYSTEM "file:///etc/passwd">]><urlset xmlns="${SITEMAP_NS}"><url><loc>&x;</loc></url></urlset>`],
    ['nested element inside loc', `<urlset xmlns="${SITEMAP_NS}"><url><loc>https://example.com/<nested>bad</nested></loc></url></urlset>`],
  ];
  for (const [label, xml] of invalidDocuments) {
    await t.test(label, async () => {
      await assert.rejects(loadSitemap(xml));
    });
  }
});

test('tolerates foreign-namespace extension elements without treating them as sitemap fields', async () => {
  const xml = `<urlset xmlns="${SITEMAP_NS}" xmlns:x="urn:extension"><url><loc>https://example.com/one</loc><x:meta><x:ignored>value</x:ignored></x:meta></url></urlset>`;
  assert.deepEqual(await loadSitemap(xml), [{ loc: 'https://example.com/one' }]);
});

test('enforces byte and entry limits while parsing XML input', async () => {
  const document = urlset([{ loc: 'https://example.com/a' }, { loc: 'https://example.com/b' }]);
  await assert.rejects(loadSitemap(document, { maxBytes: 32 }), /byte|size|limit|exceed/i);
  await assert.rejects(loadSitemap(document, { maxEntries: 1 }), /entry|limit|exceed/i);
});

test('rejects invalid network and recursion options', async () => {
  await assert.rejects(loadSitemap(urlset([]), { timeoutMs: 0 }));
  await assert.rejects(loadSitemap(urlset([]), { maxDepth: -1 }));
  await assert.rejects(loadSitemap(urlset([]), { allowPrivateNetworks: 'yes' }));
});

test('enforces byte budgets for empty parsed sources and rejects empty URL userinfo', async () => {
  await assert.rejects(loadSitemap([], { maxBytes: 1 }), /byte|budget|limit/i);
  await assert.rejects(loadSitemap([{ loc: 'http://@example.com/path' }]));
});

test('diffs additions, removals, metadata changes, and unchanged URLs', async () => {
  const before = urlset([
    { loc: 'https://example.com/keep', lastmod: '2026-10-01', priority: '0.5' },
    { loc: 'https://example.com/remove' },
    { loc: 'https://example.com/change', changefreq: 'weekly' },
  ]);
  const after = urlset([
    { loc: 'https://example.com/keep', lastmod: '2026-10-01', priority: '0.5' },
    { loc: 'https://example.com/add' },
    { loc: 'https://example.com/change', changefreq: 'daily' },
  ]);

  const result = await diffSitemaps(before, after);
  assert.deepEqual(result.added.map(({ loc }) => loc), ['https://example.com/add']);
  assert.deepEqual(result.removed.map(({ loc }) => loc), ['https://example.com/remove']);
  assert.equal(result.changed.length, 1);
  assert.equal(result.changed[0].url, 'https://example.com/change');
  assert.deepEqual(result.changed[0].fields, { changefreq: { before: 'weekly', after: 'daily' } });
  assert.equal(result.summary.unchanged, 1);
  assert.deepEqual(result.summary, {
    added: 1, removed: 1, changed: 1, unchanged: 1, duplicatesBefore: 0, duplicatesAfter: 0,
  });
});

test('reports duplicate normalized URLs and retains duplicate entries in source order', async () => {
  const before = [
    { loc: 'https://example.com/a/' },
    { loc: 'https://example.com/a' },
    { loc: 'https://example.com/b' },
  ];
  const after = [{ loc: 'https://example.com/a' }, { loc: 'https://example.com/a/' }];
  const result = await diffSitemaps(before, after, { normalization: { stripTrailingSlash: true } });

  assert.deepEqual(result.duplicates.before.map(({ url }) => url), ['https://example.com/a']);
  assert.deepEqual(result.duplicates.before[0].entries.map(({ loc }) => loc), ['https://example.com/a/', 'https://example.com/a']);
  assert.equal(result.summary.duplicatesBefore, 1);
  assert.equal(result.summary.duplicatesAfter, 1);
  assert.equal(result.added.length, 0);
  assert.equal(result.removed.length, 1);
});

test('normalization options compare equivalent URLs while retaining original loc values', async () => {
  const before = [{ loc: 'https://EXAMPLE.com/Path/?z=2&a=1#part' }];
  const after = [{ loc: 'https://example.com/path?a=1&z=2' }];
  const result = await diffSitemaps(before, after, {
    normalization: { stripHash: true, stripTrailingSlash: true, sortQuery: true, lowercasePath: true },
  });

  assert.equal(result.added.length, 0);
  assert.equal(result.removed.length, 0);
  assert.equal(result.summary.unchanged, 1);
  assert.equal(result.changed.length, 0);
});

test('removes configured query parameters during comparison', async () => {
  const result = await diffSitemaps(
    [{ loc: 'https://example.com/page?utm_source=old&id=7' }],
    [{ loc: 'https://example.com/page?id=7&utm_source=new' }],
    { normalization: { removeQueryParams: ['utm_source'], sortQuery: true } },
  );
  assert.equal(result.summary.unchanged, 1);
  assert.equal(result.added.length, 0);
  assert.equal(result.removed.length, 0);
});

test('rejects unsafe or malformed URL locations supplied as entries', async () => {
  await assert.rejects(diffSitemaps([], [{ loc: 'javascript:alert(1)' }]));
  await assert.rejects(diffSitemaps([{ loc: 'not a URL' }], []));
  await assert.rejects(diffSitemaps([{ loc: 'https://example.com/path\\@attacker.example' }], []));
  await assert.rejects(diffSitemaps([{ loc: 'https://example.com/\u0001path' }], []));
});

test('enforces entry limits for direct entry arrays', async () => {
  await assert.rejects(
    diffSitemaps([], [{ loc: 'https://example.com/1' }, { loc: 'https://example.com/2' }], { maxEntries: 1 }),
    /limit|entries|exceed/i,
  );
});
