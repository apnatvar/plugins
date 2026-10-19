const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const captureRoot = path.join(root, 'store-assets', 'capture-source');
const port = Number(process.env.PORT || 4190);
const demoUrls = {
  '01': 'https://brownsmithdynamics.com/business-efficiency/software-engineering-integrations',
  '02': 'https://plugins.brownsmithdynamics.com/page-qr/?source=browser#privacy'
};

const assets = new Map([
  ['/popup.css', ['popup.css', 'text/css; charset=utf-8']],
  ['/popup.js', ['popup.js', 'text/javascript; charset=utf-8']],
  ['/vendor/qrcode.js', ['vendor/qrcode.js', 'text/javascript; charset=utf-8']]
]);

const shim = `(() => {
  const demo = new URLSearchParams(location.search).get('demo');
  const urls = ${JSON.stringify(demoUrls)};
  const url = urls[demo];
  if (!url) return;
  globalThis.chrome = {
    tabs: { query(_query, callback) { callback([{ url }]); } },
    runtime: {}
  };
})();\n`;

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readFile(file) {
  return fs.readFileSync(file);
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://127.0.0.1'); }
  catch { send(res, 400, 'text/plain; charset=utf-8', 'Bad request'); return; }

  if (url.pathname === '/capture/01' || url.pathname === '/capture/01/') {
    send(res, 200, 'text/html; charset=utf-8', readFile(path.join(captureRoot, 'capture-01.html'))); return;
  }
  if (url.pathname === '/capture/02' || url.pathname === '/capture/02/') {
    send(res, 200, 'text/html; charset=utf-8', readFile(path.join(captureRoot, 'capture-02.html'))); return;
  }
  if (url.pathname === '/capture-shim.js') {
    send(res, 200, 'text/javascript; charset=utf-8', shim); return;
  }
  if (url.pathname === '/popup.html') {
    const demo = url.searchParams.get('demo');
    if (!demoUrls[demo]) { send(res, 404, 'text/plain; charset=utf-8', 'Unknown demo'); return; }
    const html = readFile(path.join(root, 'popup.html')).toString('utf8')
      .replace('<script src="vendor/qrcode.js"></script>', '<script src="/capture-shim.js"></script>\n  <script src="/vendor/qrcode.js"></script>')
      .replace('href="popup.css"', 'href="/popup.css"')
      .replace('src="popup.js"', 'src="/popup.js"');
    send(res, 200, 'text/html; charset=utf-8', html); return;
  }

  const asset = assets.get(url.pathname);
  if (asset) {
    send(res, 200, asset[1], readFile(path.join(root, asset[0]))); return;
  }
  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Capture fixtures: http://127.0.0.1:${port}/capture/01 and /capture/02\n`);
});
