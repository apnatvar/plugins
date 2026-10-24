import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check with npm run check:consumer.');
const consumer = mkdtempSync(join(root, '.consumer-'));
const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const run = (binary, args, cwd) => {
  const output = spawnSync(binary, args, { cwd, encoding: 'utf8', timeout: 120000, env: process.env });
  if (output.error || output.status !== 0) throw new Error(`${args[0]} failed: ${output.error?.message ?? output.stderr ?? output.stdout}`);
  return output.stdout;
};
try {
  const packed = JSON.parse(run(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--offline', '--cache', join(root, '.npm-cache'), '--userconfig', join(root, 'scripts/empty.npmrc'), '--globalconfig', join(root, 'scripts/empty-global.npmrc'), '--pack-destination', consumer], root));
  const entry = packed[0];
  if (!entry || typeof entry.filename !== 'string' || !/^[A-Za-z0-9_.-]+\.tgz$/.test(entry.filename)) throw new Error('Unexpected tarball name.');
  const files = entry.files.map(file => file.path);
  if (!files.includes('dist/index.js') || !files.includes('dist/india.d.ts') || files.some(path => /(?:^|\/)(?:node_modules|test|scripts|\.npmrc|\.env)(?:\/|$)/.test(path))) throw new Error('Unexpected packed files.');
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(process.execPath, [npmCli, 'install', join(consumer, entry.filename), '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(root, '.npm-cache'), '--userconfig', join(root, 'scripts/empty.npmrc'), '--globalconfig', join(root, 'scripts/empty-global.npmrc')], consumer);
  writeFileSync(join(consumer, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import {validateInvoice,validateInvoiceJson,createValidator} from ${JSON.stringify(metadata.name)};
import {createIndiaRules,isValidGstin} from ${JSON.stringify(metadata.name + '/india')};
const invoice={id:'DEMO-1',date:'2026-10-24',currency:'INR',supplier:{name:'Fictional Studio'},customer:{name:'Fictional Customer'},items:[{description:'Work',quantity:'1',unitPrice:'100',netAmount:'100',taxes:[{code:'CGST',rate:'9',amount:'9'},{code:'SGST',rate:'9',amount:'9'}],total:'118'}],totals:{subtotal:'100',tax:'18',total:'118'},india:{supplyType:'intra'}};
assert.equal(validateInvoice(invoice,{rules:createIndiaRules({checkSupplyType:true})}).valid,true);
assert.equal(validateInvoiceJson(JSON.stringify(invoice)).valid,true);
assert.equal(createValidator()(invoice).valid,true);
assert.equal(isValidGstin('27AAPFU0939F1ZV'),true);
`);
  run(process.execPath, ['consumer.mjs'], consumer);
  writeFileSync(join(consumer, 'consumer.mts'), `
import {validateInvoice,createValidator,type Invoice,type ValidationOptions,type ValidationResult} from ${JSON.stringify(metadata.name)};
import {createIndiaRules,type IndiaRuleOptions} from ${JSON.stringify(metadata.name + '/india')};
const india:IndiaRuleOptions={checkSupplyType:true,checkStateConsistency:true};
const options:ValidationOptions={precision:2,rules:createIndiaRules(india)};
export function check(invoice:Invoice):ValidationResult{return createValidator(options)(invoice)};
export const result:ValidationResult=validateInvoice({},options);
`);
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'consumer.mts'], consumer);
  console.log(`Clean tarball consumer passed: ESM root + India imports, runtime validation, TypeScript declarations (${files.length} packed files).`);
} finally {
  const target = resolve(consumer);
  if (target.startsWith(root + sep) && target.slice(root.length + 1).startsWith('.consumer-')) rmSync(target, { recursive: true, force: true });
}
