import { readFile } from 'node:fs/promises';
import { compareSitemaps, parseSitemap, toJsonReport, toMarkdownReport } from '../dist/index.js';

const [beforeXml, afterXml] = await Promise.all([
  readFile(new URL('./before.xml', import.meta.url), 'utf8'),
  readFile(new URL('./after.xml', import.meta.url), 'utf8'),
]);

const before = parseSitemap(beforeXml);
const after = parseSitemap(afterXml);
const diff = compareSitemaps(before, after);

console.log(toJsonReport(diff));
console.log(toMarkdownReport(diff));
