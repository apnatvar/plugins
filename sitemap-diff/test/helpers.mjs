export const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

export function urlset(entries = []) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="${SITEMAP_NS}">${entries
    .map((entry) => `<url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}${entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ''}${entry.priority ? `<priority>${entry.priority}</priority>` : ''}</url>`)
    .join('')}</urlset>`;
}

export function sitemapIndex(locations = []) {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="${SITEMAP_NS}">${locations
    .map((loc) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`)
    .join('')}</sitemapindex>`;
}

export function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export async function withServer(handler, callback) {
  const server = await import('node:http').then(({ createServer }) => createServer(handler));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    return await callback(origin, server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

export function allowLocalNetwork(options = {}) {
  return { ...options, allowPrivateNetworks: true };
}
