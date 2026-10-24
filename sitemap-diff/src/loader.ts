import { compareSitemaps } from './compare.js';
import { fetchSitemap, remoteUrl } from './fetch.js';
import { parseSitemap } from './parse.js';
import { SitemapFetchError, SitemapLimitError, SitemapValidationError } from './errors.js';
import { resolveOptions, type LoadOptions } from './options.js';
import type { SitemapEntry, ParsedSitemap, SitemapDiff } from './types.js';

export type SitemapSource = string | ParsedSitemap | SitemapEntry[];

/** Resolve indexes sequentially so aggregate budgets remain deterministic and bounded. */
export async function loadSitemap(source: SitemapSource, options: LoadOptions = {}): Promise<SitemapEntry[]> {
  const limits = resolveOptions(options);
  const entries: SitemapEntry[] = [];
  const active = new Set<string>();
  const seen = new Set<string>();
  let totalBytes = 0;
  let count = 0;
  let entryCount = 0;
  const visit = async (input: SitemapSource, depth: number): Promise<void> => {
    if (depth > limits.maxDepth) throw new SitemapLimitError('Sitemap recursion depth exceeded');
    let identity: string | undefined;
    let parsed: ParsedSitemap;
    if (typeof input === 'string') {
      if (!input.trimStart().startsWith('<') && !input.startsWith('\uFEFF')) {
        identity = remoteUrl(input).href;
        if (active.has(identity)) throw new SitemapFetchError('Circular sitemap reference', 'CIRCULAR_REFERENCE');
        if (seen.has(identity)) return;
        active.add(identity); seen.add(identity);
      }
      if (++count > limits.maxSitemaps) throw new SitemapLimitError('Sitemap document count exceeded');
      const remainingBytes = limits.maxTotalBytes - totalBytes;
      if (remainingBytes < 1) throw new SitemapLimitError('Total sitemap byte budget exceeded');
      const xml = identity ? await fetchSitemap(identity, { ...limits, maxBytes: Math.min(limits.maxBytes, remainingBytes) }) : input;
      totalBytes += Buffer.byteLength(xml, 'utf8');
      if (totalBytes > limits.maxTotalBytes) throw new SitemapLimitError('Total sitemap byte budget exceeded');
      parsed = parseSitemap(xml, { maxBytes: Math.min(limits.maxBytes, limits.maxTotalBytes), maxEntries: limits.maxEntries });
    } else {
      if (++count > limits.maxSitemaps) throw new SitemapLimitError('Sitemap document count exceeded');
      if (Array.isArray(input)) parsed = { type: 'urlset', entries: input };
      else if (input && (input.type === 'urlset' || input.type === 'sitemapindex') && Array.isArray(input.entries)) parsed = input;
      else throw new SitemapValidationError('Invalid parsed sitemap');
      if (parsed.entries.length > limits.maxEntries) throw new SitemapLimitError('Sitemap entry limit exceeded');
      // Account only the supported shape before expensive validation or copying.
      let bytes = Buffer.byteLength(JSON.stringify({ type: parsed.type, entries: [] }), 'utf8');
      let entryIndex = 0;
      for (const entry of parsed.entries) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new SitemapValidationError('Invalid parsed entry');
        bytes += 2 + (entryIndex++ > 0 ? 1 : 0); // object braces and entry separator
        let fieldIndex = 0;
        for (const field of ['loc', 'lastmod', 'changefreq', 'priority'] as const) {
          const value = entry[field];
          if (value !== undefined && typeof value !== 'string') throw new SitemapValidationError(`Entry ${field} must be a string`);
          if (value !== undefined) {
            if (Buffer.byteLength(value, 'utf8') + bytes > Math.min(limits.maxBytes, limits.maxTotalBytes - totalBytes)) throw new SitemapLimitError('Parsed sitemap byte budget exceeded');
            bytes += Buffer.byteLength(JSON.stringify(field)) + 1 + Buffer.byteLength(JSON.stringify(value)) + (fieldIndex++ > 0 ? 1 : 0);
          }
        }
        if (bytes > limits.maxBytes || totalBytes + bytes > limits.maxTotalBytes) throw new SitemapLimitError('Parsed sitemap byte budget exceeded');
      }
      if (bytes > limits.maxBytes || totalBytes + bytes > limits.maxTotalBytes) throw new SitemapLimitError('Parsed sitemap byte budget exceeded');
      totalBytes += bytes;
      // Comparison performs schema validation; clone supported fields in original order.
      compareSitemaps(parsed.entries, [], { maxEntries: limits.maxEntries });
      parsed = { type: parsed.type, entries: parsed.entries.map(entry => ({ loc: entry.loc,
        ...(entry.lastmod !== undefined ? { lastmod: entry.lastmod } : {}),
        ...(entry.changefreq !== undefined ? { changefreq: entry.changefreq } : {}),
        ...(entry.priority !== undefined ? { priority: entry.priority } : {}),
      })) };
    }
    entryCount += parsed.entries.length;
    if (entryCount > limits.maxEntries) throw new SitemapLimitError('Aggregate sitemap entry limit exceeded');
    if (parsed.type === 'sitemapindex') {
      for (const reference of parsed.entries) await visit(remoteUrl(reference.loc).href, depth + 1);
    } else {
      if (entries.length + parsed.entries.length > limits.maxEntries) throw new SitemapLimitError('Aggregate sitemap entry limit exceeded');
      entries.push(...parsed.entries);
    }
    if (identity) active.delete(identity);
  };
  await visit(source, 0);
  return entries;
}

export async function diffSitemaps(before: SitemapSource, after: SitemapSource, options: LoadOptions = {}): Promise<SitemapDiff> {
  const previous = await loadSitemap(before, options);
  const next = await loadSitemap(after, options);
  return compareSitemaps(previous, next, { ...options.normalization, maxEntries: resolveOptions(options).maxEntries });
}
