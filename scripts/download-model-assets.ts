import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import assets from '../src/features/ask-work/model-assets.json';

// Explicit development preparation only. These assets are never copied into dist.
const directory = resolve('.build/model-assets');
const destination = resolve(directory, basename(assets.wasm.path));
function verify(bytes: Buffer) {
  if (bytes.byteLength !== assets.wasm.bytes) throw new Error('Compiled model size differs from the pinned release.');
  const blobHash = createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
  if (blobHash !== assets.wasm.gitBlobSha1) throw new Error('Compiled model differs from the pinned Git blob.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== assets.wasm.sha256) throw new Error('Compiled model SHA256 differs from the pinned release.');
  return sha256;
}

let bytes: Buffer;
try {
  bytes = await readFile(destination);
  verify(bytes);
} catch (reason) {
  if ((reason as NodeJS.ErrnoException).code !== 'ENOENT') throw reason;
  const response = await fetch(assets.wasm.url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Compiled model download failed (${response.status}).`, { cause: reason });
  bytes = Buffer.from(await response.arrayBuffer());
  verify(bytes);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes, { flag: 'wx' });
}
const sha256 = verify(bytes);
await writeFile(resolve(directory, 'asset-manifest.json'), `${JSON.stringify({
  schemaVersion: 1, runtime: assets.runtime, modelId: assets.modelId, modelRevision: assets.modelRevision,
  modelUrl: assets.modelUrl, modelBytes: assets.modelBytes, wasm: { ...assets.wasm, sha256 }, license: assets.license,
}, null, 2)}\n`);
console.log(`Verified ${assets.wasm.path}: ${bytes.byteLength} bytes, SHA256 ${sha256}`);
