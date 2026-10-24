export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

export type SitemapType = 'urlset' | 'sitemapindex';

export interface ParsedSitemap {
  type: SitemapType;
  entries: SitemapEntry[];
}

export interface NormalizeOptions {
  stripHash?: boolean;
  stripTrailingSlash?: boolean;
  sortQuery?: boolean;
  removeQueryParams?: string[];
  lowercasePath?: boolean;
}

export interface CompareOptions extends NormalizeOptions {
  /** Maximum entries on each side; defaults to 50,000. */
  maxEntries?: number;
}

export interface ChangedSitemapEntry {
  url: string;
  before: SitemapEntry;
  after: SitemapEntry;
  fields: Partial<Record<'lastmod' | 'changefreq' | 'priority', { before?: string; after?: string }>>;
}

export interface DuplicateSitemapGroup {
  url: string;
  entries: SitemapEntry[];
}

export interface SitemapDiffSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  duplicatesBefore: number;
  duplicatesAfter: number;
}

export interface SitemapDiff {
  added: SitemapEntry[];
  removed: SitemapEntry[];
  changed: ChangedSitemapEntry[];
  duplicates: {
    before: DuplicateSitemapGroup[];
    after: DuplicateSitemapGroup[];
  };
  summary: SitemapDiffSummary;
}
