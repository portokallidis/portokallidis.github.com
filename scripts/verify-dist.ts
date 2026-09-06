import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { routeManifest } from '../src/route-manifest';

const root = resolve('dist');
const origin = process.env.SITE_ORIGIN ?? 'https://nporto.com';
const trialToken = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN?.trim();
const routes = routeManifest.map(route => route.path);
const files: string[] = [];
const titles = new Set<string>();
const descriptions = new Set<string>();
const portablePath = /(?:^|\/)(?:models|portable|__dev-model-assets)(?:\/|$)|(?:webgpu|web[-_]?llm|onnxruntime|transformers|model-assets|asset-manifest|portable[-_.])|(?:^|\/)[^/]*worker[^/]*\.[cm]?js$|\.(?:wasm|onnx|safetensors|bin|params)(?:\.|$)/i;
const modelOrigin = /(?:huggingface\.co|(?:[a-z0-9-]+\.)*hf\.co|raw\.githubusercontent\.com\/mlc-ai|api\.(?:openai|anthropic)\.com|generativelanguage\.googleapis\.com)/i;
const portableRuntime = /(?:@mlc-ai\/web-llm|MLCEngine|CreateMLCEngine|WebGPUEngine|WebAssembly|Qwen3|__dev-model-assets|\/\.build\/model-assets|\/models\/|new\s+Worker\s*\()/i;

async function visit(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), `Unexpected deployment symlink: ${entry.name}`);
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else files.push(relative(root, path).split(sep).join('/'));
  }
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1];
}

function text(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

await visit(root);
for (const route of routes) {
  const path = route === '/' ? 'index.html' : `${route.slice(1)}/index.html`;
  const html = await readFile(join(root, path), 'utf8');
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  assert(title && !titles.has(title), `Missing or duplicate title: ${route}`);
  titles.add(title);
  const descriptionTag = html.match(/<meta\b[^>]*>/gi)?.find((tag) => attribute(tag, 'name') === 'description');
  const description = descriptionTag && attribute(descriptionTag, 'content');
  assert(description && !descriptions.has(description), `Missing or duplicate description: ${route}`);
  descriptions.add(description);
  const canonical = html.match(/<link\b[^>]*>/gi)?.find((tag) => attribute(tag, 'rel') === 'canonical');
  assert.equal(canonical && attribute(canonical, 'href'), `${origin}${route === '/' ? '/' : route}`, `Incorrect canonical: ${route}`);
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  assert.equal(headings.length, 1, `Expected exactly one H1: ${route}`);
  assert(text(headings[0][1]).length > 5, `Empty page heading: ${route}`);
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1];
  assert(main && text(main).length >= 150, `Missing meaningful prerendered content: ${route}`);
  assert(!html.includes('<!--$!-->'), `Unresolved server-rendering fallback: ${route}`);
  assert(!/<(?:script|link)\b[^>]*(?:lab-artifacts|AskWork|retrieval|corpus|webgpu|native-answer|\/models\/|\.wasm)/i.test(html), `Demo preloaded before Start: ${route}`);
  const trials = html.match(/<meta\b[^>]*>/gi)?.filter(tag => attribute(tag, 'http-equiv') === 'origin-trial') ?? [];
  assert.equal(trials.length, trialToken ? 1 : 0, `Unexpected origin trial registration: ${route}`);
  if (trialToken) assert.equal(attribute(trials[0], 'content'), trialToken, `Incorrect origin trial token: ${route}`);
}

assert(files.includes('404.html'), 'Missing real static 404 page');
assert(files.includes('_headers'), 'Missing production security headers');
assert(files.includes('_redirects'), 'Missing legacy URL redirects');
assert.deepEqual(files.filter(file => file.startsWith('lab-artifacts/')), ['lab-artifacts/corpus.json'], 'Only the approved corpus may deploy as a lab artifact');
const headers = await readFile(join(root, '_headers'), 'utf8');
const policies = [...headers.matchAll(/^\s*Content-Security-Policy:\s*(.+)$/gim)].map(match => match[1]);
assert(policies.length > 0, 'Missing production Content-Security-Policy');
for (const policy of policies) {
  const directives = new Map(policy.split(';').map(value => {
    const [name, ...sources] = value.trim().split(/\s+/);
    return [name, sources.join(' ')];
  }));
  assert.equal(directives.get('connect-src'), "'self'", 'Production connect-src must allow only same-origin requests');
  assert.equal(directives.get('script-src'), "'self'", 'Production script-src must not enable portable model execution');
  assert.equal(directives.get('worker-src'), "'none'", 'Production must not enable model workers');
}
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
for (const route of routes) assert(sitemap.includes(`<loc>${origin}${route === '/' ? '/' : route}</loc>`), `Sitemap missing ${route}`);
assert(![...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].some((match) => match[1].includes('?')), 'Sitemap must exclude query variants');
for (const file of files) {
  assert(!portablePath.test(file), `Portable model artifact must not deploy: ${file}`);
  assert(!/(^|\/)(?:archive|legacy-site|evidence|docs|tests|node_modules|cv|maps|src|scripts|\.build)(\/|$)|(^|\/)\.env(?:\.|$)|\.map$|(?:Portokallidis-CV|field-engineer-spec|editorial|ledger|recorder|ModelEvaluation)|\.(?:docx|pdf)$/i.test(file), `Private, legacy, or development artifact in dist: ${file}`);
  if (/\.(?:html|[cm]?js|json|css|svg|xml|txt)$/i.test(file) || file === '_headers' || file === '_redirects') {
    const body = await readFile(join(root, file), 'utf8');
    assert(!/6946\s*985\s*370|Portokallidis-CV-2025|PRIVATE KEY/i.test(body), `Unexpected private content: ${file}`);
    assert(!modelOrigin.test(body), `Remote model origin must not deploy: ${file}`);
    assert(!portableRuntime.test(body), `Portable model runtime must not deploy: ${file}`);
  }
}

