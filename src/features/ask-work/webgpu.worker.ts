import { MLCEngine, type ChatCompletion } from '@mlc-ai/web-llm';
import { portableSampling, portableSystemPrompt } from './portable-prompt';
import { outputTokenLimit } from './answer-context';
import assets from './model-assets.json';
import type { WorkerRequest, WorkerResponse } from './webgpu-protocol';

const post = (message: WorkerResponse) => globalThis.postMessage(message);
let activeRequest: number | null = null;
let stoppedRequest: number | null = null;
let ready = false;
const engine = new MLCEngine({
  initProgressCallback(report) {
    post({ type: 'progress', progress: {
      phase: report.progress < 1 ? 'downloading' : 'preparing',
      progress: Number.isFinite(report.progress) ? Math.max(0, Math.min(1, report.progress)) : null,
      detail: report.text,
    } });
  },
});

globalThis.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === 'stop') {
    if (activeRequest === data.id) {
      stoppedRequest = data.id;
      void engine.interruptGenerate();
    }
    return;
  }
  if (data.type === 'dispose') { ready = false; await engine.unload(); return; }
  let rawOutput: string | undefined;
  try {
    if (data.type === 'load') {
      engine.setAppConfig({ model_list: [{
        model: assets.modelUrl,
        model_id: assets.modelId,
        model_lib: data.wasmUrl,
        required_features: ['shader-f16'],
        overrides: { context_window_size: assets.contextWindow },
      }] });
      await engine.reload(assets.modelId);
      ready = true;
      post({ type: 'ready', id: data.id });
      return;
    }
    if (!ready) throw new Error('The local model is not ready. Please restart the chat.');
    if (activeRequest !== null) throw new Error('The model is still finishing the previous answer.');
    activeRequest = data.id;
    // Every request starts with fresh evidence; the bounded transcript is explicit in the prompt.
    await engine.resetChat();
    if (stoppedRequest === data.id) throw new DOMException('Operation cancelled.', 'AbortError');
    const response = await engine.chat.completions.create({
      messages: [{ role: 'system', content: portableSystemPrompt }, { role: 'user', content: data.prompt }],
      stream: false,
      max_tokens: outputTokenLimit,
      ...portableSampling,
      extra_body: { enable_thinking: false },
      response_format: { type: 'json_object', schema: JSON.stringify(data.schema) },
    }) as ChatCompletion;
    rawOutput = response.choices[0]?.message.content ?? '';
    if (response.choices[0]?.finish_reason === 'length') throw new Error('The local model reached its answer limit. Please ask a shorter question.');
    post({ type: 'answer', id: data.id, rawOutput, usage: response.usage ? { promptTokens: response.usage.prompt_tokens, completionTokens: response.usage.completion_tokens } : undefined });
  } catch (reason) {
    post({ type: 'error', id: data.id, message: reason instanceof Error ? reason.message : 'The local model failed.', name: reason instanceof Error ? reason.name : 'Error', rawOutput });
  } finally {
    if (activeRequest === data.id) activeRequest = null;
    if (stoppedRequest === data.id) stoppedRequest = null;
  }
};
