import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const port = Number(process.env.FIXTURE_PORT ?? 4173);

createServer((request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  const path = request.url === '/' ? 'index.html' : request.url?.slice(1);
  if (!path || !['index.html', 'store-listing.html'].includes(path)) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  createReadStream(join(root, path)).pipe(response);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Prompt Composer fixture: http://127.0.0.1:${port}\n`);
});
