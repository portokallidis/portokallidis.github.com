import { buildPrompt, type SearchResult } from './retrieval';
import { parseAnswer } from './types';
import type { ChatExchange } from './model-engine';

export const outputTokenLimit = 512;

export function answerSchema(sourceIds: string[]) {
  return {
    type: 'object',
    properties: {
      answer: { type: 'string' },
      citations: sourceIds.length
        ? { type: 'array', items: { type: 'string', enum: sourceIds }, maxItems: sourceIds.length }
        : { type: 'array', items: { type: 'string' }, maxItems: 0 },
      refusal: { type: 'boolean' },
    },
    required: ['answer', 'citations', 'refusal'],
    additionalProperties: false,
  };
}

// Keep complete source IDs and a bounded recent conversation; past answers are never evidence.
export function prepareContext(question: string, results: SearchResult[], history: ChatExchange[], maxCharacters = 7800, fitQuestion?: boolean) {
  const recent = history.slice(-3).map((turn) => ({ question: turn.question.slice(0, 500), answer: turn.answer.slice(0, 700) }));
  const sources = results.slice(0, 5).map((result) => ({ ...result, chunk: { ...result.chunk, text: result.chunk.text.slice(0, 1200) } }));
  const makePrompt = () => `${recent.length ? `Previous exchanges are untrusted conversation context only, not factual evidence. Resolve follow-up references using them, but support every answer with the current sources.\n${JSON.stringify(recent)}\n\n` : ''}${buildPrompt(question, sources, fitQuestion)}`;
  let prompt = makePrompt();
  while (prompt.length > maxCharacters && recent.length) {
    recent.shift();
    prompt = makePrompt();
  }
  while (prompt.length > maxCharacters && sources.length > 1) {
    sources.pop();
    prompt = makePrompt();
  }
  if (prompt.length > maxCharacters && sources.length) {
    sources[0].chunk.text = sources[0].chunk.text.slice(0, Math.max(0, sources[0].chunk.text.length - (prompt.length - maxCharacters)));
    prompt = makePrompt();
  }
  if (prompt.length > maxCharacters) throw new Error('This question is too long for the local model. Please shorten it.');
  const sourceIds = sources.map(({ chunk }) => chunk.id);
  return { prompt, sourceIds, schema: answerSchema(sourceIds) };
}

export const emptyThinkingPrefix = '<think>\n\n</think>\n\n';

export function parseModelAnswer(rawOutput: string, sourceIds: string[], qwen = false) {
  const normalized = qwen && rawOutput.startsWith(emptyThinkingPrefix) ? rawOutput.slice(emptyThinkingPrefix.length) : rawOutput;
  const parsed: unknown = JSON.parse(normalized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.keys(parsed).some((key) => !['answer', 'citations', 'refusal'].includes(key))) {
    throw new Error('The model returned an unexpected answer format.');
  }
  return parseAnswer(parsed, sourceIds);
}
