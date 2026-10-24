import { Buffer } from 'node:buffer';
import { SaxesParser } from 'saxes';
import { SitemapLimitError, SitemapParseError, SitemapValidationError } from './errors.js';
import { normalizeUrl } from './normalize.js';
import type { ParsedSitemap, SitemapEntry, SitemapType } from './types.js';

const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 50_000;
const MAX_XML_DEPTH = 128;
const CHANGEFREQS = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

export interface ParseSitemapOptions {
  maxBytes?: number;
  maxEntries?: number;
}

interface OpenTag {
  local: string;
  uri: string;
}

function positiveLimit(value: number | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new SitemapValidationError(`${label} must be a positive safe integer`);
  }
  return value;
}

function validateField(name: keyof SitemapEntry, value: string): void {
  if (!value) throw new SitemapValidationError(`Sitemap ${name} must not be empty`);
  if (name === 'changefreq' && !CHANGEFREQS.has(value.toLowerCase())) {
    throw new SitemapValidationError(`Invalid sitemap changefreq: ${value}`);
  }
  if (name === 'priority' && (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(value) || Number(value) > 1)) {
    throw new SitemapValidationError(`Invalid sitemap priority: ${value}`);
  }
  if (name === 'lastmod' && !isValidLastmod(value)) {
    throw new SitemapValidationError(`Invalid sitemap lastmod: ${value}`);
  }
}

function isValidLastmod(value: string): boolean {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2})))?$/);
  if (!match) return false;
  if (match[2] !== undefined && (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59)) return false;
  if (match[7] !== undefined && (Number(match[7]) > 23 || Number(match[8]) > 59)) return false;
  const date = match[1]!;
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(Date.parse(value)) && parsedDate.toISOString().slice(0, 10) === date;
}

/** Parse a sitemap XML document without resolving external or declared entities. */
export function parseSitemap(xml: string, options: ParseSitemapOptions = {}): ParsedSitemap {
  if (typeof xml !== 'string') throw new SitemapValidationError('Sitemap XML must be a string');
  const maxBytes = positiveLimit(options.maxBytes, DEFAULT_MAX_BYTES, 'maxBytes');
  const maxEntries = positiveLimit(options.maxEntries, DEFAULT_MAX_ENTRIES, 'maxEntries');
  if (Buffer.byteLength(xml, 'utf8') > maxBytes) {
    throw new SitemapLimitError(`Sitemap XML exceeds the ${maxBytes} byte limit`);
  }
  const declaration = xml.match(/^(?:\uFEFF)?<\?xml\s+([^?]*)\?>/i)?.[1];
  const encoding = declaration?.match(/\bencoding\s*=\s*(['"])(.*?)\1/i)?.[2];
  if (encoding && !/^utf-8$/i.test(encoding)) {
    throw new SitemapParseError('Only UTF-8 sitemap XML is supported');
  }

  const stack: OpenTag[] = [];
  const entries: SitemapEntry[] = [];
  let rootType: SitemapType | undefined;
  let currentEntry: Partial<SitemapEntry> | undefined;
  let currentEntryDepth = -1;
  let capture: { field: keyof SitemapEntry; depth: number; value: string } | undefined;
  const parser = new SaxesParser({ xmlns: true });

  parser.on('doctype', () => {
    throw new SitemapParseError('DOCTYPE declarations are not allowed');
  });
  parser.on('error', (error) => {
    throw new SitemapParseError('Malformed sitemap XML', { cause: error });
  });
  parser.on('opentag', (tag) => {
    if (stack.length >= MAX_XML_DEPTH) throw new SitemapLimitError(`Sitemap XML exceeds the ${MAX_XML_DEPTH} element depth limit`);
    const item: OpenTag = { local: tag.local, uri: tag.uri };
    stack.push(item);
    const depth = stack.length;

    if (depth === 1) {
      if (item.uri !== SITEMAP_NAMESPACE || (item.local !== 'urlset' && item.local !== 'sitemapindex')) {
        throw new SitemapParseError('Root element must be a sitemap urlset or sitemapindex in the standard sitemap namespace');
      }
      rootType = item.local;
      return;
    }

    if (stack.slice(0, -1).some((ancestor) => ancestor.uri !== SITEMAP_NAMESPACE)) return;
    if (capture && depth > capture.depth) {
      throw new SitemapParseError(`Sitemap ${capture.field} elements must contain text only`);
    }
    if (item.uri !== SITEMAP_NAMESPACE) return;
    if (depth === 2) {
      const expectedEntry = rootType === 'urlset' ? 'url' : 'sitemap';
      if (item.local !== expectedEntry) {
        throw new SitemapParseError(`Unexpected ${item.local} element in sitemap ${rootType}`);
      }
      currentEntry = {};
      currentEntryDepth = depth;
      return;
    }

    const allowedFields = rootType === 'urlset'
      ? ['loc', 'lastmod', 'changefreq', 'priority']
      : ['loc', 'lastmod'];
    if (currentEntry && depth === currentEntryDepth + 1 && allowedFields.includes(item.local)) {
      const field = item.local as keyof SitemapEntry;
      if (currentEntry[field] !== undefined || (capture && capture.field === field)) {
        throw new SitemapParseError(`Duplicate ${field} element in sitemap entry`);
      }
      capture = { field, depth, value: '' };
      return;
    }
    throw new SitemapParseError(`Unexpected ${item.local} element in sitemap structure`);
  });
  parser.on('text', (text) => {
    if (capture) {
      capture.value += text;
      return;
    }
    if (stack.length > 0 && stack.some((tag) => tag.uri !== SITEMAP_NAMESPACE)) return;
    if (text.trim() !== '') throw new SitemapParseError('Unexpected text outside sitemap fields');
  });
  parser.on('cdata', (text) => {
    if (!capture) {
      if (stack.some((tag) => tag.uri !== SITEMAP_NAMESPACE)) return;
      if (text.trim() !== '') throw new SitemapParseError('Unexpected text outside sitemap fields');
      return;
    }
    capture.value += text;
  });
  parser.on('closetag', () => {
    const depth = stack.length;
    if (capture && capture.depth === depth) {
      const value = capture.value.trim();
      validateField(capture.field, value);
      if (!currentEntry) throw new SitemapParseError('Sitemap field outside an entry');
      if (capture.field === 'loc') normalizeUrl(value);
      currentEntry[capture.field] = value;
      capture = undefined;
    }
    if (currentEntry && currentEntryDepth === depth) {
      if (!currentEntry.loc) throw new SitemapValidationError('Every sitemap entry must include a loc');
      entries.push(currentEntry as SitemapEntry);
      if (entries.length > maxEntries) throw new SitemapLimitError(`Sitemap exceeds the ${maxEntries} entry limit`);
      currentEntry = undefined;
      currentEntryDepth = -1;
    }
    stack.pop();
  });

  try {
    parser.write(xml).close();
  } catch (error) {
    if (error instanceof SitemapParseError || error instanceof SitemapValidationError || error instanceof SitemapLimitError) throw error;
    throw new SitemapParseError('Malformed sitemap XML', { cause: error });
  }
  if (!rootType) throw new SitemapParseError('Sitemap XML is empty');
  return { type: rootType, entries };
}
