import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginNative, isNativeUnavailable, type BrowserSession } from '../src/features/ask-work/native';
import { emptyThinkingPrefix, parseModelAnswer, prepareContext } from '../src/features/ask-work/answer-context';
import { beginWebGPU } from '../src/features/ask-work/webgpu';
import type { SearchResult } from '../src/features/ask-work/retrieval';
import type { WorkerRequest, WorkerResponse } from '../src/features/ask-work/webgpu-protocol';

const sources: SearchResult[] = Array.from({ length: 7 }, (_, index) => ({
  score: 7 - index,
  chunk: { id: `source-${index}`, title: 'CARRE', section: 'Work', text: 'Ontology engineering and linked data. '.repeat(70), url: '/work/carre', hash: 'hash' },
}));
const answer = { answer: 'The work covered ontology engineering.', citations: ['source-0'], refusal: false };

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); TestWorker.instances = []; });

describe('bounded local evidence', () => {
  it('keeps at most three recent exchanges and five sources without mutating the corpus', () => {
    const history = Array.from({ length: 6 }, (_, index) => ({ question: `question-${index}`, answer: `answer-${index}` }));
    const result = prepareContext('What did that involve?', sources, history);
    expect(result.sourceIds).toHaveLength(5);
    expect(result.prompt).not.toContain('question-2');
    expect(result.prompt).toContain('question-3');
    expect(result.prompt).toContain('question-5');
    expect(result.prompt.length).toBeLessThanOrEqual(7800);
    expect(sources[0].chunk.text.length).toBeGreaterThan(1200);
    expect(() => prepareContext('x'.repeat(501), sources, [])).toThrow('500 characters');
  });

  it('accepts only the known empty Qwen prefix and rejects forged citations or extra fields', () => {
    expect(parseModelAnswer(emptyThinkingPrefix + JSON.stringify(answer), ['source-0'], true)).toEqual(answer);
    expect(() => parseModelAnswer('<think>secret</think>' + JSON.stringify(answer), ['source-0'], true)).toThrow();
    expect(() => parseModelAnswer(JSON.stringify(answer), ['different-source'])).toThrow('supporting sources');
    expect(() => parseModelAnswer(JSON.stringify({ ...answer, url: 'https://example.com' }), ['source-0'])).toThrow('unexpected answer format');
    expect(() => parseModelAnswer(JSON.stringify({ ...answer, refusal: true }), ['source-0'])).toThrow('supporting sources');
  });
});

describe('native startup and session isolation', () => {
  it('calls create in the Start stack and measures the bounded prompt before generation', async () => {
    const child = {
      clone: vi.fn(), destroy: vi.fn(), prompt: vi.fn().mockResolvedValue(JSON.stringify(answer)),
      contextWindow: 2500, contextUsage: 300,
      measureContextUsage: vi.fn(async (prompt: string) => prompt.length / 2),
    } satisfies BrowserSession;
    const base = { clone: vi.fn().mockResolvedValue(child), destroy: vi.fn(), prompt: vi.fn() } satisfies BrowserSession;
    const create = vi.fn().mockResolvedValue(base);
    vi.stubGlobal('LanguageModel', { create, availability: vi.fn() });
    const pending = beginNative(new AbortController().signal, vi.fn());
    expect(create).toHaveBeenCalledOnce();
    const engine = await pending;
    const result = await engine!.answer('CARRE responsibilities', sources, [], new AbortController().signal);
    expect(result.result).toEqual(answer);
    expect(child.measureContextUsage.mock.calls.length).toBeGreaterThan(1);
    expect(child.prompt.mock.calls[0][0].length / 2).toBeLessThanOrEqual(2500 - 300 - 512);
    expect(child.destroy).toHaveBeenCalledOnce();
    engine!.destroy();
    engine!.destroy();
    expect(base.destroy).toHaveBeenCalledOnce();
  });

  it('destroys a late startup and does not treat cancellation or security failures as unavailable', async () => {
    let resolve!: (session: BrowserSession) => void;
    const session = { clone: vi.fn(), prompt: vi.fn(), destroy: vi.fn() } satisfies BrowserSession;
    vi.stubGlobal('LanguageModel', { availability: vi.fn(), create: () => new Promise<BrowserSession>((done) => { resolve = done; }) });
    const controller = new AbortController();
    const pending = beginNative(controller.signal, vi.fn());
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    resolve(session);
    await rejected;
    expect(session.destroy).toHaveBeenCalledOnce();
    expect(isNativeUnavailable(new DOMException('missing', 'NotSupportedError'))).toBe(true);
    expect(isNativeUnavailable(new DOMException('cancelled', 'AbortError'))).toBe(false);
    expect(isNativeUnavailable(new DOMException('denied', 'NotAllowedError'))).toBe(false);
  });
});

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn<(message: WorkerRequest) => void>();
  terminate = vi.fn();
  constructor() { TestWorker.instances.push(this); }
  reply(data: WorkerResponse) { this.onmessage?.(new MessageEvent('message', { data })); }
}

