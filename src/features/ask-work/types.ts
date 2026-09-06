export interface CorpusChunk {
  id: string;
  title: string;
  url: string;
  section: string;
  text: string;
  hash: string;
}

export interface Corpus {
  schemaVersion: 1;
  release: string;
  hash: string;
  chunks: CorpusChunk[];
}

export interface Answer {
  answer: string;
  citations: string[];
  refusal: boolean;
}

export interface RecordedRun extends Answer {
  status?: 'answered';
  schemaVersion: 1;
  id: string;
  question: string;
  contextIds: string[];
  corpusHash: string;
  corpusRelease: string;
  prompt: string;
  systemPrompt?: string;
  rawOutput: string;
  recordedAt: string;
  durationMs: number;
  provenance: {
    api: 'Chrome Prompt API';
    browserVersion: string;
    modelFamily: 'Gemini Nano';
    modelRevision: null;
    modelRevisionStatus: 'not-exposed';
  };
}

export interface FailedRun extends Omit<RecordedRun, keyof Answer | 'rawOutput' | 'status'> {
  status: 'failed';
  rawOutput: string | null;
  error: string;
}

export type RecordedAttempt = RecordedRun | FailedRun;

export interface RunManifest {
  schemaVersion: 1;
  release: string;
  corpusHash: string;
  runs: { id: string; question: string; path: string; recordedAt: string }[];
}

export interface EvaluationCase {
  id: string;
  question: string;
  expectedSourceIds?: string[];
  expectRefusal?: boolean;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const unique = (values: string[]) => new Set(values).size === values.length;
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));

export function safeSourceUrl(value: unknown): value is string {
  if (!text(value) || [...value].some((character) => character.charCodeAt(0) <= 32 || character === '\\')) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (value.startsWith('#')) return value.length > 1;
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function parseCorpus(value: unknown): Corpus {
  if (!object(value) || value.schemaVersion !== 1 || !text(value.release) || !text(value.hash)
    || !Array.isArray(value.chunks) || value.chunks.length === 0 || value.chunks.length > 5000
    || !value.chunks.every((chunk: unknown) => object(chunk)
      && ['id', 'title', 'section', 'text', 'hash'].every((key) => text(chunk[key]))
      && safeSourceUrl(chunk.url))) throw new Error('The portfolio sources could not be read.');
  const corpus = value as unknown as Corpus;
  if (!unique(corpus.chunks.map((chunk) => chunk.id))) throw new Error('Duplicate portfolio source IDs.');
  return corpus;
}

export function parseManifest(value: unknown, corpus: Corpus): RunManifest {
  if (!object(value) || value.schemaVersion !== 1 || value.release !== corpus.release
    || value.corpusHash !== corpus.hash || !Array.isArray(value.runs)
    || !value.runs.every((run: unknown) => object(run) && text(run.id) && text(run.question)
      && text(run.path) && /^\/lab-artifacts\/runs\/[a-zA-Z0-9_-]+\.json$/.test(run.path)
      && date(run.recordedAt))) throw new Error('Recorded examples do not match this portfolio release.');
  const manifest = value as unknown as RunManifest;
  if (!unique(manifest.runs.map((run) => run.id))) throw new Error('Duplicate recorded example IDs.');
  return manifest;
}

export function parseAnswer(value: unknown, contextIds: string[]): Answer {
  if (!object(value) || !text(value.answer) || value.answer.length > 12_000 || !strings(value.citations)
    || !unique(value.citations) || typeof value.refusal !== 'boolean'
    || value.citations.some((id) => !contextIds.includes(id))
    || (!value.refusal && value.citations.length === 0)
    || (value.refusal && value.citations.length > 0)) {
    throw new Error('The model returned an answer without valid supporting sources. Use the search results below.');
  }
  return { answer: value.answer, citations: value.citations, refusal: value.refusal };
}

export function parseRun(value: unknown, corpus: Corpus, expectedId: string): RecordedRun {
  if (!object(value) || value.schemaVersion !== 1 || value.id !== expectedId || !text(value.question)
    || (value.status !== undefined && value.status !== 'answered')
    || value.corpusHash !== corpus.hash || value.corpusRelease !== corpus.release
    || !strings(value.contextIds) || !unique(value.contextIds) || value.contextIds.length > 5
    || value.contextIds.some((id) => !corpus.chunks.some((chunk) => chunk.id === id))
    || !text(value.prompt) || !text(value.rawOutput) || !date(value.recordedAt)
    || typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs) || value.durationMs < 0
    || !object(value.provenance) || value.provenance.api !== 'Chrome Prompt API'
    || !text(value.provenance.browserVersion) || value.provenance.modelFamily !== 'Gemini Nano'
    || value.provenance.modelRevision !== null || value.provenance.modelRevisionStatus !== 'not-exposed') {
    throw new Error('This recorded example could not be verified against the current sources.');
  }
  const answer = parseAnswer(value, value.contextIds);
  let raw: Answer;
  try {
    raw = parseAnswer(JSON.parse(value.rawOutput), value.contextIds);
  } catch {
    throw new Error('This recorded example contains an invalid model response.');
  }
  if (JSON.stringify(raw) !== JSON.stringify(answer)) throw new Error('The recorded answer differs from its raw response.');
  return value as unknown as RecordedRun;
}

