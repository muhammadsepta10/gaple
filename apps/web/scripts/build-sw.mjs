import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = new URL('../dist/', import.meta.url);

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    return entry.isDirectory() ? filesIn(file) : Promise.resolve([file]);
  }));
  return nested.flat();
}

const files = (await filesIn(dist))
  .map((file) => ({ file, name: path.relative(dist.pathname, file.pathname) }))
  .filter(({ name }) => name !== 'sw.js' && name !== 'index.html')
  .sort((a, b) => a.name.localeCompare(b.name));
if (!files.some(({ name }) => name === 'meja/hijau.svg')) throw new Error('Default table image missing');
const optional = files.map(({ name }) => name)
  .filter((name) => name.startsWith('meja/') && name !== 'meja/hijau.svg');
const precache = ['./', ...files.map(({ name }) => name).filter((name) => !optional.includes(name))];
const hash = createHash('sha256');
for (const { file, name } of files) {
  if (optional.includes(name)) continue;
  hash.update(name);
  hash.update(await readFile(file));
}
hash.update(await readFile(new URL('../dist/index.html', import.meta.url)));
const version = hash.digest('hex').slice(0, 12);

const source = await readFile(new URL('./sw-template.js', import.meta.url), 'utf8');
await writeFile(new URL('../dist/sw.js', import.meta.url), source
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(precache))
  .replace('__OPTIONAL__', JSON.stringify(optional)));
