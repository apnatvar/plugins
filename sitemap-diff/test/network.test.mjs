import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import dnsPromises from 'node:dns/promises';
import httpModule from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { fetchSitemap, isPublicAddress, loadSitemap } from '../dist/index.js';
import { allowLocalNetwork, sitemapIndex, urlset, withServer } from './helpers.mjs';

test('classifies public and special-use IPv4 and IPv6 addresses', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '192.168.1.2', '169.254.1.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '2001:db8::1']) {
    assert.equal(isPublicAddress(address), false, `${address} should be denied`);
  }
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPublicAddress(address), true, `${address} should be allowed`);
  }
});

test('checks every DNS answer before making a request', async (t) => {
  let requestCount = 0;
  t.mock.method(dnsPromises, 'lookup', async () => [
    { address: '8.8.8.8', family: 4 },
    { address: '127.0.0.1', family: 4 },
  ]);
  t.mock.method(httpModule, 'request', () => { requestCount += 1; throw new Error('request should not be made'); });
  syncBuiltinESMExports();
  try {
    await assert.rejects(fetchSitemap('http://mixed-answer.example/sitemap.xml'), (error) => error.code === 'UNSAFE_ADDRESS');
    assert.equal(requestCount, 0);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

test('pins HTTP requests to a validated DNS answer', async (t) => {
  const observedLookups = [];
  t.mock.method(dnsPromises, 'lookup', async (hostname) => {
    observedLookups.push(hostname);
    return [{ address: '127.0.0.1', family: 4 }];
  });
  syncBuiltinESMExports();
  try {
    await withServer((_req, res) => { res.end(urlset([{ loc: 'https://public.example/page' }])); }, async (_origin, server) => {
      const port = server.address().port;
      const body = await fetchSitemap(`http://pinned.example:${port}/sitemap.xml`, allowLocalNetwork());
      assert.match(body, /public\.example\/page/);
      assert.deepEqual(observedLookups, ['pinned.example']);
    });
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

test('revalidates DNS for each redirect target before opening its connection', async (t) => {
  const observedLookups = [];
  let requestCount = 0;
  t.mock.method(dnsPromises, 'lookup', async (hostname) => {
    observedLookups.push(hostname);
    return [{ address: hostname === 'public.example' ? '93.184.216.34' : '127.0.0.1', family: 4 }];
  });
  t.mock.method(httpModule, 'request', (_url) => {
    requestCount += 1;
    const request = new (class extends EventEmitter {
      end() {
        const response = Readable.from([]);
        response.statusCode = 302;
        response.headers = { location: 'http://private.example/sitemap.xml' };
        queueMicrotask(() => this.emit('response', response));
      }
      destroy(error) { if (error) this.emit('error', error); }
    })();
    return request;
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(fetchSitemap('http://public.example/sitemap.xml'), (error) => error.code === 'UNSAFE_ADDRESS');
    assert.deepEqual(observedLookups, ['public.example', 'private.example']);
    assert.equal(requestCount, 1);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

test('fetchSitemap retrieves an HTTP document when private-network access is explicitly enabled', async () => {
  const xml = urlset([{ loc: 'https://public.example/page' }]);
  await withServer((_req, res) => { res.end(xml); }, async (origin) => {
    assert.equal(await fetchSitemap(`${origin}/sitemap.xml`, allowLocalNetwork()), xml);
  });
});

test('blocks loopback by default, and follows a bounded same-origin redirect when enabled', async () => {
  const xml = urlset([{ loc: 'https://public.example/page' }]);
  await withServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(302, { location: '/final' }).end();
      return;
    }
    res.end(xml);
  }, async (origin) => {
    await assert.rejects(fetchSitemap(`${origin}/final`));
    assert.equal(await fetchSitemap(`${origin}/start`, allowLocalNetwork()), xml);
  });
});

test('rejects redirect connection failures and redirect loops', async () => {
  await withServer((req, res) => {
    if (req.url === '/private') {
      res.writeHead(302, { location: 'http://127.0.0.1:1/' }).end();
    } else {
      res.writeHead(302, { location: req.url === '/one' ? '/two' : '/one' }).end();
    }
  }, async (origin) => {
    await assert.rejects(fetchSitemap(`${origin}/private`, allowLocalNetwork()));
    await assert.rejects(fetchSitemap(`${origin}/one`, { ...allowLocalNetwork(), maxRedirects: 2 }));
  });
});

test('honors request timeouts and rejects oversized response bodies', async () => {
  await withServer((req, res) => {
    if (req.url === '/slow') {
      res.write('partial');
      setTimeout(() => res.end('late'), 400);
    } else if (req.url === '/chunked') {
      res.writeHead(200, { 'transfer-encoding': 'chunked' });
      for (let i = 0; i < 10; i++) res.write('x'.repeat(100));
      res.end();
    } else {
      res.end('x'.repeat(4096));
    }
  }, async (origin) => {
    await assert.rejects(fetchSitemap(`${origin}/slow`, { ...allowLocalNetwork(), timeoutMs: 80 }));
    await assert.rejects(fetchSitemap(`${origin}/large`, { ...allowLocalNetwork(), maxBytes: 128 }));
    await assert.rejects(fetchSitemap(`${origin}/chunked`, { ...allowLocalNetwork(), maxBytes: 128 }));
  });
});

test('rejects malformed gzip, invalid UTF-8, unsupported encodings, and non-success HTTP status', async () => {
  await withServer((req, res) => {
    if (req.url === '/bad-gzip') {
      res.writeHead(200, { 'content-encoding': 'gzip' }).end('not gzip');
    } else if (req.url === '/invalid-utf8') {
      res.end(Buffer.from([0xff, 0xfe]));
    } else if (req.url === '/unsupported') {
      res.writeHead(200, { 'content-encoding': 'br' }).end('ignored');
    } else {
      res.writeHead(503).end('unavailable');
    }
  }, async (origin) => {
    for (const path of ['/bad-gzip', '/invalid-utf8', '/unsupported', '/unavailable']) {
      await assert.rejects(fetchSitemap(`${origin}${path}`, allowLocalNetwork()));
    }
  });
});

test('decompresses a gzip file identified by its .gz suffix without an encoding header', async () => {
  const xml = urlset([{ loc: 'https://public.example/gzipped' }]);
  const compressed = gzipSync(xml);
  await withServer((_req, res) => { res.end(compressed); }, async (origin) => {
    assert.equal(await fetchSitemap(`${origin}/sitemap.xml.gz`, allowLocalNetwork()), xml);
  });
});

test('enforces decoded size limits on gzip responses', async () => {
  const compressed = gzipSync('x'.repeat(20_000));
  await withServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/xml', 'content-encoding': 'gzip' });
    res.end(compressed);
  }, async (origin) => {
    await assert.rejects(fetchSitemap(`${origin}/bomb`, { ...allowLocalNetwork(), maxBytes: 1024 }));
  });
});

test('detects a recursive sitemap-index cycle instead of fetching an ancestor again', async () => {
  const hits = new Map();
  await withServer((req, res) => {
    hits.set(req.url, (hits.get(req.url) ?? 0) + 1);
    if (req.url === '/a.xml') {
      res.end(sitemapIndex([`${originFor(req)}/b.xml`]));
      return;
    }
    if (req.url === '/b.xml') {
      res.end(sitemapIndex([`${originFor(req)}/a.xml`]));
      return;
    }
    res.end(urlset([]));
  }, async (origin) => {
    await assert.rejects(loadSitemap(`${origin}/a.xml`, allowLocalNetwork()), /circular|cycle/i);
    assert.equal(hits.get('/a.xml'), 1);
    assert.equal(hits.get('/b.xml'), 1);
  });
});

test('deduplicates repeated references after the referenced sitemap has completed', async () => {
  const hits = new Map();
  await withServer((req, res) => {
    hits.set(req.url, (hits.get(req.url) ?? 0) + 1);
    if (req.url === '/root.xml') {
      res.end(sitemapIndex([`${originFor(req)}/child.xml`, `${originFor(req)}/child.xml`]));
      return;
    }
    res.end(urlset([{ loc: 'https://public.example/one' }]));
  }, async (origin) => {
    const entries = await loadSitemap(`${origin}/root.xml`, allowLocalNetwork());
    assert.deepEqual(entries, [{ loc: 'https://public.example/one' }]);
    assert.equal(hits.get('/root.xml'), 1);
    assert.equal(hits.get('/child.xml'), 1);
  });
});

test('applies recursion depth, sitemap count, total bytes, and aggregate entry limits', async () => {
  await withServer((req, res) => {
    if (req.url === '/root.xml') {
      res.end(sitemapIndex([`${originFor(req)}/child.xml`]));
      return;
    }
    res.end(urlset([{ loc: 'https://public.example/one' }, { loc: 'https://public.example/two' }]));
  }, async (origin) => {
    const rootXml = sitemapIndex([`${origin}/child.xml`]);
    const source = `${origin}/root.xml`;
    await assert.rejects(loadSitemap(source, { ...allowLocalNetwork(), maxDepth: 0 }));
    await assert.rejects(loadSitemap(source, { ...allowLocalNetwork(), maxSitemaps: 1 }));
    await assert.rejects(loadSitemap(source, { ...allowLocalNetwork(), maxEntries: 1 }));
    await assert.rejects(loadSitemap(source, {
      ...allowLocalNetwork(), maxTotalBytes: Buffer.byteLength(rootXml) + 8,
    }));
  });
});

function originFor(req) {
  const address = req.socket.localAddress;
  const port = req.socket.localPort;
  const host = address.includes(':') ? `[${address}]` : address;
  return `http://${host}:${port}`;
}
