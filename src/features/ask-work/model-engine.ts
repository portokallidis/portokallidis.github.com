import type { SearchResult } from './retrieval';
import type { Answer } from './types';

export { beginNative, isNativeUnavailable } from './native';

export interface ChatExchange {
  question: string;
  answer: string;
}

export interface ModelProgress {
  phase: 'downloading' | 'preparing';
  progress: number | null;
  detail: string;
}

export interface GeneratedAnswer {
  result: Answer;
  prompt: string;
  rawOutput: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface LocalEngine {
  kind: 'native' | 'webgpu';
  answer(question: string, results: SearchResult[], history: ChatExchange[], signal: AbortSignal): Promise<GeneratedAnswer>;
  destroy(): void;
}
