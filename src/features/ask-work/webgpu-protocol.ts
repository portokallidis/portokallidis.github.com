import type { ModelProgress } from './model-engine';

export type WorkerRequest =
  | { type: 'load'; id: number; wasmUrl: string }
  | { type: 'answer'; id: number; prompt: string; schema: object }
  | { type: 'stop'; id: number }
  | { type: 'dispose' };

export type WorkerResponse =
  | { type: 'progress'; progress: ModelProgress }
  | { type: 'ready'; id: number }
  | { type: 'answer'; id: number; rawOutput: string; usage?: { promptTokens: number; completionTokens: number } }
  | { type: 'error'; id: number; message: string; name: string; rawOutput?: string };
