import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const project = process.cwd();
const temporaryRoot = resolve(tmpdir());
const fixture = await mkdtemp(join(temporaryRoot, 'portfolio-reproducibility-'));
assert(fixture.startsWith(temporaryRoot + sep));
const digest = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
async function hashes(directory: string, prefix = ''): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  for (const file of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${file.name}` : file.name;
    if (file.isDirectory()) Object.assign(entries, await hashes(directory, path));
    else entries[path] = digest(await readFile(join(directory, path)));
  }
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
}
try {
  for (const path of ['src', 'public', 'scripts', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', '.gitignore']) {
    await cp(join(project, path), join(fixture, path), { recursive: true });
  }
  await symlink(join(project, 'node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const steps = [
    ['tsx/dist/cli.mjs', 'scripts/build-content.ts'],
    ['vite/bin/vite.js', 'build'],
    ['vite/bin/vite.js', 'build', '--ssr', 'src/entry-server.tsx', '--outDir', '.build/server'],
    ['tsx/dist/cli.mjs', 'scripts/prerender.ts'],
    ['tsx/dist/cli.mjs', 'scripts/verify-dist.ts'],
  ];
  for (const [tool, ...args] of steps) {
    const result = spawnSync(process.execPath, [join(fixture, 'node_modules', tool), ...args], { cwd: fixture, encoding: 'utf8', timeout: 60_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  }
  const original = await hashes(join(project, 'dist'));
  const repeated = await hashes(join(fixture, 'dist'));
  assert.deepEqual(repeated, original, 'The isolated build must reproduce every deployed byte.');
  const report = { measuredAt: new Date().toISOString(), node: process.version, files: Object.keys(original).length, artifactManifestHash: digest(JSON.stringify(original)), hashes: original };
  await mkdir(join(project, '.build'), { recursive: true });
  await writeFile(join(project, '.build/reproducibility.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Reproduced ${report.files} files byte-for-byte. Manifest SHA-256: ${report.artifactManifestHash}`);
} finally {
  // Remove the link itself before cleaning the explicitly verified temporary directory.
  await rm(join(fixture, 'node_modules'), { force: true });
  await rm(fixture, { recursive: true, force: true });
}
