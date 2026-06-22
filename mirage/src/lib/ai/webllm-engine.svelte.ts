/**
 * WebLLM engine — wrapper around @mlc-ai/web-llm that loads a model
 * into WebGPU and provides a typed generate() with AbortSignal support.
 *
 * Why this exists: WebLLM's API is promise-based but doesn't expose
 * a clean way to know which model is currently loading when calls
 * overlap. The `loadingFor` field tracks that.
 */

import { browser } from '$app/environment';

import { privacyStore } from '$lib/privacy/store.svelte';

export type GenerateOptions = {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  onToken?: (token: string) => void;
};

type LoadedWebLLMEngine = unknown;
type WebLLMMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type WebLLMGenerateProgress = { progress: number; text: string };

const DEFAULT_MODEL = 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC';

export class WebLLMEngine {
  #engine: LoadedWebLLMEngine | null = null;
  #modelId: string | null = null;
  #loadPromise: Promise<void> | null = null;
  loadingFor = $state<string | null>(null);
  progress = $state(0);
  statusText = $state('');

  isReady() {
    return this.#engine !== null;
  }

  currentModel() {
    return this.#modelId;
  }

  async load(modelId: string = DEFAULT_MODEL) {
    if (!browser) return;
    if (this.#engine && this.#modelId === modelId) return;
    if (this.#loadPromise && this.loadingFor === modelId) return this.#loadPromise;

    // If another model is loading, wait for it to finish first.
    if (this.#loadPromise && this.loadingFor !== modelId) {
      await this.#loadPromise.catch(() => {});
    }
    // Re-check after awaiting.
    if (this.#engine && this.#modelId === modelId) return;

    this.loadingFor = modelId;
    this.progress = 0;
    this.statusText = `Loading ${modelId}…`;
    privacyStore.setModelStatus({ llm: 'loading', loadingFor: modelId, message: this.statusText });

    this.#loadPromise = (async () => {
      try {
        const webllm = await import('@mlc-ai/web-llm');
        const engine = await webllm.CreateMLCEngine(modelId, {
          initProgressCallback: (report: WebLLMGenerateProgress) => {
            this.progress = Math.min(1, Math.max(0, report.progress));
            this.statusText = report.text;
          }
        });
        this.#engine = engine;
        this.#modelId = modelId;
        this.statusText = `${modelId} ready`;
        privacyStore.setModelStatus({ llm: 'ready', loadingFor: null, message: this.statusText });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.statusText = `Failed to load ${modelId}: ${message}`;
        privacyStore.setModelStatus({ llm: 'error', loadingFor: null, message: this.statusText });
        throw err;
      } finally {
        this.#loadPromise = null;
        this.loadingFor = null;
      }
    })();

    return this.#loadPromise;
  }

  async generate(messages: WebLLMMessage[], options: GenerateOptions = {}) {
    if (!this.#engine) throw new Error('Engine not loaded — call load() first');
    const webllm = await import('@mlc-ai/web-llm');
    const stream = await (this.#engine as { streamChat: (m: WebLLMMessage[], opts: unknown) => Promise<AsyncIterable<{ choices: Array<{ delta: { content: string } }> }>> }).streamChat(messages, {
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 512,
      signal: options.signal
    });
    let full = '';
    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        options.onToken?.(delta);
      }
    }
    // Touch the imported module so it isn't shaken out by tree-shaking.
    void webllm;
    return full;
  }

  async reset() {
    this.#engine = null;
    this.#modelId = null;
    this.progress = 0;
    this.statusText = '';
    privacyStore.setModelStatus({ llm: 'idle', loadingFor: null, message: 'Models load only after an explicit local action.' });
  }
}

export const webllm = new WebLLMEngine();