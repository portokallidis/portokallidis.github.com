import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPortfolioTools } from '../src/webmcp';

const state = vi.hoisted(() => ({ imports: 0, load: vi.fn(), retrieve: vi.fn() }));
vi.mock('../src/features/ask-work/corpus', () => {
  state.imports++;
  return { loadPortfolioCorpus: state.load };
});
vi.mock('../src/features/ask-work/retrieval', () => {
  state.imports++;
  return { retrieve: state.retrieve };
});

const source = { id: 'carre-implementation', title: 'CARRE', url: '/work/carre#implementation', section: 'Implementation', text: 'Approved ontology engineering work.', hash: 'source-hash' };
const corpus = { schemaVersion: 1, release: 'test-release', hash: 'corpus-hash', chunks: [source] };
type Tool = { name: string; annotations: object; inputSchema: object; execute(args: unknown, options?: { signal?: AbortSignal }): Promise<string> };

function nativeDocument(reject = false) {
  const definitions: Tool[] = [];
  const signals: AbortSignal[] = [];
  const registerTool = vi.fn((tool: Tool, { signal }: { signal: AbortSignal }) => {
    definitions.push(tool);
    signals.push(signal);
    return reject ? Promise.reject(new Error('Permission denied.')) : Promise.resolve();
  });
  const target = { modelContext: { registerTool } } as unknown as Document;
  return { target, definitions, signals, registerTool };
}

beforeEach(() => {
  vi.resetModules();
  state.imports = 0;
  state.load.mockReset().mockResolvedValue(corpus);
  state.retrieve.mockReset().mockReturnValue([{ chunk: source, score: 1 }]);
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('site-wide read-only WebMCP', () => {
  it('registers without importing data/retrieval, fetching, or changing origin exposure', () => {
    const native = nativeDocument();
    const cleanup = registerPortfolioTools(native.target);
    expect(native.definitions.map((tool) => tool.name)).toEqual(['search_portfolio', 'get_portfolio_source']);
    expect(state.imports).toBe(0);
    expect(state.load).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(native.registerTool.mock.calls[0][1]).not.toHaveProperty('exposedTo');
    expect(native.definitions[0].annotations).toEqual({ readOnlyHint: true, consequentialHint: false, untrustedContentHint: true });
    cleanup();
    expect(native.signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('degrades safely when document.modelContext is missing or registration fails', async () => {
    expect(registerPortfolioTools({} as Document)).toBeTypeOf('function');
    const native = nativeDocument(true);
    registerPortfolioTools(native.target);
    await Promise.resolve();
    expect(native.signals.every((signal) => signal.aborted)).toBe(true);
    expect(state.load).not.toHaveBeenCalled();
  });

  it('validates arguments before loading and limits search to five approved passages', async () => {
    const native = nativeDocument();
    registerPortfolioTools(native.target);
    const tool = native.definitions[0];
    for (const args of [null, [], {}, { query: '' }, { query: 3 }, { query: 'a'.repeat(501) }, { query: 'CARRE', url: 'https://outside.example' }]) {
      await expect(tool.execute(args)).rejects.toBeInstanceOf(TypeError);
    }
    expect(state.load).not.toHaveBeenCalled();
    const result = JSON.parse(await tool.execute({ query: ' CARRE ontology ' }));
    expect(result).toEqual({ corpusRelease: corpus.release, corpusHash: corpus.hash, sources: [source] });
    expect(state.retrieve).toHaveBeenCalledWith('CARRE ontology', corpus.chunks, 5);
    expect(state.imports).toBe(2);
  });

  it('returns an exact source or null, without invoking retrieval', async () => {
    const native = nativeDocument();
    registerPortfolioTools(native.target);
    expect(JSON.parse(await native.definitions[1].execute({ id: source.id })).source).toEqual(source);
    expect(JSON.parse(await native.definitions[1].execute({ id: 'unknown' })).source).toBeNull();
    expect(state.retrieve).not.toHaveBeenCalled();
  });

  it('cancels in-flight work when registration ends and rejects already aborted execution', async () => {
    const native = nativeDocument();
    const cleanup = registerPortfolioTools(native.target);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(native.definitions[0].execute({ query: 'CARRE' }, { signal: cancelled.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.load).not.toHaveBeenCalled();
    state.load.mockImplementation((signal: AbortSignal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const pending = native.definitions[1].execute({ id: source.id });
    await vi.waitFor(() => expect(state.load).toHaveBeenCalledOnce());
    cleanup();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('shared public corpus loader', () => {
  it('checks the artifact boundary and caches successful loads only', async () => {
    const { loadPortfolioCorpus } = await vi.importActual<typeof import('../src/features/ask-work/corpus')>('../src/features/ask-work/corpus');
    const fetcher = vi.mocked(fetch);
    fetcher.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    await expect(loadPortfolioCorpus(new AbortController().signal)).rejects.toThrow('503');
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => corpus } as Response);
    expect(await loadPortfolioCorpus(new AbortController().signal)).toEqual(corpus);
    expect(await loadPortfolioCorpus(new AbortController().signal)).toEqual(corpus);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith('/lab-artifacts/corpus.json', expect.objectContaining({ redirect: 'error', credentials: 'omit' }));
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(loadPortfolioCorpus(cancelled.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
