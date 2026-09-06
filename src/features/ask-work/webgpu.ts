import { abortError } from './native';
import { parseModelAnswer, prepareContext } from './answer-context';
import assets from './model-assets.json';
import type { LocalEngine, ModelProgress } from './model-engine';
import type { WorkerRequest, WorkerResponse } from './webgpu-protocol';

interface GPUAdapter {
  features: { has(feature: string): boolean };
  limits: { maxStorageBufferBindingSize: number };
}

export class WebGPUOutputError extends Error {
  constructor(message: string, public rawOutput: string, public prompt: string) {
    super(message);
    this.name = 'WebGPUOutputError';
  }
}

function waitForSettlement(previous: Promise<void>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const cancel = () => { signal.removeEventListener('abort', cancel); reject(abortError()); };
    signal.addEventListener('abort', cancel, { once: true });
    void previous.then(() => { signal.removeEventListener('abort', cancel); resolve(); });
  });
}

export async function beginWebGPU(signal: AbortSignal, onProgress: (progress: ModelProgress) => void): Promise<LocalEngine> {
  if (signal.aborted) throw abortError();
  onProgress({ phase: 'preparing', progress: null, detail: 'Checking this device for local AI.' });
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<GPUAdapter | null> } }).gpu;
  const adapter = await gpu?.requestAdapter();
  if (signal.aborted) throw abortError();
  if (!adapter || !adapter.features.has('shader-f16') || adapter.limits.maxStorageBufferBindingSize < 128 * 1024 * 1024) {
    throw new DOMException('This browser or device cannot run the local chat model. Use a recent browser with WebGPU and shader-f16 support.', 'NotSupportedError');
  }

  const worker = new Worker(new URL('./webgpu.worker.ts', import.meta.url), { type: 'module', name: 'portfolio-local-chat' });
  const send = (message: WorkerRequest) => worker.postMessage(message);
  const requests = new Map<number, { resolve: (value: WorkerResponse) => void; reject: (reason: Error) => void }>();
  let nextId = 0;
  let destroyed = false;
  let answering = false;
  let activeSignal: AbortSignal | null = null;
  let currentSettled: Promise<void> | null = null;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    send({ type: 'dispose' });
    // Termination also cancels the tokenizer fetch, which WebLLM unload does not abort.
    worker.terminate();
    requests.forEach(({ reject }) => reject(abortError()));
    requests.clear();
  };
  const request = (message: WorkerRequest & { id: number }) => new Promise<WorkerResponse>((resolve, reject) => {
    if (destroyed) { reject(abortError()); return; }
    requests.set(message.id, { resolve, reject });
    send(message);
  });
  worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    if (destroyed) return;
    if (data.type === 'progress') { if (!signal.aborted) onProgress(data.progress); return; }
    const pending = requests.get(data.id);
    if (!pending) return;
    requests.delete(data.id);
    if (data.type === 'error') {
      const error = new Error(data.message);
      error.name = data.name;
      if (data.rawOutput !== undefined) Object.assign(error, { rawOutput: data.rawOutput });
      pending.reject(error);
    } else pending.resolve(data);
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || 'The local AI worker could not run. Please restart the chat.');
    requests.forEach(({ reject }) => reject(error));
    requests.clear();
    destroy();
  };
  signal.addEventListener('abort', destroy, { once: true });
  try {
    await request({ type: 'load', id: ++nextId, wasmUrl: new URL(assets.wasm.path, window.location.origin).href });
    if (signal.aborted || destroyed) throw abortError();
  } catch (reason) {
    destroy();
    throw reason;
  } finally {
    signal.removeEventListener('abort', destroy);
  }
  return {
    kind: 'webgpu',
    async answer(question, results, history, requestSignal) {
      if (destroyed || requestSignal.aborted) throw abortError();
      while (answering) {
        if (!activeSignal?.aborted) throw new Error('Wait for the current answer to finish.');
        await waitForSettlement(currentSettled!, requestSignal);
        if (destroyed || requestSignal.aborted) throw abortError();
      }
      let characters = 7800;
      let context = prepareContext(question, results, history, characters);
      let id = ++nextId;
      const stop = () => send({ type: 'stop', id });
      requestSignal.addEventListener('abort', stop, { once: true });
      answering = true;
      activeSignal = requestSignal;
      let markSettled!: () => void;
      currentSettled = new Promise((resolve) => { markSettled = resolve; });
      try {
        let response: WorkerResponse;
        for (;;) {
          try {
            response = await request({ type: 'answer', id, prompt: context.prompt, schema: context.schema });
            break;
          } catch (reason) {
            if (requestSignal.aborted || destroyed) throw abortError();
            if (reason instanceof Error && reason.name === 'ContextWindowSizeExceededError' && characters > 1600) {
              characters = Math.max(1600, Math.floor(characters * 0.6));
              context = prepareContext(question, results, history, characters);
              id = ++nextId;
              continue;
            }
            if (reason instanceof Error && 'rawOutput' in reason && typeof reason.rawOutput === 'string') {
              throw new WebGPUOutputError(reason.message, reason.rawOutput, context.prompt);
            }
            throw reason;
          }
        }
        if (requestSignal.aborted || destroyed) throw abortError();
        if (response.type !== 'answer') throw new Error('The local model did not return an answer.');
        let result;
        try { result = parseModelAnswer(response.rawOutput, context.sourceIds, true); }
        catch { throw new WebGPUOutputError('The model could not produce an answer with valid supporting sources. Please try a more specific question.', response.rawOutput, context.prompt); }
        return { result, prompt: context.prompt, rawOutput: response.rawOutput, usage: response.usage };
      } finally {
        requestSignal.removeEventListener('abort', stop);
        answering = false;
        activeSignal = null;
        currentSettled = null;
        markSettled();
      }
    },
    destroy,
  };
}
