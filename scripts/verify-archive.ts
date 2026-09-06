import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

const root = resolve('archive/legacy-site');
const expected = JSON.parse(await readFile('archive/sha256.json', 'utf8')) as Record<string, string>;
const actual: string[] = [];

async function visit(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), `Archive must not contain symbolic links: ${entry.name}`);
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else actual.push(relative(root, path).split(sep).join('/'));
  }
}

await visit(root);
assert.deepEqual(actual.sort(), Object.keys(expected).sort(), 'Archive file list changed');
for (const [path, hash] of Object.entries(expected)) {
  const resolved = resolve(root, path);
  assert(resolved.startsWith(root + sep), `Unsafe archive path: ${path}`);
  const actualHash = createHash('sha256').update(await readFile(resolved)).digest('hex');
  assert.equal(actualHash.toLowerCase(), hash.toLowerCase(), `Archived bytes changed: ${path}`);
}
console.log(`Archive verified: ${actual.length} original files match their SHA-256 records.`);
