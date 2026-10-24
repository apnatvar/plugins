import { SitemapValidationError } from './errors.js';
import type { NormalizeOptions } from './types.js';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

function validateOptions(options: NormalizeOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new SitemapValidationError('Normalization options must be an object');
  }
  for (const key of ['stripHash', 'stripTrailingSlash', 'sortQuery', 'lowercasePath'] as const) {
    const value = options[key];
    if (value !== undefined && typeof value !== 'boolean') {
      throw new SitemapValidationError(`${key} must be a boolean`);
    }
  }
  if (options.removeQueryParams !== undefined && (!Array.isArray(options.removeQueryParams) || options.removeQueryParams.some((name) => typeof name !== 'string'))) {
    throw new SitemapValidationError('removeQueryParams must be an array of strings');
  }
}

/** Normalize an absolute HTTP(S) URL for sitemap comparison. */
export function normalizeUrl(input: string, options: NormalizeOptions = {}): string {
  if (typeof input !== 'string' || input.length === 0) {
    throw new SitemapValidationError('URL must be a non-empty string', 'INVALID_URL');
  }
  if (CONTROL_CHARACTERS.test(input) || input !== input.trim()) {
    throw new SitemapValidationError('URL must not contain control characters or surrounding whitespace', 'INVALID_URL');
  }
  if (input.includes('\\')) throw new SitemapValidationError('URL must not contain backslashes', 'INVALID_URL');
  validateOptions(options);

  let url: URL;
  try {
    url = new URL(input);
  } catch (error) {
    throw new SitemapValidationError('URL must be an absolute HTTP(S) URL', 'INVALID_URL', { cause: error });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SitemapValidationError('Only HTTP(S) sitemap URLs are supported', 'INVALID_URL');
  }
  const authority = input.match(/^https?:\/\/([^/?#]*)/i)?.[1];
  if (authority === undefined || authority.includes('@') || url.username !== '' || url.password !== '') {
    throw new SitemapValidationError('URL credentials are not allowed', 'INVALID_URL');
  }

  for (const name of options.removeQueryParams ?? []) {
    if (CONTROL_CHARACTERS.test(name)) throw new SitemapValidationError('Query parameter names must not contain control characters', 'INVALID_URL');
    url.searchParams.delete(name);
  }
  if (options.sortQuery) url.searchParams.sort();
  if (options.stripHash ?? true) url.hash = '';
  if (options.lowercasePath) url.pathname = url.pathname.toLowerCase();
  if (options.stripTrailingSlash) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}