export function parseFailedRun(value: unknown, corpus: Corpus, expectedId: string): FailedRun {
  if (!object(value) || value.schemaVersion !== 1 || value.status !== 'failed'
    || value.id !== expectedId || !text(value.question) || !text(value.error)
    || value.corpusHash !== corpus.hash || value.corpusRelease !== corpus.release
    || !strings(value.contextIds) || !unique(value.contextIds) || value.contextIds.length > 5
    || value.contextIds.some((id) => !corpus.chunks.some((chunk) => chunk.id === id))
    || !text(value.prompt) || !text(value.systemPrompt)
    || (value.rawOutput !== null && typeof value.rawOutput !== 'string')
    || ['answer', 'citations', 'refusal'].some((key) => key in value)
    || !date(value.recordedAt) || typeof value.durationMs !== 'number'
    || !Number.isFinite(value.durationMs) || value.durationMs < 0
    || !object(value.provenance) || value.provenance.api !== 'Chrome Prompt API'
    || !text(value.provenance.browserVersion) || value.provenance.modelFamily !== 'Gemini Nano'
    || value.provenance.modelRevision !== null || value.provenance.modelRevisionStatus !== 'not-exposed') {
    throw new Error('This failed attempt could not be verified against the current sources.');
  }
  return value as unknown as FailedRun;
}

export function parseEvaluationCases(value: unknown, corpusHash?: string): EvaluationCase[] {
  if (corpusHash && object(value) && value.corpusHash !== undefined && value.corpusHash !== corpusHash) {
    throw new Error('Evaluation cases do not match this corpus release.');
  }
  const cases = object(value) && value.schemaVersion === 1 ? value.cases : value;
  if (!Array.isArray(cases) || cases.length === 0 || !cases.every((item: unknown) => object(item)
    && text(item.id) && /^[a-zA-Z0-9_-]+$/.test(item.id) && text(item.question) && item.question.length <= 500
    && (item.expectedSourceIds === undefined || strings(item.expectedSourceIds))
    && (item.expectRefusal === undefined || typeof item.expectRefusal === 'boolean'))) {
    throw new Error('The evaluation cases are invalid.');
  }
  const result = cases as EvaluationCase[];
  if (!unique(result.map((item) => item.id))) throw new Error('Duplicate evaluation case IDs.');
  return result;
}

export async function fetchArtifact(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`Could not load portfolio data (${response.status}).`);
  return response.json() as Promise<unknown>;
}
