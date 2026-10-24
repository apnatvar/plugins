import { SitemapLimitError, SitemapValidationError } from './errors.js';
import { normalizeUrl } from './normalize.js';
import type {
  ChangedSitemapEntry,
  DuplicateSitemapGroup,
  NormalizeOptions,
  CompareOptions,
  ParsedSitemap,
  SitemapDiff,
  SitemapEntry,
} from './types.js';

const MAX_COMPARE_ENTRIES = 50_000;
const FIELD_NAMES = ['lastmod', 'changefreq', 'priority'] as const;
const CHANGEFREQS = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

interface IndexedEntries {
  firstByUrl: Map<string, SitemapEntry>;
  allByUrl: Map<string, SitemapEntry[]>;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
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

function validateEntry(value: unknown, index: number, options: NormalizeOptions): SitemapEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SitemapValidationError(`Entry ${index} must be an object`);
  }
  const entry = value as Record<string, unknown>;
  if (typeof entry.loc !== 'string') throw new SitemapValidationError(`Entry ${index} loc must be a string`);
  const normalizedUrl = normalizeUrl(entry.loc, options);
  void normalizedUrl;
  for (const field of FIELD_NAMES) {
    const item = entry[field];
    if (item !== undefined && (typeof item !== 'string' || item.length === 0)) {
      throw new SitemapValidationError(`Entry ${index} ${field} must be a non-empty string when provided`);
    }
  }
  const changefreq = entry.changefreq as string | undefined;
  if (changefreq !== undefined && !CHANGEFREQS.has(changefreq.toLowerCase())) {
    throw new SitemapValidationError(`Entry ${index} has invalid changefreq: ${changefreq}`);
  }
  const priority = entry.priority as string | undefined;
  if (priority !== undefined && (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(priority) || Number(priority) > 1)) {
    throw new SitemapValidationError(`Entry ${index} has invalid priority: ${priority}`);
  }
  const lastmod = entry.lastmod as string | undefined;
  if (lastmod !== undefined && !isValidLastmod(lastmod)) {
    throw new SitemapValidationError(`Entry ${index} has invalid lastmod: ${lastmod}`);
  }
  return {
    loc: entry.loc,
    ...(lastmod !== undefined ? { lastmod } : {}),
    ...(changefreq !== undefined ? { changefreq } : {}),
    ...(priority !== undefined ? { priority } : {}),
  };
}

function getEntries(input: SitemapEntry[] | ParsedSitemap, label: string, options: CompareOptions): SitemapEntry[] {
  let entries: unknown;
  if (Array.isArray(input)) {
    entries = input;
  } else if (input && typeof input === 'object') {
    const parsed = input as ParsedSitemap;
    if (parsed.type !== 'urlset' && parsed.type !== 'sitemapindex') {
      throw new SitemapValidationError(`${label} sitemap type must be urlset or sitemapindex`);
    }
    entries = parsed.entries;
  }
  if (!Array.isArray(entries)) throw new SitemapValidationError(`${label} sitemap entries must be an array`);
  const maxEntries = options.maxEntries ?? MAX_COMPARE_ENTRIES;
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new SitemapValidationError('maxEntries must be a positive safe integer');
  if (entries.length > maxEntries) {
    throw new SitemapLimitError(`${label} sitemap exceeds the ${maxEntries} entry limit`);
  }
  return entries.map((entry, index) => validateEntry(entry, index, options));
}

function indexEntries(entries: SitemapEntry[], options: NormalizeOptions): IndexedEntries {
  const firstByUrl = new Map<string, SitemapEntry>();
  const allByUrl = new Map<string, SitemapEntry[]>();
  for (const entry of entries) {
    const url = normalizeUrl(entry.loc, options);
    const current = allByUrl.get(url);
    if (current) current.push(entry);
    else allByUrl.set(url, [entry]);
    if (!firstByUrl.has(url)) firstByUrl.set(url, entry);
  }
  return { firstByUrl, allByUrl };
}

function duplicates(allByUrl: Map<string, SitemapEntry[]>): DuplicateSitemapGroup[] {
  return [...allByUrl.entries()]
    .filter(([, entries]) => entries.length > 1)
    .sort(([a], [b]) => compareText(a, b))
    .map(([url, entries]) => ({ url, entries: [...entries] }));
}

function compareMetadata(before: SitemapEntry, after: SitemapEntry, url: string): ChangedSitemapEntry | undefined {
  const fields: ChangedSitemapEntry['fields'] = {};
  for (const field of FIELD_NAMES) {
    if (before[field] !== after[field]) {
      fields[field] = {
        ...(before[field] !== undefined ? { before: before[field] } : {}),
        ...(after[field] !== undefined ? { after: after[field] } : {}),
      };
    }
  }
  return Object.keys(fields).length > 0 ? { url, before, after, fields } : undefined;
}

/** Compare two parsed sitemap entry collections using normalized loc values. */
export function compareSitemaps(
  beforeInput: SitemapEntry[] | ParsedSitemap,
  afterInput: SitemapEntry[] | ParsedSitemap,
  options: CompareOptions = {},
): SitemapDiff {
  const beforeEntries = getEntries(beforeInput, 'before', options);
  const afterEntries = getEntries(afterInput, 'after', options);
  const before = indexEntries(beforeEntries, options);
  const after = indexEntries(afterEntries, options);

  const added = [...after.firstByUrl.entries()]
    .filter(([url]) => !before.firstByUrl.has(url))
    .sort(([a], [b]) => compareText(a, b))
    .map(([, entry]) => entry);
  const removed = [...before.firstByUrl.entries()]
    .filter(([url]) => !after.firstByUrl.has(url))
    .sort(([a], [b]) => compareText(a, b))
    .map(([, entry]) => entry);
  const changed: ChangedSitemapEntry[] = [];
  for (const [url, beforeEntry] of before.firstByUrl) {
    const afterEntry = after.firstByUrl.get(url);
    if (afterEntry) {
      const difference = compareMetadata(beforeEntry, afterEntry, url);
      if (difference) changed.push(difference);
    }
  }
  changed.sort((a, b) => compareText(a.url, b.url));

  const beforeDuplicates = duplicates(before.allByUrl);
  const afterDuplicates = duplicates(after.allByUrl);
  const duplicateCount = (groups: DuplicateSitemapGroup[]) => groups.reduce((sum, group) => sum + group.entries.length - 1, 0);
  const unchanged = [...before.firstByUrl.keys()].filter((url) => {
    const next = after.firstByUrl.get(url);
    return next !== undefined && !compareMetadata(before.firstByUrl.get(url)!, next, url);
  }).length;

  return {
    added,
    removed,
    changed,
    duplicates: { before: beforeDuplicates, after: afterDuplicates },
    summary: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged,
      duplicatesBefore: duplicateCount(beforeDuplicates),
      duplicatesAfter: duplicateCount(afterDuplicates),
    },
  };
}
