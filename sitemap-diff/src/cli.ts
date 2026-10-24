#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { readXmlStream } from './fetch.js';
import { diffSitemaps } from './loader.js';
import { resolveOptions, type LoadOptions } from './options.js';
import { toJsonReport, toMarkdownReport } from './report.js';

const help = `Usage: sitemap-diff BEFORE AFTER [options]
Compare two UTF-8 XML files (.gz supported) or HTTP(S) URLs.
  --format json|markdown       Report format (default json)
  --output PATH                Write report to a file
  --timeout-ms N               Total timeout per remote document (default 10000)
  --max-bytes N                Raw and decoded bytes per document (default 5242880)
  --max-depth N                Maximum index depth (default 5)
  --allow-private-networks     Permit trusted private destinations
  --help                      Show help
  --                          Treat remaining arguments as paths
Brownsmith Dynamics · https://brownsmithdynamics.com
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(help); return; }
  const options: LoadOptions = {};
  const positional: string[] = [];
  let format = 'json';
  let output: string | undefined;
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!literal && arg === '--') { literal = true; continue; }
    if (!literal && arg === '--allow-private-networks') { options.allowPrivateNetworks = true; continue; }
    if (!literal && arg.startsWith('--')) {
      const value = args[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      if (arg === '--format') format = value;
      else if (arg === '--output') output = value;
      else if (arg === '--timeout-ms') options.timeoutMs = Number(value);
      else if (arg === '--max-bytes') options.maxBytes = Number(value);
      else if (arg === '--max-depth') options.maxDepth = Number(value);
      else throw new Error(`Unknown option ${arg}`);
    } else positional.push(arg);
  }
  if (positional.length !== 2) throw new Error('Provide exactly two sitemap files or URLs; use --help');
  if (!['json', 'markdown'].includes(format)) throw new Error('Format must be json or markdown');
  const limits = resolveOptions(options);
  const source = async (path: string) => /^https?:\/\//i.test(path) ? path : await readXmlStream(createReadStream(path), path.toLowerCase().endsWith('.gz'), limits.maxBytes);
  const before = await source(positional[0]!);
  const after = await source(positional[1]!);
  const diff = await diffSitemaps(before, after, options);
  const report = format === 'markdown' ? toMarkdownReport(diff) : toJsonReport(diff);
  if (output) await writeFile(output, report + '\n', 'utf8');
  else process.stdout.write(report + '\n');
}
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`sitemap-diff: ${message.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, '?')}\n`);
  process.exitCode = 1;
});
