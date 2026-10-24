import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareSitemaps,
  normalizeUrl,
  parseSitemap,
  toJsonReport,
  toMarkdownReport,
} from '../dist/index.js';
import { SITEMAP_NS } from './helpers.mjs';

test('parseSitemap supports prefixed namespaces and decodes predefined and numeric XML entities', () => {
  const xml = `<?xml version="1.0"?><sm:urlset xmlns:sm="${SITEMAP_NS}"><sm:url><sm:loc>https://example.com/p?a=1&amp;b=&#50;</sm:loc></sm:url></sm:urlset>`;
  assert.deepEqual(parseSitemap(xml), {
    type: 'urlset',
    entries: [{ loc: 'https://example.com/p?a=1&b=2' }],
  });
});

test('parseSitemap accepts a UTF-8 BOM and declaration, and rejects non-UTF-8 declarations', () => {
  const xml = `\uFEFF<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="${SITEMAP_NS}"/>`;
  assert.deepEqual(parseSitemap(xml), { type: 'urlset', entries: [] });
  assert.throws(() => parseSitemap(xml.replace('UTF-8', 'UTF-16')), /UTF-8/i);
});

test('parseSitemap rejects duplicate fields, malformed structure, and excessive element depth', () => {
  const duplicate = `<urlset xmlns="${SITEMAP_NS}"><url><loc>https://example.com/a</loc><loc>https://example.com/b</loc></url></urlset>`;
  const misplaced = `<urlset xmlns="${SITEMAP_NS}"><lastmod>2026-10-20</lastmod></urlset>`;
  const extension = '<x xmlns="urn:extension">'.repeat(127) + '</x>'.repeat(127);
  const tooDeep = `<urlset xmlns="${SITEMAP_NS}"><url><loc>https://example.com/a</loc>${extension}</url></urlset>`;

  assert.throws(() => parseSitemap(duplicate), /duplicate loc/i);
  assert.throws(() => parseSitemap(misplaced), /unexpected lastmod/i);
  assert.throws(() => parseSitemap('<urlset>'), /malformed|namespace/i);
  assert.throws(() => parseSitemap(tooDeep), /depth/i);
});

test('parseSitemap enforces lastmod date and datetime boundaries', () => {
  for (const value of ['2026-02-29', '2026-10-20T24:00:00Z', '2026-10-20T12:61:00Z', '2026-10-20T12:00:00+25:00']) {
    const xml = `<urlset xmlns="${SITEMAP_NS}"><url><loc>https://example.com/a</loc><lastmod>${value}</lastmod></url></urlset>`;
    assert.throws(() => parseSitemap(xml), /lastmod/i, value);
  }
  const valid = `<urlset xmlns="${SITEMAP_NS}"><url><loc>https://example.com/a</loc><lastmod>2024-02-29T23:59:59.123+05:30</lastmod></url></urlset>`;
  assert.equal(parseSitemap(valid).entries[0].lastmod, '2024-02-29T23:59:59.123+05:30');
});

test('normalizeUrl applies normalization rules and validates credentials and schemes', () => {
  assert.equal(
    normalizeUrl('https://EXAMPLE.com/Path/?z=2&utm_source=x&a=1#fragment', {
      stripHash: true,
      stripTrailingSlash: true,
      sortQuery: true,
      removeQueryParams: ['utm_source'],
      lowercasePath: true,
    }),
    'https://example.com/path?a=1&z=2',
  );
  assert.equal(normalizeUrl('https://example.com/path#fragment'), 'https://example.com/path');
  for (const url of ['http://@example.com/path', 'http://user:pass@example.com/path', 'ftp://example.com/path', 'https://example.com/a\\b', 'https://example.com/a\u0001b']) {
    assert.throws(() => normalizeUrl(url), undefined, url);
  }
});

test('compareSitemaps compares parsed indexes by location and reports metadata field additions and removals', () => {
  const before = {
    type: 'sitemapindex',
    entries: [
      { loc: 'https://example.com/a.xml' },
      { loc: 'https://example.com/b.xml', lastmod: '2026-01-01', changefreq: 'weekly', priority: '0.4' },
    ],
  };
  const after = {
    type: 'sitemapindex',
    entries: [
      { loc: 'https://example.com/a.xml', lastmod: '2026-01-02', changefreq: 'monthly', priority: '0.8' },
      { loc: 'https://example.com/b.xml' },
    ],
  };
  const result = compareSitemaps(before, after);

  assert.equal(result.changed.length, 2);
  assert.deepEqual(result.changed[0].fields, {
    lastmod: { after: '2026-01-02' },
    changefreq: { after: 'monthly' },
    priority: { after: '0.8' },
  });
  assert.deepEqual(result.changed[1].fields, {
    lastmod: { before: '2026-01-01' },
    changefreq: { before: 'weekly' },
    priority: { before: '0.4' },
  });
});

test('compareSitemaps enforces configurable entry limits on parsed indexes', () => {
  const parsedIndex = {
    type: 'sitemapindex',
    entries: [{ loc: 'https://example.com/a.xml' }, { loc: 'https://example.com/b.xml' }],
  };
  assert.equal(compareSitemaps(parsedIndex, [], { maxEntries: 2 }).removed.length, 2);
  assert.throws(() => compareSitemaps(parsedIndex, [], { maxEntries: 1 }), /entry limit/i);
});

test('compareSitemaps sorts set results deterministically regardless of input order', () => {
  const result = compareSitemaps(
    [{ loc: 'https://example.com/z' }, { loc: 'https://example.com/b' }],
    [{ loc: 'https://example.com/y' }, { loc: 'https://example.com/a' }],
  );
  assert.deepEqual(result.added.map(({ loc }) => loc), ['https://example.com/a', 'https://example.com/y']);
  assert.deepEqual(result.removed.map(({ loc }) => loc), ['https://example.com/b', 'https://example.com/z']);
});

test('report renderers escape Markdown table data and replace unsafe controls in JSON', () => {
  const unsafe = {
    added: [{ loc: 'https://example.com/a|b\n<em>&', lastmod: undefined, changefreq: undefined, priority: undefined }],
    removed: [],
    changed: [],
    duplicates: { before: [], after: [] },
    summary: { added: 1, removed: 0, changed: 0, unchanged: 0, duplicatesBefore: 0, duplicatesAfter: 0 },
  };
  const markdown = toMarkdownReport(unsafe);
  assert.match(markdown, /a\\\|b<br>&lt;em&gt;&amp;/);
  assert.doesNotMatch(markdown, /\u0007/);

  const withControl = { ...unsafe, added: [{ loc: 'https://example.com/\u0007path' }] };
  const json = toJsonReport(withControl, 0);
  assert.equal(JSON.parse(json).added[0].loc, 'https://example.com/\uFFFDpath');
  assert.throws(() => toJsonReport(unsafe, 11), /indentation/i);
});
