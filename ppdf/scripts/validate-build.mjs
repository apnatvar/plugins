import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);
for(const key of ['permissions','host_permissions','optional_permissions','optional_host_permissions','content_scripts','externally_connectable','web_accessible_resources']) assert.ok(!(key in manifest),`Unexpected ${key}`);
assert.equal(manifest.action.default_popup,'popup.html');
const csp=manifest.content_security_policy.extension_pages;
assert.match(csp,/connect-src 'self'/); assert.match(csp,/script-src 'self' 'wasm-unsafe-eval';/); assert.ok(!csp.includes("'unsafe-eval'"));
async function walk(dir){ const result=[];for(const f of await readdir(dir)){const p=path.join(dir,f);if((await stat(p)).isDirectory())result.push(...await walk(p));else result.push(p);}return result; }
const files=await walk('dist');
assert.ok(files.some(f=>/pdf\.worker.*\.mjs$/.test(f)),'PDF.js worker missing');
assert.ok(files.some(f=>/pdf\.worker.*\.js$/.test(f)),'Processing worker missing');
assert.ok(files.some(f=>f.endsWith('.bcmap'))); assert.ok(files.some(f=>f.endsWith('.wasm')));
for(const file of files){
  assert.ok(!/(node_modules|tests|fixtures|\.map$)/.test(file),`Development asset packaged: ${file}`);
  if(/\.(html|js|mjs|css)$/.test(file)){
    const code=await readFile(file,'utf8');
    assert.ok(!/<script[^>]+src=["']https?:/i.test(code),`Remote script ${file}`);
    assert.ok(!/(?:import\s*\(|importScripts\s*\(|new\s+Worker\s*\()\s*["']https?:/i.test(code),`Remote executable ${file}`);
    assert.ok(!/(?:\bfrom|\bimport)\s*["']https?:/i.test(code),`Remote module ${file}`);
    assert.ok(!/@import\s*["']https?:/i.test(code),`Remote CSS ${file}`);
  }
}
for(const file of Object.values(manifest.icons)) await stat(path.join('dist',file));
console.log(`Production validated: MV3, zero permissions, local workers/assets, ${files.length} files.`);
