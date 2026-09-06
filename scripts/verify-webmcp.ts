import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { parseCorpus } from '../src/features/ask-work/types';

// Real installed Chrome only. This script does not install or replace browser APIs.
// Chrome 152's about_flags.cc maps enable-webmcp-testing to kWebMCP.
const origin = process.env.WEBMCP_TEST_ORIGIN ?? 'http://127.0.0.1:8787';
const expected = parseCorpus(JSON.parse(await readFile('public/lab-artifacts/corpus.json', 'utf8')));
const output = resolve('.build/webmcp-runtime.json');
const report: Record<string, unknown> = {
  schemaVersion: 1, startedAt: new Date().toISOString(), origin,
  corpusHash: expected.hash, headless: true, inference: 'not-invoked',
  verificationScope: 'Installed Chrome native API. Experimental pass explicitly enables WebMCP; no production origin trial token is present.',
  sources: [
    'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    'https://chromium.googlesource.com/chromium/src/+/refs/tags/152.0.7977.82/chrome/browser/about_flags.cc',
    'https://chromium.googlesource.com/chromium/src/+/refs/tags/152.0.7977.82/third_party/blink/renderer/core/script_tools/model_context.cc',
  ],
};
type NativeTool = { name: string; description: string; inputSchema: unknown; annotations: unknown; origin: string };
interface NativeContext {
  registerTool: (...args: unknown[]) => unknown;
  getTools(): Promise<NativeTool[]>;
  executeTool(tool: NativeTool, args: string, options?: { signal?: AbortSignal }): Promise<string | null>;
}
type ToolResult = { corpusRelease: string; corpusHash: string; sources?: typeof expected.chunks; source?: typeof expected.chunks[number] | null };
let context: BrowserContext | undefined;
let page: Page | undefined;
const errors: string[] = [];
const allRequests: { mode: string; url: string; method: string }[] = [];
async function checkpoint(stage: string) {
  report.stage = stage;
  console.log(stage);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
const watchdog = setTimeout(async () => {
  report.result = 'timed-out';
  report.error = `The native browser check exceeded 90 seconds at ${report.stage ?? 'startup'}.`;
  report.requests = allRequests;
  report.completedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  await Promise.race([context?.close().catch(() => undefined), new Promise(resolve => setTimeout(resolve, 1500))]);
  process.exit(1);
}, 90_000);

async function openBrowser(mode: 'vanilla' | 'experimental') {
  const requestedArgs = ['--enable-automation', ...(mode === 'experimental' ? ['--enable-features=WebMCP'] : [])];
  const profile = resolve('.build/webmcp-chrome', mode);
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless: true, args: requestedArgs,
    viewport: { width: 1280, height: 900 }, timeout: 30_000,
  });
  page = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(10_000);
  context.on('request', request => allRequests.push({ mode, url: request.url(), method: request.method() }));
  context.on('page', next => next.on('pageerror', reason => errors.push(reason.message)));
  page.on('pageerror', reason => errors.push(reason.message));
  const cdp = await context.newCDPSession(page);
  const browser = await cdp.send('Browser.getVersion');
  const command = await cdp.send('Browser.getBrowserCommandLine');
  const response = await page.goto(origin, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.equal(response?.status(), 200);
  assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
  const capability = await page.evaluate(() => {
    const api = (document as Document & { modelContext?: NativeContext }).modelContext;
    return {
      apiPresent: !!api,
      methods: api ? Object.fromEntries(['registerTool', 'getTools', 'executeTool'].map(name => [name, typeof api[name as keyof NativeContext]])) : {},
      nativeFunctions: api ? Object.fromEntries(['registerTool', 'getTools', 'executeTool'].map(name => [name, Function.prototype.toString.call(api[name as keyof NativeContext])])) : {},
      originTrialTokens: document.querySelectorAll('meta[http-equiv="origin-trial"]').length,
    };
  });
  const modeReport = { profile, requestedArgs, browser, actualCommandLine: command.arguments, capability, initialRequests: allRequests.filter(item => item.mode === mode) };
  report[mode] = modeReport;
  assert.equal(capability.originTrialTokens, 0, 'This verification expects no production origin-trial token');
  assert(!modeReport.initialRequests.some(item => /lab-artifacts|corpus-|retrieval-|AskWork-|webgpu|\.wasm|\/models\//i.test(item.url)), 'Initial page must not request corpus or model resources');
  console.log(`${mode}: ${browser.product}; document.modelContext=${capability.apiPresent}`);
  return { page, capability, modeReport };
}

async function tools(target: Page) {
  return target.evaluate(async () => {
    const api = (document as Document & { modelContext: NativeContext }).modelContext;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const found = await Promise.race([api.getTools(), new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error('Native getTools exceeded 6 seconds.')), 6000);
      })]);
      return found.map(({ name, description, inputSchema, annotations, origin }) => ({ name, description, inputSchema, annotations, origin }));
    } finally { clearTimeout(deadline); }
  });
}