type Chunk = { file: string; imports?: string[]; dynamicImports?: string[]; css?: string[]; assets?: string[]; isEntry?: boolean };
const manifest = JSON.parse(await readFile(join(root, '.vite/manifest.json'), 'utf8')) as Record<string, Chunk>;
const js = new Set<string>();
const css = new Set<string>();
const media = new Set<string>();
const seen = new Set<string>();
function collect(key: string): void {
  if (seen.has(key)) return;
  seen.add(key);
  const chunk = manifest[key];
  assert(chunk, `Broken Vite import reference: ${key}`);
  if (chunk.file.endsWith('.js')) js.add(chunk.file);
  for (const file of chunk.css ?? []) css.add(file);
  for (const file of chunk.assets ?? []) media.add(file);
  for (const imported of chunk.imports ?? []) collect(imported);
}
for (const [key, chunk] of Object.entries(manifest)) {
  assert(!portablePath.test(key), `Portable model module must not deploy: ${key}`);
  for (const imported of [...chunk.imports ?? [], ...chunk.dynamicImports ?? []]) assert(manifest[imported], `Broken Vite import reference: ${imported}`);
  if (chunk.isEntry || /(?:^|\/)(?:Home|home)(?:Page)?\.[jt]sx?$/.test(key)) collect(key);
}
assert(js.size > 0, 'Could not determine initial client asset graph');
for (const key of seen) assert(!/(?:AskWork|corpus|retrieval|native-answer|webgpu|worker)/i.test(key), `Portfolio data or model code is loaded before an explicit action: ${key}`);
const html = await readFile(join(root, 'index.html'), 'utf8');
for (const tag of html.match(/<(?:link|script|img)\b[^>]*>/gi) ?? []) {
  const src = attribute(tag, 'src') ?? attribute(tag, 'href');
  if (!src?.startsWith('/') || src.startsWith('//')) continue;
  const file = src.slice(1).split(/[?#]/)[0];
  if (!files.includes(file)) continue;
  if (file.endsWith('.js')) js.add(file);
  else if (file.endsWith('.css')) css.add(file);
  else media.add(file);
}
async function compressed(paths: Iterable<string>): Promise<number> {
  let bytes = 0;
  for (const path of paths) bytes += gzipSync(await readFile(join(root, path))).byteLength;
  return bytes;
}
for (const file of [...js, ...css, ...media]) assert(!/(?:\/models\/|\.wasm$|webgpu|worker)/i.test(file), `Model asset loaded before an explicit action: ${file}`);
const initialJs = await compressed(js);
const initialCss = await compressed(css);
const deployedJsFiles = files.filter(file => /\.[cm]?js$/.test(file));
for (const file of deployedJsFiles) assert((await readFile(join(root, file))).byteLength <= 512 * 1024, `Deployed JavaScript chunk exceeds 512 KiB: ${file}`);
const deployedJs = await compressed(deployedJsFiles);
const total = initialJs + initialCss + await compressed(media) + gzipSync(html).byteLength;
assert(initialJs <= 160 * 1024, `Initial JavaScript exceeds 160 KiB: ${initialJs} bytes`);
assert(initialCss <= 35 * 1024, `Initial CSS exceeds 35 KiB: ${initialCss} bytes`);
assert(deployedJs <= 256 * 1024, `Total deployed JavaScript exceeds 256 KiB gzip: ${deployedJs} bytes`);
assert(total <= 450 * 1024, `Initial homepage exceeds 450 KiB: ${total} bytes`);
console.log(JSON.stringify({ routes: routes.length, files: files.length, gzipBytes: { initialJs, initialCss, initialHomepage: total, deployedJs } }, null, 2));
