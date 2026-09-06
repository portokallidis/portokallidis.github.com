import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { routeManifest } from '../../src/route-manifest';

const project = process.cwd();
const fixture = await mkdtemp(join(tmpdir(), 'portfolio-artifact-check-'));
const artifacts = join(fixture, 'public/lab-artifacts');
const evidence = join(fixture, 'docs/evidence');
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
function build() {
  return spawnSync(process.execPath, [join(project, 'node_modules/tsx/dist/cli.mjs'), join(project, 'scripts/build-content.ts')], {
    cwd: fixture, encoding: 'utf8', timeout: 30_000,
  });
}
function succeeded(result: ReturnType<typeof build>) {
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'Fixture content build failed');
}

async function verifyDeploymentBoundary(): Promise<void> {
  const output = join(fixture, 'dist');
  const origin = process.env.SITE_ORIGIN ?? 'https://nporto.com';
  const token = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN?.trim();
  const safeHeaders = "/*\n  Content-Security-Policy: default-src 'self'; script-src 'self'; worker-src 'none'; connect-src 'self'\n";
  const manifest = { 'index.html': { file: 'assets/main-fixture.js', isEntry: true } };
  const write = async (path: string, body: string) => {
    await mkdir(dirname(join(output, path)), { recursive: true });
    await writeFile(join(output, path), body);
  };
  const verify = () => spawnSync(process.execPath, [join(project, 'node_modules/tsx/dist/cli.mjs'), join(project, 'scripts/verify-dist.ts')], {
    cwd: fixture, encoding: 'utf8', timeout: 30_000,
  });
  for (const route of routeManifest) {
    const path = route.path === '/' ? 'index.html' : `${route.path.slice(1)}/index.html`;
    await write(path, `<html><head><title>Verifier fixture ${route.path}</title><meta name="description" content="Synthetic verification fixture for ${route.path}"><link rel="canonical" href="${origin}${route.path}">${token ? `<meta http-equiv="origin-trial" content="${token}">` : ''}</head><body><main><h1>Deployment fixture ${route.path}</h1><p>${'This synthetic page exercises build policy and does not represent published content. '.repeat(3)}</p></main></body></html>`);
  }
  await write('404.html', '<h1>Not found</h1>');
  await write('_headers', safeHeaders);
  await write('_redirects', '/legacy / 301\n');
  await write('sitemap.xml', `<urlset>${routeManifest.map(route => `<url><loc>${origin}${route.path}</loc></url>`).join('')}</urlset>`);
  await write('lab-artifacts/corpus.json', '{}\n');
  await write('assets/main-fixture.js', 'console.log("Synthetic deployment fixture");\n');
  await write('.vite/manifest.json', JSON.stringify(manifest));
  succeeded(verify());

  const rejects: { path: string; body: string; error: string }[] = [
    { path: 'models/model.wasm', body: 'Synthetic model asset', error: 'Portable model artifact must not deploy' },
    { path: 'assets/asset-manifest.json', body: '{}', error: 'Portable model artifact must not deploy' },
    { path: 'assets/webgpu.worker-test.js', body: 'void 0;', error: 'Portable model artifact must not deploy' },
    { path: 'assets/optional-runtime.js', body: 'new Worker("./hidden.js");', error: 'Portable model runtime must not deploy' },
    { path: 'assets/optional-runtime.js', body: 'const engine = "MLCEngine";', error: 'Portable model runtime must not deploy' },
    { path: 'assets/optional-runtime.js', body: 'const model = "/.build/model-assets/model.wasm";', error: 'Portable model runtime must not deploy' },
    { path: 'assets/optional-origin.js', body: 'const model = "https://huggingface.co/example/model";', error: 'Remote model origin must not deploy' },
    { path: 'assets/optional-origin.js', body: 'const model = "https://cas-bridge.xethub.hf.co/model";', error: 'Remote model origin must not deploy' },
    { path: 'assets/optional-heavy.js', body: ' '.repeat(512 * 1024 + 1), error: 'Deployed JavaScript chunk exceeds 512 KiB' },
  ];
  for (const item of rejects) {
    await write(item.path, item.body);
    const rejected = verify();
    assert.notEqual(rejected.status, 0, `Deployment verifier must reject ${item.path}`);
    assert(rejected.stderr.includes(item.error), `Wrong rejection for ${item.path}: ${rejected.stderr}`);
    await unlink(join(output, item.path));
  }

  await write('_headers', safeHeaders.replace("connect-src 'self'", "connect-src 'self' https://model.example"));
  const remotePolicy = verify();
  assert.notEqual(remotePolicy.status, 0, 'A remote connection origin must fail deployment policy');
  assert(remotePolicy.stderr.includes('Production connect-src must allow only same-origin requests'), remotePolicy.stderr);
  await write('_headers', safeHeaders);
  await write('.vite/manifest.json', JSON.stringify({ ...manifest, 'src/features/ask-work/webgpu.ts': { file: 'assets/main-fixture.js' } }));
  const retiredModule = verify();
  assert.notEqual(retiredModule.status, 0, 'A retired dynamic module must fail deployment policy');
  assert(retiredModule.stderr.includes('Portable model module must not deploy'), retiredModule.stderr);
  await write('.vite/manifest.json', JSON.stringify(manifest));
  succeeded(verify());
}

