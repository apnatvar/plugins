import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const inventory = Object.entries(lock.packages).filter(([location]) => location).map(([location]) => {
  const pkg = JSON.parse(readFileSync(join(location, 'package.json'), 'utf8'));
  return { name: pkg.name, version: pkg.version, license: pkg.license ?? 'UNDECLARED', developmentOnly: true };
}).sort((a, b) => a.name.localeCompare(b.name));
writeFileSync('docs/dependency-licenses.json', JSON.stringify({ reviewDate: new Date().toISOString().slice(0, 10), runtimeDependencies: [], developmentDependencies: inventory }, null, 2) + '\n');
console.log(`Recorded declared licenses for ${inventory.length} development packages; review notices before redistributing tooling.`);
