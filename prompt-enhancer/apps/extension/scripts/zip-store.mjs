import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const wxtCli = fileURLToPath(new URL('../node_modules/wxt/bin/wxt.mjs', import.meta.url));
const result = spawnSync(process.execPath, [wxtCli, 'zip'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
