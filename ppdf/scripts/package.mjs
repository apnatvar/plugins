import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {zipSync} from 'fflate';
await import('./validate-build.mjs');
const entries={};
async function walk(dir){for(const name of await readdir(dir)){const p=path.join(dir,name);if((await stat(p)).isDirectory())await walk(p);else entries[path.relative('dist',p).replaceAll('\\','/')]=new Uint8Array(await readFile(p));}}
await walk('dist'); await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/ppdf-0.1.0.zip',zipSync(entries,{level:6}));
console.log('Created artifacts/ppdf-0.1.0.zip (unzip and Load unpacked in Chrome).');