try {
  await mkdir(join(fixture, 'src'), { recursive: true });
  await cp(join(project, 'src/content'), join(fixture, 'src/content'), { recursive: true });
  await writeFile(join(fixture, 'package.json'), JSON.stringify({ type: 'module' }));
  succeeded(build());
  assert.deepEqual(await readdir(artifacts), ['corpus.json']);
  const currentCorpus = await readFile(join(artifacts, 'corpus.json'));
  const cases = JSON.parse(await readFile(join(fixture, '.build/evaluation-cases.json'), 'utf8'));
  assert.equal(cases.cases.length, 30);

  // Synthetic historical bytes exercise preservation, never represent model inference.
  const historical = new Map<string, Buffer>();
  for (const name of ['corpus.json', 'manifest.json', 'evaluation-cases.json', 'evaluation-results.json', 'evaluation-summary.json', 'retrieval-evaluation.json', 'runs/case-01.json']) {
    const bytes = Buffer.from(JSON.stringify({ fixture: 'Synthetic historical artifact; no model inference', file: name }) + '\n');
    historical.set(name, bytes);
    await mkdir(dirname(join(artifacts, name)), { recursive: true });
    await writeFile(join(artifacts, name), bytes);
  }
  succeeded(build());
  assert.deepEqual(await readdir(artifacts), ['corpus.json'], 'Old public artifacts must be retired');
  assert((await readFile(join(artifacts, 'corpus.json'))).equals(currentCorpus), 'Current corpus must replace the retired corpus');
  const snapshots = await readdir(evidence);
  assert.equal(snapshots.length, 1);
  const snapshot = join(evidence, snapshots[0]);
  const preservation = JSON.parse(await readFile(join(snapshot, 'preservation-manifest.json'), 'utf8')) as { files: { path: string; bytes: number; sha256: string }[] };
  assert.equal(preservation.files.length, historical.size);
  for (const file of preservation.files) {
    const original = historical.get(file.path);
    assert(original, `Unexpected preserved file: ${file.path}`);
    const copy = await readFile(join(snapshot, file.path));
    assert(copy.equals(original), `Historical bytes changed: ${file.path}`);
    assert.equal(file.bytes, original.byteLength);
    assert.equal(file.sha256, digest(original));
  }
  succeeded(build());
  assert.deepEqual(await readdir(evidence), snapshots, 'Repeat builds must not create duplicate evidence snapshots');

  // Simulate a destination failure to prove preservation precedes deletion.
  const pending = Buffer.from('{"fixture":"Pending archival fixture"}\n');
  await writeFile(join(artifacts, 'manifest.json'), pending);
  const files = [
    { path: 'corpus.json', bytes: currentCorpus.byteLength, sha256: digest(currentCorpus) },
    { path: 'manifest.json', bytes: pending.byteLength, sha256: digest(pending) },
  ];
  const blockedSnapshot = join(evidence, `public-lab-${digest(JSON.stringify(files)).slice(0, 16)}`);
  await writeFile(blockedSnapshot, 'Synthetic destination obstruction');
  const failedPreservation = build();
  assert.notEqual(failedPreservation.status, 0, 'Failed evidence preservation must stop the build');
  assert((await readFile(join(artifacts, 'manifest.json'))).equals(pending), 'Original artifact must survive a failed preservation');
  await unlink(blockedSnapshot);
  succeeded(build());

  await writeFile(join(artifacts, 'unrecognized.txt'), 'An unrecognized file must not be silently deleted.');
  const unknown = build();
  assert.notEqual(unknown.status, 0, 'Unexpected files in the reserved directory must fail the build');
  assert(unknown.stderr.includes('Unexpected file in the generated artifact directory'), unknown.stderr);
  assert.equal(await readFile(join(artifacts, 'unrecognized.txt'), 'utf8'), 'An unrecognized file must not be silently deleted.');
  await verifyDeploymentBoundary();
  console.log('Artifact regressions passed: corpus-only deployment, exact evidence preservation, idempotence, failure recovery, unknown-file protection, and exclusion of portable models, remote origins, and heavy deferred chunks.');
} finally {
  assert.equal(dirname(resolve(fixture)), resolve(tmpdir()), 'Cleanup must stay in the OS temporary directory');
  assert(basename(fixture).startsWith('portfolio-artifact-check-'), 'Unexpected fixture cleanup target');
  await rm(fixture, { recursive: true, force: true });
}