function portableDevice(supported = true) {
  vi.stubGlobal('Worker', TestWorker);
  vi.stubGlobal('navigator', { gpu: { requestAdapter: vi.fn().mockResolvedValue({ features: new Set(supported ? ['shader-f16'] : []), limits: { maxStorageBufferBindingSize: 134217728 } }) } });
}

async function readyWebGPU() {
  portableDevice();
  const pending = beginWebGPU(new AbortController().signal, vi.fn());
  await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(1));
  const worker = TestWorker.instances[0];
  const load = worker.postMessage.mock.calls[0][0];
  expect(load.type).toBe('load');
  worker.reply({ type: 'ready', id: 'id' in load ? load.id : 0 });
  return { engine: await pending, worker };
}

describe('portable engine lifecycle', () => {
  it('rejects unsupported devices before creating a worker or fetching model assets', async () => {
    portableDevice(false);
    await expect(beginWebGPU(new AbortController().signal, vi.fn())).rejects.toMatchObject({ name: 'NotSupportedError' });
    expect(TestWorker.instances).toHaveLength(0);
  });

  it('terminates loading immediately, rejects its promise and ignores late progress', async () => {
    portableDevice();
    const controller = new AbortController();
    const progress = vi.fn();
    const pending = beginWebGPU(controller.signal, progress);
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(1));
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    const worker = TestWorker.instances[0];
    expect(worker.terminate).toHaveBeenCalledOnce();
    const count = progress.mock.calls.length;
    worker.reply({ type: 'progress', progress: { phase: 'downloading', progress: 1, detail: 'late' } });
    expect(progress).toHaveBeenCalledTimes(count);
  });

  it('stops the current answer, discards its late output and reuses the loaded model', async () => {
    const { engine, worker } = await readyWebGPU();
    const controller = new AbortController();
    const pending = engine.answer('CARRE', sources, [], controller.signal);
    const request = worker.postMessage.mock.calls.at(-1)![0];
    if (request.type !== 'answer') throw new Error('Expected answer request.');
    controller.abort();
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'stop', id: request.id });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    worker.reply({ type: 'answer', id: request.id, rawOutput: JSON.stringify(answer) });
    await rejected;
    expect(worker.terminate).not.toHaveBeenCalled();
    const next = engine.answer('CARRE role', sources, [], new AbortController().signal);
    const nextRequest = worker.postMessage.mock.calls.at(-1)![0];
    if (nextRequest.type !== 'answer') throw new Error('Expected another answer request.');
    worker.reply({ type: 'answer', id: nextRequest.id, rawOutput: emptyThinkingPrefix + JSON.stringify(answer) });
    expect((await next).result).toEqual(answer);
    engine.destroy();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('reduces context after an actual runtime token-limit error and validates the retried evidence', async () => {
    const { engine, worker } = await readyWebGPU();
    const pending = engine.answer('CARRE', sources, [], new AbortController().signal);
    const first = worker.postMessage.mock.calls.at(-1)![0];
    if (first.type !== 'answer') throw new Error('Expected answer request.');
    worker.reply({ type: 'error', id: first.id, name: 'ContextWindowSizeExceededError', message: 'Too many prompt tokens.' });
    await vi.waitFor(() => expect(worker.postMessage.mock.calls.at(-1)![0]).not.toBe(first));
    const retry = worker.postMessage.mock.calls.at(-1)![0];
    if (retry.type !== 'answer') throw new Error('Expected bounded retry.');
    expect(retry.prompt.length).toBeLessThan(first.prompt.length);
    worker.reply({ type: 'answer', id: retry.id, rawOutput: JSON.stringify(answer), usage: { promptTokens: 1200, completionTokens: 30 } });
    const generated = await pending;
    expect(generated.prompt).toBe(retry.prompt);
    expect(generated.usage?.promptTokens).toBe(1200);
    engine.destroy();
  });

  it('queues a new question after Stop until the interrupted request has settled', async () => {
    const { engine, worker } = await readyWebGPU();
    const controller = new AbortController();
    const previous = engine.answer('CARRE', sources, [], controller.signal);
    const firstRequest = worker.postMessage.mock.calls.at(-1)![0];
    if (firstRequest.type !== 'answer') throw new Error('Expected first answer request.');
    const stopped = expect(previous).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    const next = engine.answer('Which CARRE system?', sources, [], new AbortController().signal);
    const completed = next.then((value) => ({ value }), (reason: unknown) => ({ reason }));
    await Promise.resolve();
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'stop', id: firstRequest.id });
    worker.reply({ type: 'answer', id: firstRequest.id, rawOutput: JSON.stringify(answer) });
    await stopped;
    await vi.waitFor(() => expect(worker.postMessage.mock.calls.at(-1)![0].type).toBe('answer'));
    const nextRequest = worker.postMessage.mock.calls.at(-1)![0];
    if (nextRequest.type !== 'answer') throw new Error('Expected queued answer request.');
    expect(nextRequest.id).not.toBe(firstRequest.id);
    worker.reply({ type: 'answer', id: nextRequest.id, rawOutput: JSON.stringify(answer) });
    expect(await completed).toMatchObject({ value: { result: answer } });
    engine.destroy();
  });

  it('retains genuine failed output for private evaluation instead of accepting truncated JSON', async () => {
    const { engine, worker } = await readyWebGPU();
    const pending = engine.answer('CARRE', sources, [], new AbortController().signal);
    const request = worker.postMessage.mock.calls.at(-1)![0];
    if (request.type !== 'answer') throw new Error('Expected answer request.');
    const rawOutput = '{"answer":"unfinished';
    const rejected = expect(pending).rejects.toMatchObject({ name: 'WebGPUOutputError', rawOutput, prompt: request.prompt });
    worker.reply({ type: 'error', id: request.id, name: 'Error', message: 'The model reached its answer limit.', rawOutput });
    await rejected;
    engine.destroy();
  });

  it('lets a queued replacement question be cancelled without sending it to the worker', async () => {
    const { engine, worker } = await readyWebGPU();
    const first = new AbortController();
    const previous = engine.answer('CARRE', sources, [], first.signal);
    const previousStopped = expect(previous).rejects.toMatchObject({ name: 'AbortError' });
    const request = worker.postMessage.mock.calls.at(-1)![0];
    if (request.type !== 'answer') throw new Error('Expected answer request.');
    first.abort();
    const replacement = new AbortController();
    const next = engine.answer('CARRE detail', sources, [], replacement.signal);
    const nextStopped = expect(next).rejects.toMatchObject({ name: 'AbortError' });
    replacement.abort();
    await nextStopped;
    worker.reply({ type: 'answer', id: request.id, rawOutput: JSON.stringify(answer) });
    await previousStopped;
    expect(worker.postMessage.mock.calls.filter(([message]) => message.type === 'answer')).toHaveLength(1);
    engine.destroy();
  });
});
