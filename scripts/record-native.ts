import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('.build');
const profile = resolve(output, 'native-chrome');
const productionOnly = process.argv.includes('--production-only');
const reportName = productionOnly ? 'native-production-smoke' : 'native-smoke';
const recorderUrl = process.env.RECORDER_URL ?? 'http://127.0.0.1:5173/recorder.html';
await mkdir(output, { recursive: true });
const report: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  recorderUrl,
  profile,
  modelRevision: null,
  modelRevisionStatus: 'not-exposed',
  browserFeatureOverrides: false,
  result: 'pending',
};
let context: BrowserContext | undefined;
let page: Page | undefined;
const browserErrors: string[] = [];
const attempts: { at: string; apiPresent: boolean; availability: string; error?: string }[] = [];

async function availability(target: Page) {
  const pending = target.evaluate(async () => {
    const model = (globalThis as typeof globalThis & { LanguageModel?: { availability: (options: object) => Promise<string> } }).LanguageModel;
    if (!model) return { apiPresent: false, availability: 'unavailable', error: 'LanguageModel is not exposed in this document.' };
    try {
      const available = await model.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] });
      return { apiPresent: true, availability: available };
    } catch (reason) {
      return { apiPresent: true, availability: 'unavailable', error: String(reason) };
    }
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<{ apiPresent: boolean; availability: string; error: string }>((resolve) => {
        timer = setTimeout(() => resolve({ apiPresent: true, availability: 'unavailable', error: 'Native availability did not resolve within 30 seconds.' }), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function diagnosticPage(url: string) {
  if (!context) return;
  let diagnostic: Page | undefined;
  try {
    diagnostic = await context.newPage();
    await diagnostic.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    return { url, snapshot: await diagnostic.locator('body').ariaSnapshot({ timeout: 10_000 }) };
  } catch (reason) {
    return { url, error: String(reason) };
  } finally {
    await diagnostic?.close().catch(() => undefined);
  }
}

async function smokeProduction(target: Page) {
  const url = 'http://127.0.0.1:8787/lab/ask-about-my-work';
  const question = 'What did Nick Portokallidis contribute to CARRE?';
  const requests: string[] = [];
  target.on('request', (request) => requests.push(request.url()));
  const response = await target.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  report.productionUrl = url;
  report.responseStatus = response?.status();
  report.contentSecurityPolicy = response?.headers()['content-security-policy'];
  report.corpusHash = (JSON.parse(await readFile('dist/lab-artifacts/corpus.json', 'utf8')) as { hash: string }).hash;
  report.buildManifestSha256 = createHash('sha256').update(await readFile('dist/.vite/manifest.json')).digest('hex');
  report.beforeStartArtifactRequests = requests.filter((request) => /\/lab-artifacts\/|\/models\/|huggingface\.co|\.hf\.co|AskWork|webgpu|web-llm|corpus|retrieval/.test(request));
  if ((report.beforeStartArtifactRequests as string[]).length) throw new Error('Production loaded lab artifacts before Start.');
  const capability = await availability(target);
  report.availability = capability;
  if (capability.availability === 'unavailable') throw new Error(capability.error ?? 'Native AI is unavailable on the production runtime.');
  const startedAt = Date.now();
  await target.getByRole('button', { name: 'Start', exact: true }).click();
  const loading: string[] = [];
  const readyDeadline = Date.now() + 180_000;
  while (!await target.getByText('On-device chat', { exact: true }).isVisible()) {
    const status = (await target.getByRole('status').allTextContents()).join(' ');
    if (loading.at(-1) !== status) { loading.push(status); console.log(status); }
    if (await target.getByText('Portfolio source search', { exact: true }).isVisible()) throw new Error('Production local AI failed to initialize: ' + await target.locator('.chat-fallback').innerText());
    if (Date.now() > readyDeadline) throw new Error('Production model preparation exceeded three minutes.');
    await target.waitForTimeout(1000);
  }
  report.startupMs = Date.now() - startedAt;
  report.loadingStates = loading;
  await target.getByRole('textbox', { name: 'Your question', exact: true }).fill(question);
  await target.getByRole('button', { name: 'Send', exact: true }).click();
  const deadline = Date.now() + 180_000;
  while (!await target.locator('.chat-answer-text').isVisible()) {
    const errors = await target.getByRole('alert').allTextContents();
    if (errors.length) throw new Error(errors.join('\n'));
    if (Date.now() > deadline) throw new Error('The production answer did not finish within three minutes.');
    await target.waitForTimeout(1000);
  }
  report.question = question;
  report.answer = await target.locator('.chat-answer-text').innerText();
  report.label = await target.locator('.chat-answer .eyebrow').innerText();
  if (String(report.label).toLowerCase() !== 'answered locally') throw new Error('Production did not return a generated answer: ' + report.label);
  report.citations = await target.locator('.chat-answer .chat-sources a').evaluateAll((links) => links.map((link) => ({ title: link.textContent, href: link.getAttribute('href') })));
  if (!(report.citations as unknown[]).length) throw new Error('The production answer has no supporting citations.');
  report.pageRequests = requests;
  report.result = 'answered';
  console.log(`Real production answer: ${report.answer}`);
}

try {
  // Use normal Chrome defaults. Playwright normally disables component updates and
  // OptimizationHints, which would confound this real built-in-model check.
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: false,
    ignoreDefaultArgs: true,
    args: [
      '--remote-debugging-pipe',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-position=-2400,-2400',
      '--window-size=1280,960',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      'about:blank',
    ],
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
    timeout: 30_000,
  });
  report.browserVersion = context.browser()?.version();
  console.log(`Installed Chrome: ${report.browserVersion}. Isolated profile: ${profile}`);
  page = context.pages()[0] ?? await context.newPage();
  await page.bringToFront();
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  if (productionOnly) {
    await smokeProduction(page);
  } else {
  console.log('Opening the recorder and starting its public-data surface.');
  await page.goto(recorderUrl, { waitUntil: 'networkidle', timeout: 30_000 });
  report.preStart = await page.locator('body').ariaSnapshot();
  await page.getByRole('button', { name: 'Start recorder', exact: true }).click();
  console.log('Recorder started. Checking actual native availability.');

  const probeDeadline = Date.now() + 90_000;
  let capability = await availability(page);
  for (;;) {
    attempts.push({ at: new Date().toISOString(), ...capability });
    console.log(`Native availability: ${capability.availability}; API exposed: ${capability.apiPresent}`);
    if (capability.availability !== 'unavailable' || Date.now() >= probeDeadline || !capability.apiPresent) break;
    await page.waitForTimeout(10_000);
    capability = await availability(page);
  }
  report.availability = capability;
  if (capability.availability === 'unavailable') throw new Error(capability.error ?? 'Chrome reports the local model unavailable after a 90-second eligibility probe.');

  if (!await page.getByRole('button', { name: 'Enable local AI', exact: true }).isVisible()) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Start recorder', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Enable local AI', exact: true }).click({ timeout: 15_000 });
  report.enableClickedAt = new Date().toISOString();

  const downloadDeadline = Date.now() + 20 * 60_000;
  let lastProgress = '';
  let lastProgressAt = Date.now();
  let downloadStarted = capability.availability === 'downloading';
  for (;;) {
    if (await page.getByRole('button', { name: 'Start recorder', exact: true }).isVisible()) {
      throw new Error('The recorder page reloaded during model preparation. Restart the recording flow once the dev server is stable.');
    }
    if (await page.getByText('● Local model ready', { exact: true }).isVisible()) break;
    const errors = await page.getByRole('alert').allTextContents();
    if (errors.length) throw new Error(errors.join('\n'));
    const progress = await page.locator('.ask-notice').innerText().catch(() => 'Preparing local model');
    if (progress !== lastProgress) {
      lastProgress = progress;
      lastProgressAt = Date.now();
      console.log(progress.replaceAll('\n', ' '));
    }
    if (/Model download: [1-9]\d*%/.test(progress)) downloadStarted = true;
    if (Date.now() >= downloadDeadline) throw new Error('Model preparation exceeded the 20-minute download allowance.');
    if (!downloadStarted && Date.now() - lastProgressAt > 90_000) throw new Error('Model preparation made no visible progress for 90 seconds.');
    await page.waitForTimeout(5000);
  }
  report.modelReadyAt = new Date().toISOString();
  console.log('Native model ready. Starting the 30 real evaluation cases.');
  await page.getByRole('button', { name: 'Record all 30 cases', exact: true }).click();
  const recordingDeadline = Date.now() + 20 * 60_000;
  let previousStatus = '';
  for (;;) {
    if (await page.getByRole('link', { name: 'Download recordings for review', exact: true }).isVisible()) break;
    const errors = await page.getByRole('alert').allTextContents();
    if (errors.length) throw new Error(errors.join('\n'));
    const status = (await page.getByRole('status').allTextContents()).join(' ');
    if (status !== previousStatus) {
      console.log(status);
      previousStatus = status;
    }
    if (Date.now() >= recordingDeadline) throw new Error(`Recording exceeded 20 minutes. Last progress: ${previousStatus}`);
    await page.waitForTimeout(3000);
  }
  const artifactText = await page.getByRole('link', { name: 'Download recordings for review', exact: true }).evaluate(async (link) => {
    const response = await fetch((link as HTMLAnchorElement).href);
    return response.text();
  });
  const artifactPath = resolve(output, 'native-recordings.json');
  await writeFile(artifactPath, artifactText);
  const bundle = JSON.parse(await readFile(artifactPath, 'utf8')) as { runs?: unknown[] };
  if (bundle.runs?.length !== 30) throw new Error('The downloaded bundle does not contain 30 recorded responses.');
  report.result = 'recorded';
  report.recordings = artifactPath;
  report.recordedCases = bundle.runs.length;
  console.log(`Saved ${bundle.runs.length} genuine responses to ${artifactPath}`);
  }
} catch (reason) {
  report.result = 'blocked';
  report.reason = reason instanceof Error ? reason.message : String(reason);
  console.error(`Native run blocked: ${report.reason}`);
  process.exitCode = 2;
} finally {
  report.attempts = attempts;
  report.browserErrors = browserErrors;
  if (page && !page.isClosed()) {
    report.recorderState = await page.locator('body').ariaSnapshot().catch(String);
    report.failedGeneration = await page.locator('.ask-recorder-failure').innerText({ timeout: 500 }).catch(() => undefined);
    const screenshot = resolve(output, `${reportName}.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
    report.screenshot = screenshot;
  }
  if (!['recorded', 'answered'].includes(String(report.result))) {
    report.diagnostics = [];
    for (const url of ['chrome://version', 'chrome://on-device-internals']) {
      (report.diagnostics as unknown[]).push(await diagnosticPage(url));
    }
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, `${reportName}.json`), JSON.stringify(report, null, 2) + '\n');
  await context?.close().catch(() => undefined);
}
