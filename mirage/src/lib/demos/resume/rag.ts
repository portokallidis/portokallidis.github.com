/**
 * Resume Q&A — extractive RAG over the CV. No LLM needed.
 *
 * Algorithm:
 *  1. Tokenize the question and each CV chunk
 *  2. Score each chunk by token overlap (Jaccard-like)
 *  3. Return the top-K chunks as the answer context
 *
 * Cheap, deterministic, runs on every page load. The WebLLM path is the
 * "richer" mode — this is the always-on fallback.
 */

import { cv, cvToChunks } from '$lib/content/cv';

export type RetrievedChunk = {
  section: string;
  text: string;
  score: number;
};

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'have', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'you', 'your', 'i', 'me', 'my',
  'do', 'does', 'did', 'can', 'could', 'should', 'would', 'what',
  'where', 'when', 'who', 'how', 'why', 'which', 'this', 'that',
  'these', 'those', 'about', 'tell', 'give', 'show', 'list'
]);

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\u0370-\u03ff\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

export function retrieve(question: string, k = 3): RetrievedChunk[] {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return [];
  const chunks = cvToChunks();
  const scored: RetrievedChunk[] = chunks.map((c) => {
    const cTokens = new Set(tokenize(c.text));
    const score = jaccard(qTokens, cTokens);
    // Bonus: exact phrase match
    const phraseBonus = c.text.toLowerCase().includes(question.toLowerCase().trim()) ? 0.2 : 0;
    return { section: c.section, text: c.text, score: score + phraseBonus };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).filter((c) => c.score > 0);
}

export function answerFromContext(question: string, k = 3): string {
  const chunks = retrieve(question, k);
  if (chunks.length === 0) {
    return `I couldn't find anything in ${cv.name}\u2019s CV matching that question. Try rephrasing, or browse the full CV at ${cv.cvUrl}.`;
  }
  const header = `Based on ${cv.name}\u2019s CV:\n\n`;
  const body = chunks
    .map((c, i) => `${i + 1}. [${c.section}] ${c.text}`)
    .join('\n\n');
  return header + body;
}