async function invoke(target: Page, name: string, args: unknown, abort = false) {
  return target.evaluate(async ({ name, args, abort }) => {
    const api = (document as Document & { modelContext: NativeContext }).modelContext;
    const controller = new AbortController();
    const started = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    if (abort) timer = setTimeout(() => controller.abort(), 150);
    try {
      const result = await Promise.race([
        (async () => {
          const tool = (await api.getTools()).find(item => item.name === name);
          if (!tool) throw new Error(`Native tool was not discovered: ${name}`);
          return api.executeTool(tool, JSON.stringify(args), { signal: controller.signal });
        })(),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(() => { controller.abort(); reject(new Error('Native execution exceeded 10 seconds.')); }, 10_000);
        }),
      ]);
      return { status: 'fulfilled' as const, result, durationMs: performance.now() - started };
    } catch (reason) {
      return { status: 'rejected' as const, error: reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason), durationMs: performance.now() - started };
    } finally { clearTimeout(timer); clearTimeout(deadline); }
  }, { name, args, abort });
}

function validateResult(raw: Awaited<ReturnType<typeof invoke>>): ToolResult {
  assert.equal(raw.status, 'fulfilled', JSON.stringify(raw));
  assert.equal(typeof raw.result, 'string');
  const result = JSON.parse(raw.result!) as ToolResult;
  assert.equal(result.corpusHash, expected.hash);
  assert.equal(result.corpusRelease, expected.release);
  for (const source of result.sources ?? (result.source ? [result.source] : [])) {
    assert.deepEqual(source, expected.chunks.find(chunk => chunk.id === source.id), 'Tool must return an exact approved source');
    assert(!/\bNikolaos\b|\bN\. Portokallidis\b/.test(JSON.stringify(source)), 'Current source must use the preferred name');
  }
  return result;
}

