import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
await mkdir('dist/pdfjs',{recursive:true});
for(const dir of ['cmaps','standard_fonts','wasm']) await cp(`node_modules/pdfjs-dist/${dir}`,`dist/pdfjs/${dir}`,{recursive:true});
// Include complete licence/notice texts for every production dependency, including transitive packages.
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const inventory=[];
await mkdir('dist/licenses',{recursive:true});
for(const [dir,info] of Object.entries(lock.packages)) {
  if(!dir || info.dev || info.link) continue;
  const name=dir.split('node_modules/').at(-1);
  // PDF.js's optional Node-only canvas bindings are used by development tests,
  // never included in the browser bundle or extension package.
  if(name.startsWith('@napi-rs/canvas')) continue;
  const contents=await readdir(dir).catch(error=>{if(info.optional && error.code==='ENOENT')return null;throw error;});
  if(!contents) continue;
  let licenceDir=dir;
  let files=contents.filter(f=>/^(licen[cs]e|notice|copying)/i.test(f));
  // These Radix monorepo subpackages omit the shared licence in their tarballs.
  // react-slot includes the same WorkOS MIT licence as the upstream repository.
  if(!files.length && name.startsWith('@radix-ui/')) {licenceDir='node_modules/@radix-ui/react-slot';files=['LICENSE'];}
  if(!files.length) throw new Error(`Missing licence text: ${name}`);
  inventory.push({name,version:info.version,license:info.license,files});
  const target=path.join('dist/licenses',name.replaceAll('/','__'));
  await mkdir(target,{recursive:true});
  for(const f of files) await cp(path.join(licenceDir,f),path.join(target,f),{recursive:true});
}
await writeFile('dist/licenses/inventory.json',JSON.stringify(inventory,null,2));
await writeFile('THIRD_PARTY_LICENSES.md','# Third-party licences\n\nGenerated from package-lock.json during `npm run build`. Full licence and notice texts are included in `dist/licenses/` and the installable ZIP. Ghostscript is not bundled.\n\n| Package | Version | Licence |\n| --- | --- | --- |\n'+inventory.map(p=>`| ${p.name} | ${p.version} | ${p.license ?? 'See included licence'} |`).join('\n')+'\n');
