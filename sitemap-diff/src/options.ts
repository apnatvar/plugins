import { SitemapValidationError } from './errors.js';
import type { NormalizeOptions } from './types.js';

export interface LoadOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxTotalBytes?: number;
  maxEntries?: number;
  maxSitemaps?: number;
  maxDepth?: number;
  maxRedirects?: number;
  /** Explicit opt-in for trusted internal networks; applies to every reference and redirect. */
  allowPrivateNetworks?: boolean;
  normalization?: NormalizeOptions;
}
export const DEFAULT_LIMITS = Object.freeze({
  timeoutMs: 10_000, maxBytes: 5 * 1024 * 1024, maxTotalBytes: 20 * 1024 * 1024,
  maxEntries: 50_000, maxSitemaps: 100, maxDepth: 5, maxRedirects: 3,
  allowPrivateNetworks: false,
});
export function resolveOptions(options: LoadOptions = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new SitemapValidationError('Load options must be an object');
  const result = { ...DEFAULT_LIMITS, ...options };
  for (const key of ['timeoutMs', 'maxBytes', 'maxTotalBytes', 'maxEntries', 'maxSitemaps', 'maxDepth', 'maxRedirects'] as const) {
    const value = result[key];
    if (!Number.isSafeInteger(value) || value < (key === 'maxDepth' || key === 'maxRedirects' ? 0 : 1)) {
      throw new SitemapValidationError(`${key} must be a ${key === 'maxDepth' || key === 'maxRedirects' ? 'nonnegative' : 'positive'} safe integer`);
    }
  }
  if (typeof result.allowPrivateNetworks !== 'boolean') throw new SitemapValidationError('allowPrivateNetworks must be boolean');
  if (result.timeoutMs > 2_147_483_647) throw new SitemapValidationError('timeoutMs exceeds the timer limit');
  return result;
}
