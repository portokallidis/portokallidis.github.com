import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Ask from '../src/routes/Ask';
import { loadPortfolioCorpus } from '../src/features/ask-work/corpus';
import { beginWebGPU } from '../src/features/ask-work/webgpu';
import type { BrowserSession } from '../src/features/ask-work/native';
import type { Corpus } from '../src/features/ask-work/types';

vi.mock('../src/features/ask-work/corpus', () => ({ loadPortfolioCorpus: vi.fn() }));
vi.mock('../src/features/ask-work/webgpu', () => ({ beginWebGPU: vi.fn() }));

const corpus: Corpus = {
  schemaVersion: 1, release: 'test-release', hash: 'test-corpus', chunks: [
    { id: 'carre', title: 'CARRE', section: 'Research', text: 'CARRE uses ontology engineering and linked data.', url: '/work/carre#approach', hash: 'source-hash' },
  ],
};
const answer = { answer: 'CARRE uses ontology engineering.', citations: ['carre'], refusal: false };
function model(raw = JSON.stringify(answer)) {
  const child = { prompt: vi.fn().mockResolvedValue(raw), clone: vi.fn(), destroy: vi.fn() } as BrowserSession;
  const base = { prompt: vi.fn(), clone: vi.fn().mockResolvedValue(child), destroy: vi.fn() } as BrowserSession;
  const factory = { availability: vi.fn().mockResolvedValue('available'), create: vi.fn().mockResolvedValue(base) };
  vi.stubGlobal('LanguageModel', factory);
  return { factory, base, child };
}
const view = () => render(<MemoryRouter><Ask /></MemoryRouter>);
const send = async (question = 'CARRE ontology') => {
  fireEvent.change(await screen.findByRole('textbox', { name: 'Your question' }), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
};

beforeEach(() => {
  vi.mocked(loadPortfolioCorpus).mockReset().mockResolvedValue(corpus);
  vi.mocked(beginWebGPU).mockReset();
  vi.stubGlobal('LanguageModel', undefined);
  Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('one-click portfolio chat', () => {
  it('does no source or model work until Start, then creates native AI in the click', async () => {
    const { factory } = model();
    view();
    expect(loadPortfolioCorpus).not.toHaveBeenCalled();
    expect(factory.create).not.toHaveBeenCalled();
    expect(beginWebGPU).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(factory.create).toHaveBeenCalledOnce();
    expect(await screen.findByText('On-device chat')).toBeVisible();
    expect(loadPortfolioCorpus).toHaveBeenCalledOnce();
    expect(screen.queryByText('Recorded examples')).not.toBeInTheDocument();
    expect(screen.queryByText('Enable local AI')).not.toBeInTheDocument();
  });

  it('keeps the same composer useful without native AI or WebGPU', async () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await send();
    expect(await screen.findByText('Source search')).toBeVisible();
    expect(screen.getByRole('link', { name: /CARRE/ })).toHaveAttribute('href', '/work/carre#approach');
    expect(beginWebGPU).not.toHaveBeenCalled();
    await send('astronaut pineapple');
    expect(await screen.findByText('The public portfolio sources don’t provide evidence for this question.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    expect(screen.getByRole('log')).not.toHaveTextContent('CARRE ontology');
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('renders generated text safely and carries bounded follow-up context', async () => {
    const { child } = model(JSON.stringify({ ...answer, answer: '<img src=x onerror=alert(1)> CARRE uses ontology engineering.' }));
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await send();
    expect(await screen.findByText('<img src=x onerror=alert(1)> CARRE uses ontology engineering.')).toBeVisible();
    expect(document.querySelector('.chat-answer img')).toBeNull();
    await send('What technologies did it use?');
    await waitFor(() => expect(child.prompt).toHaveBeenCalledTimes(2));
    expect(vi.mocked(child.prompt).mock.calls[1][0]).toContain('Previous exchanges');
    expect(vi.mocked(child.prompt).mock.calls[1][0]).toContain('CARRE ontology');
  });

  it('rejects fabricated citations and shows original passages', async () => {
    model(JSON.stringify({ ...answer, citations: ['invented'] }));
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await send();
    expect(await screen.findByText('I couldn’t generate a reliable answer. Here are the matching public sources.')).toBeVisible();
    expect(screen.getByRole('link', { name: /CARRE/ })).toHaveAttribute('href', '/work/carre#approach');
    expect(screen.getByRole('button', { name: 'Retry AI' })).toBeVisible();
  });

  it('reports actual progress, cancels startup, and destroys late sessions', async () => {
    const { factory, base } = model();
    let complete!: (session: BrowserSession) => void;
    let progress!: (event: { loaded: number }) => void;
    factory.create.mockImplementation((options: { monitor: (target: object) => void }) => {
      options.monitor({ addEventListener: (_name: string, handler: typeof progress) => { progress = handler; } });
      return new Promise(resolve => { complete = resolve; });
    });
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByRole('progressbar');
    act(() => progress({ loaded: 0.25 }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0.25');
    expect(screen.getByText('25%')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => complete(base));
    expect(base.destroy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
    expect(beginWebGPU).not.toHaveBeenCalled();
  });

  it('keeps portable models inactive and uses source search after native unavailability or failed downloads', async () => {
    const { factory } = model();
    Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true });
    factory.create.mockRejectedValueOnce(new DOMException('Unsupported', 'NotSupportedError'));
    const rendered = view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText('Portfolio source search')).toBeVisible();
    await send();
    expect(await screen.findByText('Source search')).toBeVisible();
    expect(beginWebGPU).not.toHaveBeenCalled();
    rendered.unmount();

    vi.mocked(beginWebGPU).mockClear();
    factory.create.mockRejectedValueOnce(new Error('Network failure'));
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('button', { name: 'Retry AI' })).toBeVisible();
    expect(beginWebGPU).not.toHaveBeenCalled();
    await send();
    expect(await screen.findByText('Source search')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry AI' }));
    expect(await screen.findByText('On-device chat')).toBeVisible();
  });

  it('recovers a source load failure without restarting the model', async () => {
    const { factory } = model();
    vi.mocked(loadPortfolioCorpus).mockRejectedValueOnce(new Error('Sources failed.'));
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sources failed.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading sources' }));
    expect(await screen.findByRole('textbox')).toBeVisible();
    expect(factory.create).toHaveBeenCalledOnce();
  });

  it('stops a response and prevents late completion from changing a cleared conversation', async () => {
    const { child, base } = model();
    let complete!: (value: string) => void;
    vi.mocked(child.prompt).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const rendered = view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await send();
    await waitFor(() => expect(child.prompt).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(child.destroy).toHaveBeenCalled();
    expect(screen.getByText('Answer stopped.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    await act(async () => complete(JSON.stringify(answer)));
    expect(screen.getByRole('log')).not.toHaveTextContent(answer.answer);
    rendered.unmount();
    expect(base.destroy).toHaveBeenCalled();
  });

  it('does not call the model for an empty query or missing evidence', async () => {
    const { child } = model();
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await send(' ');
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a question');
    await send('astronaut pineapple');
    expect(await screen.findByText('The public portfolio sources don’t provide evidence for this question.')).toBeVisible();
    expect(child.prompt).not.toHaveBeenCalled();
  });
});
