import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCorpus, parseEvaluationCases, parseFailedRun, parseRun, type RecordedRun } from '../src/features/ask-work/types';

const input = process.argv[2];
if (!input) throw new Error('Usage: npm run review:runs -- <recording-bundle.json> [review.json]. Omit review.json to inspect only.');
const corpus = parseCorpus(JSON.parse(await readFile('public/lab-artifacts/corpus.json', 'utf8')));
const cases = parseEvaluationCases(JSON.parse(await readFile('.build/evaluation-cases.json', 'utf8')), corpus.hash);
for (const item of cases) for (const id of item.expectedSourceIds ?? []) assert(corpus.chunks.some(chunk => chunk.id === id), `Unknown expected source: ${id}`);
const bundle = JSON.parse(await readFile(resolve(input), 'utf8')) as { schemaVersion: number; corpusHash: string; runs: unknown[] };
assert.equal(bundle.schemaVersion, 1);
assert.equal(bundle.corpusHash, corpus.hash);
assert(Array.isArray(bundle.runs) && bundle.runs.length === cases.length, 'A complete 30-case actual attempt bundle is required.');
const runs = cases.map(item => {
  const raw = bundle.runs.find(run => (run as { id?: string }).id === item.id);
  const run = (raw as { status?: string })?.status === 'failed' ? parseFailedRun(raw, corpus, item.id) : parseRun(raw, corpus, item.id);
  assert.equal(run.question, item.question, 'Question differs from the evaluation case.');
  assert(run.systemPrompt, 'Missing exact system prompt.');
  return run;
});
assert.equal(new Set(runs.map(run => run.id)).size, cases.length);
const report = runs.map((run, index) => ({ ...run, status: run.status ?? 'answered', category: (cases[index] as { category?: string }).category ?? 'uncategorized', citationReferenceValid: run.status !== 'failed', expectedRefusal: cases[index].expectRefusal ?? false, actualRefusal: run.status === 'failed' ? null : run.refusal, sources: run.contextIds.map(id => corpus.chunks.find(chunk => chunk.id === id)), supportReview: 'pending', notes: '' }));
if (!process.argv[3]) { console.log(JSON.stringify({ corpusHash: corpus.hash, cases: report }, null, 2)); process.exit(0); }
const review = JSON.parse(await readFile(resolve(process.argv[3]), 'utf8')) as { corpusHash: string; reviewer: string; method: string; reviewedAt: string; cases: { id: string; supportReview: string; notes: string }[] };
assert.equal(review.corpusHash, corpus.hash);
assert(review.reviewer?.trim() && Number.isFinite(Date.parse(review.reviewedAt)), 'Review needs reviewer and date.');
assert(['automated-source-review', 'human'].includes(review.method), 'Review must identify its method honestly.');
assert.equal(review.cases.length, cases.length);
assert.equal(new Set(review.cases.map(item => item.id)).size, cases.length);
for (const run of runs) {
  const item = review.cases.find(item => item.id === run.id);
  const allowed = run.status === 'failed' ? ['generation-failed'] : run.refusal ? ['appropriate-refusal', 'unnecessary-refusal'] : ['supported', 'unsupported'];
  assert(item && allowed.includes(item.supportReview) && item.notes?.trim(), `Missing claim-support review: ${run.id}`);
}
const answered = runs.filter((run): run is RecordedRun => run.status !== 'failed');
assert(answered.length, 'No valid model output exists to publish as recorded examples. Preserve failed attempts as development diagnostics.');
const evaluation = { schemaVersion: 1, ...review, structuralCitationValidity: { passed: answered.length, total: runs.length }, refusalAgreement: { passed: runs.filter((run, index) => run.status !== 'failed' && run.refusal === Boolean(cases[index].expectRefusal)).length, total: runs.length }, sourceSupport: { passed: review.cases.filter(item => ['supported', 'appropriate-refusal'].includes(item.supportReview)).length, total: runs.length }, results: report.map(item => ({ ...item, ...review.cases.find(check => check.id === item.id) })) };
await mkdir('.build', { recursive: true });
await writeFile('.build/reviewed-native.json', JSON.stringify(evaluation, null, 2) + '\n');
console.log('Saved the actual run and its source review to .build/reviewed-native.json. No recordings are published.');
