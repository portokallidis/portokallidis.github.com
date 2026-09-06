import { parseCorpus, type Corpus } from './types';

let cached: Corpus | undefined;

/** Load only when a visitor or an agent explicitly asks to inspect portfolio evidence. */
export async function loadPortfolioCorpus(signal: AbortSignal): Promise<Corpus> {
  signal.throwIfAborted();
  if (cached) return cached;
  const response = await fetch('/lab-artifacts/corpus.json', {
    signal,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-cache',
  });
  if (!response.ok) throw new Error(`Could not load portfolio sources (${response.status}).`);
  const corpus = parseCorpus(await response.json());
  signal.throwIfAborted();
  cached = corpus;
  return corpus;
}
