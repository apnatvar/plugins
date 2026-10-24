import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Transform, Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { SitemapError, SitemapFetchError, SitemapLimitError, SitemapValidationError } from './errors.js';
import { resolveOptions, type LoadOptions } from './options.js';

/** Conservative public unicast policy. Special-use and transition networks are denied. */
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0, c = 0] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6 || address.includes('%')) return false;
  // Only native global unicast 2000::/3; reject 6to4, Teredo, documentation and special assignments.
  const parts = address.toLowerCase().split(':');
  const first = parseInt(parts[0] || '0', 16);
  const second = parseInt(parts[1] || '0', 16);
  return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 &&
    !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8)) &&
    !(first === 0x3fff && second <= 0xfff);
}

export function remoteUrl(input: string): URL {
  if (typeof input !== 'string' || /[\u0000-\u0020\u007f-\u009f\\]/u.test(input)) throw new SitemapValidationError('Invalid sitemap URL');
  let url: URL;
  try { url = new URL(input); } catch { throw new SitemapValidationError('Invalid absolute sitemap URL'); }
  const authority = input.match(/^https?:\/\/([^/?#]*)/i)?.[1];
  if (!['http:', 'https:'].includes(url.protocol) || authority === undefined || authority.includes('@') || url.username || url.password) throw new SitemapValidationError('Only HTTP(S) URLs without credentials are supported');
  url.hash = '';
  return url;
}

/** Read raw and expanded bodies with separate equal caps. Also used by the file CLI. */
export async function readXmlStream(source: Readable, gzip: boolean, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new SitemapValidationError('maxBytes must be a positive safe integer');
  let rawBytes = 0;
  const limiter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    rawBytes += chunk.length;
    callback(rawBytes > maxBytes ? new SitemapLimitError('Compressed/raw sitemap exceeds maxBytes') : null, chunk);
  } });
  const decoder = gzip ? createGunzip() : undefined;
  const stream = decoder ? source.pipe(limiter).pipe(decoder) : source.pipe(limiter);
  const forwardError = (error: Error) => { stream.destroy(error); };
  source.on('error', forwardError);
  if (decoder) limiter.on('error', forwardError);
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > maxBytes) throw new SitemapLimitError('Expanded sitemap exceeds maxBytes');
      chunks.push(bytes);
    }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)); }
    catch { throw new SitemapValidationError('Sitemap must contain valid UTF-8'); }
  } finally {
    source.unpipe(); source.destroy(); limiter.destroy(); decoder?.destroy();
    source.removeListener('error', forwardError);
  }
}

/** DNS results are checked in full, then the connection is pinned to a checked address. */
export async function fetchSitemap(input: string | URL, options: LoadOptions = {}): Promise<string> {
  const limits = resolveOptions(options);
  let current = remoteUrl(String(input));
  const deadline = Date.now() + limits.timeoutMs;
  const visited = new Set<string>();
  for (let redirects = 0; ; redirects++) {
    if (visited.has(current.href)) throw new SitemapFetchError('Circular HTTP redirect', 'CIRCULAR_REFERENCE');
    visited.add(current.href);
    const hostname = current.hostname.replace(/^\[|\]$/g, '');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SitemapFetchError('Sitemap request timed out', 'TIMEOUT');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new SitemapFetchError('DNS lookup timed out', 'TIMEOUT')), remaining); }),
    ]).catch((error: unknown) => {
      if (error instanceof SitemapFetchError) throw error;
      throw new SitemapFetchError('DNS resolution failed', 'FETCH_ERROR', { cause: error });
    }).finally(() => { if (timer) clearTimeout(timer); });
    if (addresses.length === 0 || (!limits.allowPrivateNetworks && addresses.some(({ address }) => !isPublicAddress(address)))) {
      throw new SitemapFetchError('Sitemap target resolves to a forbidden network', 'UNSAFE_ADDRESS');
    }
    const selected = addresses[0]!;
    const result = await new Promise<{ xml: string } | { redirect: string }>((resolve, reject) => {
      const request = (current.protocol === 'https:' ? httpsRequest : httpRequest)(current, {
        agent: false,
        family: selected.family,
        headers: { accept: 'application/xml, text/xml', 'accept-encoding': 'gzip', 'user-agent': 'BrownsmithDynamics-SitemapDiff/0.1' },
        lookup: (_host, _opts, callback) => callback(null, selected.address, selected.family),
      });
      const timeout = setTimeout(() => request.destroy(new SitemapFetchError('Sitemap request timed out', 'TIMEOUT')), Math.max(1, deadline - Date.now()));
      const finish = () => clearTimeout(timeout);
      request.on('error', (error) => { finish(); reject(error instanceof SitemapFetchError ? error : new SitemapFetchError('Sitemap request failed', 'FETCH_ERROR', { cause: error })); });
      request.on('response', (response) => {
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.destroy(); finish();
          if (redirects >= limits.maxRedirects) { reject(new SitemapLimitError('Redirect limit exceeded')); return; }
          if (!response.headers.location) { reject(new SitemapFetchError('Redirect missing Location', 'FETCH_ERROR')); return; }
          resolve({ redirect: response.headers.location }); return;
        }
        if (status !== 200) { response.destroy(); finish(); reject(new SitemapFetchError(`Sitemap returned HTTP ${status}`, 'FETCH_ERROR')); return; }
        const length = response.headers['content-length'];
        if (length && (!/^\d+$/.test(length) || Number(length) > limits.maxBytes)) { response.destroy(); finish(); reject(new SitemapLimitError('Sitemap Content-Length exceeds maxBytes')); return; }
        const encoding = response.headers['content-encoding']?.toLowerCase();
        if (encoding && encoding !== 'identity' && encoding !== 'gzip') { response.destroy(); finish(); reject(new SitemapFetchError('Unsupported content encoding', 'FETCH_ERROR')); return; }
        const gzip = encoding === 'gzip' || current.pathname.toLowerCase().endsWith('.gz');
        readXmlStream(response, gzip, limits.maxBytes).then(xml => { finish(); resolve({ xml }); }, (error: unknown) => {
          finish(); reject(error instanceof SitemapError ? error : new SitemapFetchError('Invalid or interrupted sitemap response', 'FETCH_ERROR', { cause: error }));
        });
      });
      request.end();
    });
    if ('xml' in result) return result.xml;
    const next = remoteUrl(new URL(result.redirect, current).href);
    if (current.protocol === 'https:' && next.protocol !== 'https:') throw new SitemapFetchError('HTTPS downgrade redirect rejected', 'UNSAFE_ADDRESS');
    current = next;
  }
}
