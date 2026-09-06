import { chromium, type BrowserContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { displayPreferredName } from '../src/display-name';
import { parseCorpus, parseEvaluationCases, type EvaluationCase } from '../src/features/ask-work/types';
import { prepareContext } from '../src/features/ask-work/answer-context';
import { retrieve } from '../src/features/ask-work/retrieval';
import { systemPrompt } from '../src/features/ask-work/native';
import { portableSampling, portableSystemPrompt } from '../src/features/ask-work/portable-prompt';
import assets from '../src/features/ask-work/model-assets.json';
import type { ChatExchange, LocalEngine, ModelProgress } from '../src/features/ask-work/model-engine';

interface Harness extends Window {
  evaluation: { phase: 'idle' | 'loading' | 'ready' | 'error'; error?: string; engine?: LocalEngine; progress: ModelProgress[]; startedAt?: number; readyAt?: number };
}

const baseUrl = process.env.EVALUATION_URL ?? 'http://127.0.0.1:5173';
const casePath = resolve(process.env.EVALUATION_CASES ?? '.build/evaluation-cases.json');
const output = resolve('.build/model-evaluation');
const profile = resolve('.build/native-chrome');
const caseInput: unknown = JSON.parse(await readFile(casePath, 'utf8'));
const corpus = parseCorpus(JSON.parse(await readFile('public/lab-artifacts/corpus.json', 'utf8')));
const allCases = parseEvaluationCases(caseInput, corpus.hash).map((item) => ({ ...item, question: displayPreferredName(item.question) }));
const failureProbes = process.argv.includes('--failure-probes');
const probeIds = ['case-05', 'case-08', 'case-10', 'case-17', 'case-20', 'case-01', 'case-02', 'case-04'];
const cases = failureProbes ? probeIds.map((id) => { const item = allCases.find((item) => item.id === id); if (!item) throw new Error(`Missing evaluation case ${id}.`); return item; }) : allCases;
const engines = process.argv.includes('--webgpu-only') ? ['webgpu'] as const : process.argv.includes('--native-only') ? ['native'] as const : ['native', 'webgpu'] as const;
const sourcePaths = ['src/features/ask-work/native.ts', 'src/features/ask-work/native-answer.ts', 'src/features/ask-work/answer-context.ts', 'src/features/ask-work/retrieval.ts', 'src/features/ask-work/webgpu.ts', 'src/features/ask-work/webgpu.worker.ts', 'src/features/ask-work/portable-prompt.ts'];
const implementationHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async (path) => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
await mkdir(output, { recursive: true });
let context: BrowserContext | undefined;

try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless: false, ignoreDefaultArgs: true,
    args: ['--remote-debugging-pipe', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-position=-2400,-2400', '--window-size=1280,960', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', 'about:blank'],
    viewport: { width: 1280, height: 900 }, timeout: 30_000,
  });
  const browserVersion = context.browser()?.version();
  for (const kind of engines) {
    const page = await context.newPage();
    const report: Record<string, unknown> = {
      schemaVersion: 1, engine: kind, startedAt: new Date().toISOString(), browserVersion, profile,
      evaluationUrl: baseUrl, browserFeatureOverrides: false, corpusHash: corpus.hash, corpusRelease: corpus.release,
      implementationHashes, systemPrompt: kind === 'webgpu' ? portableSystemPrompt : systemPrompt, model: kind === 'webgpu' ? assets : { family: 'Gemini Nano', revision: null, revisionStatus: 'not-exposed' },
      sampling: kind === 'webgpu' ? portableSampling : 'browser-default', expectedCases: cases.length,
      sourceSupportReview: 'pending-source-review', runs: [], pageErrors: [], navigations: [],
    };
    const reportPath = resolve(output, `${kind}${failureProbes ? '-official-sampler-probes' : ''}.json`);
    const save = () => writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    page.on('pageerror', (error) => { (report.pageErrors as string[]).push(error.message); console.error(`${kind} page error: ${error.message}`); });
    page.on('framenavigated', (frame) => { if (!frame.parentFrame()) (report.navigations as string[]).push(frame.url()); });
    const assetResponses: { url: string; status: number; bytes: string | undefined }[] = [];
    report.assetResponses = assetResponses;
    page.on('response', (response) => {
      if (/huggingface\.co|\.hf\.co|\/\.build\/model-assets\//.test(response.url())) assetResponses.push({ url: response.url().split('?')[0], status: response.status(), bytes: response.headers()['content-length'] });
    });
    try {
      await page.goto(`${baseUrl}/scripts/model-evaluation.html`, { waitUntil: 'networkidle' });
      await page.bringToFront();
      await page.evaluate(async (engineKind) => {
        const global = window as unknown as Harness;
        const modulePath = engineKind === 'native' ? '/src/features/ask-work/native.ts' : '/src/features/ask-work/webgpu.ts';
        const module = await import(modulePath);
        global.evaluation = { phase: 'idle', progress: [] };
        document.querySelector<HTMLButtonElement>('#start')!.onclick = () => {
          global.evaluation.engine?.destroy();
          const controller = new AbortController();
          global.evaluation = { phase: 'loading', progress: [], startedAt: performance.now() };
          // No await separates this real click from native create.
          let pending: Promise<LocalEngine> | null;
          try {
            pending = engineKind === 'native'
              ? module.beginNative(controller.signal, (value: ModelProgress) => global.evaluation.progress.push(value))
              : module.beginWebGPU(controller.signal, (value: ModelProgress) => global.evaluation.progress.push(value));
          } catch (reason) { global.evaluation.phase = 'error'; global.evaluation.error = String(reason); return; }
          if (!pending) { global.evaluation.phase = 'error'; global.evaluation.error = 'Native API is unavailable.'; return; }
          void pending.then((engine) => { global.evaluation.engine = engine; global.evaluation.phase = 'ready'; global.evaluation.readyAt = performance.now(); })
            .catch((reason: unknown) => { global.evaluation.phase = 'error'; global.evaluation.error = String(reason); });
        };
      }, kind);
      const initialCache = await page.evaluate(async (modelUrl) => {
        const keys = await caches.keys();
        let matching = 0;
        for (const key of keys) matching += (await (await caches.open(key)).keys()).filter((request) => request.url.startsWith(modelUrl)).length;
        return { matchingModelRequests: matching, note: 'Cache API entries before Start; native browser model storage is not exposed here.' };
      }, assets.modelUrl);
      report.initialCache = initialCache;
      await page.getByRole('button', { name: 'Start evaluation model', exact: true }).click();
      const deadline = Date.now() + 20 * 60_000;
      let previousProgress = '';
      for (;;) {
        const state = await page.evaluate(() => {
          const state = (window as unknown as Harness).evaluation;
          return { phase: state.phase, error: state.error, progress: state.progress.at(-1), durationMs: state.readyAt && state.startedAt ? state.readyAt - state.startedAt : null };
        });
        const progress = JSON.stringify(state.progress);
        if (progress !== previousProgress) { console.log(`${kind}: ${progress}`); previousProgress = progress; }
        if (state.phase === 'error') throw new Error(state.error);
        if ((report.pageErrors as string[]).length) throw new Error((report.pageErrors as string[]).join('\n'));
        if (state.phase === 'ready') { report.initialLoadMs = state.durationMs; break; }
        if (Date.now() > deadline) throw new Error('Model preparation exceeded 20 minutes.');
        await page.waitForTimeout(2000);
      }
      console.log(`${kind}: model ready; evaluating ${cases.length} cases.`);
      report.loadProgress = await page.evaluate(() => (window as unknown as Harness).evaluation.progress);
      report.assetResponses = assetResponses;
      await save();
      const runCase = async (item: EvaluationCase, history: ChatExchange[] = []) => {
        const query = history.length ? `${history.at(-1)!.question} ${item.question}` : item.question;
        const results = retrieve(query, corpus.chunks);
        const prepared = prepareContext(item.question, results, history);
        const result = await page.evaluate(async ({ question, chunks, previous }) => {
          const start = performance.now();
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 120_000);
          const hardStop = setTimeout(() => (window as unknown as Harness).evaluation.engine!.destroy(), 135_000);
          try {
            const answer = await (window as unknown as Harness).evaluation.engine!.answer(question, chunks, previous, controller.signal);
            return { status: 'answered' as const, ...answer, durationMs: performance.now() - start, recordedAt: new Date().toISOString() };
          } catch (reason) {
            const error = reason as { message?: string; name?: string; rawOutput?: string; prompt?: string };
            return { status: 'failed' as const, error: error.message ?? String(reason), errorName: error.name, rawOutput: error.rawOutput ?? null, prompt: error.prompt ?? null, durationMs: performance.now() - start, recordedAt: new Date().toISOString() };
          } finally { clearTimeout(timer); clearTimeout(hardStop); }
        }, { question: item.question, chunks: results, previous: history });
        const run = {
          ...item, history, retrievedSourceIds: results.map(({ chunk }) => chunk.id), sourcePassages: results.map(({ chunk }) => chunk),
          ...result, prompt: result.prompt ?? prepared.prompt,
          schemaAndCitationValidation: result.status === 'answered',
          refusalExpectationMet: result.status === 'answered' && item.expectRefusal !== undefined ? result.result.refusal === item.expectRefusal : null,
        };
        (report.runs as unknown[]).push(run);
        await save();
        console.log(`${kind}: ${item.id} ${result.status} ${Math.round(result.durationMs)}ms`);
        return result;
      };
      for (const item of cases) await runCase(item);
      if (!failureProbes) {
      const followUpStart = await runCase({ id: 'followup-carre-start', question: 'What did Nick Portokallidis contribute to CARRE?', expectRefusal: false });
      if (followUpStart.status === 'answered') await runCase({ id: 'followup-carre-detail', question: 'Which data system did that work include?', expectRefusal: false }, [{ question: 'What did Nick Portokallidis contribute to CARRE?', answer: followUpStart.result.answer }]);
      await runCase({ id: 'unicode-scope', question: 'Tell me about CARRE. ' + '界'.repeat(450), expectRefusal: false });
      }
      report.status = 'completed';
      report.completedCases = (report.runs as unknown[]).length;
      report.stopThenAsk = await page.evaluate(async (chunks) => {
        const engine = (window as unknown as Harness).evaluation.engine!;
        const controller = new AbortController();
        const started = performance.now();
        const previous = engine.answer('What did Nick contribute to CARRE?', chunks, [], controller.signal)
          .then(() => ({ status: 'answered' }), (reason: unknown) => ({ status: (reason as { name?: string }).name ?? String(reason) }));
        controller.abort();
        const replacement = new AbortController();
        const timer = setTimeout(() => engine.destroy(), 120_000);
        try {
          const next = await engine.answer('Which data systems did CARRE include?', chunks, [], replacement.signal);
          return { previous: await previous, replacement: { status: 'answered', ...next }, durationMs: performance.now() - started };
        } catch (reason) {
          return { previous: await previous, replacement: { status: 'failed', error: String(reason) }, durationMs: performance.now() - started };
        } finally { clearTimeout(timer); }
      }, retrieve('CARRE data systems', corpus.chunks));
      // Recreate after destroy to measure a cache-backed start using the same real API.
      await page.getByRole('button', { name: 'Start evaluation model', exact: true }).click();
      await page.waitForFunction(() => ['ready', 'error'].includes((window as unknown as Harness).evaluation.phase), undefined, { timeout: 120_000 });
      report.cachedLoad = await page.evaluate(() => {
        const state = (window as unknown as Harness).evaluation;
        return { status: state.phase, error: state.error, durationMs: state.readyAt && state.startedAt ? state.readyAt - state.startedAt : null, progress: state.progress };
      });
    } catch (reason) {
      report.status = 'blocked';
      report.error = reason instanceof Error ? reason.message : String(reason);
      process.exitCode = 2;
      console.error(`${kind}: ${report.error}`);
    } finally {
      report.finishedAt = new Date().toISOString();
      await save();
      await page.evaluate(() => (window as unknown as Harness).evaluation?.engine?.destroy()).catch(() => undefined);
      await page.close();
    }
  }
} finally {
  await context?.close();
}
