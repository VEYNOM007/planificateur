// Vérifie le poids initial compressé (gzip) : cible < 200 ko.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT = 200 * 1024;
const dist = join(process.cwd(), 'dist');
const COUNTED = new Set(['.js', '.css', '.html']);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (COUNTED.has(extname(full))) files.push(full);
  }
  return files;
}

let total = 0;
const rows = [];
for (const file of walk(dist)) {
  const size = gzipSync(readFileSync(file), { level: 9 }).length;
  total += size;
  rows.push({ name: file.slice(dist.length + 1), size });
}

rows.sort((a, b) => b.size - a.size);
for (const row of rows) {
  console.log(`${(row.size / 1024).toFixed(1).padStart(8)} ko  ${row.name}`);
}
console.log('-'.repeat(40));
console.log(`${(total / 1024).toFixed(1).padStart(8)} ko  TOTAL gzip (html+js+css)`);

if (total > LIMIT) {
  console.error(`ERREUR : ${Math.round(total / 1024)} ko dépasse la limite de 200 ko.`);
  process.exit(1);
}
console.log('OK : sous la limite de 200 ko.');
