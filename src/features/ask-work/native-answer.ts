import { abortError, NativeOutputError, type BrowserSession } from './native';
import { outputTokenLimit, parseModelAnswer, prepareContext } from './answer-context';
import type { ChatExchange, GeneratedAnswer } from './model-engine';
import type { SearchResult } from './retrieval';

export async function answerWithNativeSession(baseSession: BrowserSession, question: string, results: SearchResult[], signal: AbortSignal, history: ChatExchange[], fitQuestion?: boolean): Promise<GeneratedAnswer> {
  if (signal.aborted) throw abortError();
  const session = await baseSession.clone({ signal });
  let disposed = false;
  const dispose = () => { if (!disposed) { disposed = true; session.destroy(); } };
  signal.addEventListener('abort', dispose, { once: true });
  try {
    if (signal.aborted) throw abortError();
    let characters = 7800;
    let context = prepareContext(question, results, history, characters, fitQuestion);
    if (session.measureContextUsage) {
      const available = Math.min(4096, session.contextWindow ?? 4096) - (session.contextUsage ?? 0) - outputTokenLimit;
      while (await session.measureContextUsage(context.prompt, { signal, responseConstraint: context.schema }) > available) {
        characters -= 800;
        if (characters < 1000) throw new Error('This question exceeds the local model context. Please ask a shorter question.');
        context = prepareContext(question, results, history, characters, fitQuestion);
      }
    }
    const rawOutput = await session.prompt(context.prompt, { signal, responseConstraint: context.schema });
    if (signal.aborted) throw abortError();
    try {
      return { result: parseModelAnswer(rawOutput, context.sourceIds), prompt: context.prompt, rawOutput };
    } catch (reason) {
      throw new NativeOutputError(reason instanceof SyntaxError ? 'The model returned an unreadable answer. Please try again.' : reason instanceof Error ? reason.message : 'The model returned invalid evidence.', rawOutput, context.prompt);
    }
  } finally {
    signal.removeEventListener('abort', dispose);
    dispose();
  }
}