try {
  await mkdir('.build', { recursive: true });
  const vanilla = await openBrowser('vanilla');
  await vanilla.page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Ask', exact: true }).click();
  await vanilla.page.getByRole('button', { name: 'Start', exact: true }).waitFor();
  report.vanillaNoApiFallback = {
    apiAbsent: !vanilla.capability.apiPresent,
    staticNavigationWorks: true,
    startRemainsAvailable: true,
    artifactRequests: allRequests.filter(item => item.mode === 'vanilla' && /lab-artifacts|\.wasm|webgpu|\/models\//.test(item.url)),
  };
  await context!.close(); context = undefined;

  const experimental = await openBrowser('experimental');
  assert(experimental.capability.apiPresent, 'The installed browser did not expose document.modelContext with WebMCP enabled');
  assert(Object.values(experimental.capability.nativeFunctions).every(value => value.includes('[native code]')), 'Expected native API functions');
  await checkpoint('Discovering native tools before Start');
  const discovered = await tools(experimental.page);
  report.discoveredBeforeStart = discovered;
  assert.deepEqual(discovered.map(tool => tool.name).sort(), ['get_portfolio_source', 'search_portfolio']);
  assert(discovered.every(tool => tool.origin === origin), 'Tools must remain on the current origin');
  assert(discovered.every(tool => (tool.annotations as { readOnlyHint?: boolean }).readOnlyHint), 'Tools must advertise read-only behavior');
  assert(!allRequests.some(item => item.mode === 'experimental' && item.url.includes('/lab-artifacts/')), 'Discovery must not fetch the corpus');

  const invalidInputs = [];
  await checkpoint('Checking native input validation');
  for (const [name, args] of [
    ['search_portfolio', { query: '' }], ['search_portfolio', { query: 'a'.repeat(501) }],
    ['search_portfolio', { query: 'CARRE', url: 'https://example.com' }], ['get_portfolio_source', { id: '' }],
  ] as const) {
    const result = await invoke(experimental.page, name, args);
    invalidInputs.push({ name, args, ...result });
    assert.equal(result.status, 'rejected', `Invalid arguments accepted by ${name}`);
  }
  report.invalidInputs = invalidInputs;
  assert(!allRequests.some(item => item.mode === 'experimental' && item.url.includes('/lab-artifacts/')), 'Invalid inputs must not fetch the corpus');

  await checkpoint('Executing native search and source lookup');
  const search = await invoke(experimental.page, 'search_portfolio', { query: 'CARRE ontology' });
  report.execution = { search };
  await checkpoint('Native search returned; verifying the original source passages');
  const searchResult = validateResult(search);
  assert(searchResult.sources && searchResult.sources.length > 0 && searchResult.sources.length <= 5, 'Search must return one to five source passages');
  assert(searchResult.sources.some(source => source.id.startsWith('carre-')), 'CARRE search must include an approved CARRE source');
  const lookup = await invoke(experimental.page, 'get_portfolio_source', { id: searchResult.sources[0].id });
  assert.deepEqual(validateResult(lookup).source, searchResult.sources[0]);
  const identity = await invoke(experimental.page, 'get_portfolio_source', { id: 'about-approach' });
  assert(validateResult(identity).source?.title.includes('Nick'), 'The identity source must use Nick');
  const missing = await invoke(experimental.page, 'get_portfolio_source', { id: 'unknown-source' });
  assert.equal(validateResult(missing).source, null);
  report.execution = { search, lookup, identity, missing };

  const routes = [];
  await checkpoint('Checking native registration across SPA routes');
  for (const label of ['About', 'Work', 'Ask']) {
    await experimental.page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label, exact: true }).click();
    await experimental.page.waitForLoadState('networkidle');
    const registered = await tools(experimental.page);
    assert.deepEqual(registered.map(tool => tool.name).sort(), ['get_portfolio_source', 'search_portfolio']);
    routes.push({ url: experimental.page.url(), tools: registered.map(tool => tool.name) });
  }
  await experimental.page.getByRole('button', { name: 'Start', exact: true }).waitFor();
  report.spaRoutes = routes;
  report.startRemainedUnclicked = true;

  // Delay only the real corpus request on a fresh document to exercise native cancellation.
  await checkpoint('Checking native cancellation during a corpus fetch');
  const cancellationPage = await context!.newPage();
  page = cancellationPage;
  const cancelledRequests: { url: string; error: string | null }[] = [];
  const completedCorpusRequests: string[] = [];
  let corpusWasRequested = false;
  cancellationPage.on('requestfailed', request => cancelledRequests.push({ url: request.url(), error: request.failure()?.errorText ?? null }));
  cancellationPage.on('requestfinished', request => {
    if (request.url().endsWith('/lab-artifacts/corpus.json')) completedCorpusRequests.push(request.url());
  });
  await cancellationPage.route('**/lab-artifacts/corpus.json', async route => {
    corpusWasRequested = true;
    await new Promise(resolve => setTimeout(resolve, 750));
    await route.continue().catch(() => undefined);
  });
  await cancellationPage.goto(origin, { waitUntil: 'networkidle' });
  const cancelled = await invoke(cancellationPage, 'search_portfolio', { query: 'CARRE ontology' }, true);
  await cancellationPage.waitForTimeout(850);
  report.cancellation = { controlledNetworkDelayMs: 750, corpusWasRequested, cancelled, cancelledRequests, completedCorpusRequests };
  assert(corpusWasRequested, 'Cancellation must exercise an in-flight corpus fetch');
  assert.equal(cancelled.status, 'rejected');
  assert(/abort|cancel/i.test(cancelled.error ?? ''), 'Native cancellation did not return an abort error');
  // Inspect the real browser callback contract without replacing any API or site tool.
  // A JavaScript string avoids tsx inserting its __name helper into the browser callback.
  const callbackContract = await cancellationPage.evaluate<{ argumentCount: number; executionSignalProvided: boolean }>(`(async () => {
    const api = document.modelContext;
    const controller = new AbortController();
    const name = 'verification_callback_contract';
    await api.registerTool({
      name, description: 'Temporary test harness callback-contract probe. No side effects or network requests.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async function (...args) {
        const options = args[1];
        return JSON.stringify({ argumentCount: args.length, executionSignalProvided: options?.signal instanceof AbortSignal });
      },
    }, { signal: controller.signal });
    try {
      const tool = (await api.getTools()).find(item => item.name === name);
      if (!tool) throw new Error('The temporary native callback probe was not registered.');
      return JSON.parse(await api.executeTool(tool, '{}'));
    } finally { controller.abort(); }
  })()`);
  report.callbackContract = callbackContract;
  assert.deepEqual((await tools(cancellationPage)).map(tool => tool.name).sort(), ['get_portfolio_source', 'search_portfolio'], 'The temporary probe must be unregistered');
  const upstreamFetchStopped = cancelledRequests.some(request => request.url.endsWith('/lab-artifacts/corpus.json'));
  const limitations: string[] = [];
  if (!upstreamFetchStopped) {
    assert(completedCorpusRequests.length > 0, 'The cancellation probe must record the actual fetch outcome');
    assert.equal(callbackContract.executionSignalProvided, false, 'An unexpected cancellation regression needs investigation');
    limitations.push('Chrome 152 rejects the executeTool caller when its signal aborts, but passes only one callback argument. It does not provide the execution signal documented for newer implementations, so the read-only corpus fetch completes. The site handles execution signals when supplied and its own registration cleanup signal independently.');
  }
  report.browserLimitations = limitations;
  report.upstreamFetchStopped = upstreamFetchStopped;

  report.requests = allRequests;
  report.externalPageRequests = allRequests.filter(item => new URL(item.url).origin !== origin);
  assert.equal((report.externalPageRequests as unknown[]).length, 0, 'WebMCP must not trigger external requests');
  assert(!allRequests.some(item => /\/models\/|\.wasm|webgpu|huggingface|\.hf\.co/.test(item.url)), 'Read-only tools must not load a model');
  assert(allRequests.every(item => item.method === 'GET'), 'Read-only tools must not send mutations');
  assert.equal(errors.length, 0, errors.join('\n'));
  report.result = limitations.length ? 'passed-with-browser-limitation' : 'passed';
  console.log(`Real WebMCP ${report.result}: discovery, validation, exact sources, route lifecycle, caller cancellation, and no model/external requests.`);
} catch (reason) {
  report.result = 'failed';
  report.error = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
  report.requests = allRequests;
  if (page) {
    report.pageState = await page.locator('body').ariaSnapshot().catch(() => 'Page unavailable');
    await page.screenshot({ path: '.build/webmcp-runtime-failure.png', fullPage: true }).catch(() => undefined);
  }
  process.exitCode = 1;
  console.error(report.error);
} finally {
  clearTimeout(watchdog);
  report.pageErrors = errors;
  report.completedAt = new Date().toISOString();
  const bytes = JSON.stringify(report, null, 2) + '\n';
  await writeFile(output, bytes);
  if (String(report.result).startsWith('passed')) {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const preserved = resolve('docs/evidence', `webmcp-runtime-${hash.slice(0, 16)}.json`);
    await mkdir('docs/evidence', { recursive: true });
    await writeFile(preserved, bytes);
    assert.equal(createHash('sha256').update(await readFile(preserved)).digest('hex'), hash, 'Runtime evidence copy changed');
    console.log(`Preserved ${preserved}; SHA256 ${hash}`);
  }
  await context?.close();
}
