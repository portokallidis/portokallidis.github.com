import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Ask from '../src/routes/Ask';
import { loadPortfolioCorpus } from '../src/features/ask-work/corpus';
import { beginWebGPU } from '../src/features/ask-work/webgpu';
import type { BrowserSession } from '../src/features/ask-work/native';
import type { Corpus } from '../src/features/ask-work/types';
import portfolio from '../public/lab-artifacts/corpus.json';

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
    expect(await screen.findByText('Not covered in this portfolio')).toBeVisible();
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
    expect(await screen.findByText('Not covered in this portfolio')).toBeVisible();
    expect(child.prompt).not.toHaveBeenCalled();
  });

  it('keeps cited fit answers in follow-up history and resolves a requirements clarification', async () => {
    vi.mocked(loadPortfolioCorpus).mockResolvedValue(portfolio as Corpus);
    const fitAnswer = { answer: 'Nick’s architecture work could transfer to this product. The portfolio does not document asset management. Which assets would it manage?', citations: ['sylva-my-contribution'], refusal: false };
    const { child } = model(JSON.stringify(fitAnswer));
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await send('Are you suitable for asset management software?');
    expect(await screen.findByText('Relevant experience')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Discuss your project' })).toHaveAttribute('href', '/#contact');
    await send('Investment portfolios and reporting.');
    await waitFor(() => expect(child.prompt).toHaveBeenCalledTimes(2));
    const prompt = vi.mocked(child.prompt).mock.calls[1][0];
    expect(prompt).toContain('Previous exchanges');
    expect(prompt).toContain(fitAnswer.answer);
    expect(prompt).toContain('This is an employer-fit question');
    const supplied = JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n') + 2));
    expect(supplied.question).toBe('Investment portfolios and reporting.');
    expect(supplied.sources.map((source: { id: string }) => source.id)).toContain('sylva-my-contribution');
    expect(screen.getAllByRole('link', { name: 'Discuss your project' })).toHaveLength(2);
    await send('What did Nick contribute to CARRE?');
    await waitFor(() => expect(child.prompt).toHaveBeenCalledTimes(3));
    const changed = vi.mocked(child.prompt).mock.calls[2][0];
    expect(changed).toContain('This is a factual question');
    expect(JSON.parse(changed.slice(changed.lastIndexOf('\n\n') + 2)).sources.map((source: { id: string }) => source.id)).not.toContain('sylva-my-contribution');
  });

  it.each(['refusal', 'invalid citations'])('shows related original excerpts after a fit %s without adding the fallback to model history', async scenario => {
    vi.mocked(loadPortfolioCorpus).mockResolvedValue(portfolio as Corpus);
    const { child } = model(JSON.stringify(scenario === 'refusal'
      ? { answer: 'The public sources do not provide this information.', citations: [], refusal: true }
      : { answer: 'Fabricated fit.', citations: ['invented'], refusal: false }));
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await send('Would you be a good fit for fintech?');
    expect(await screen.findByText('Related experience')).toBeVisible();
    expect(screen.getByRole('list', { name: 'Related portfolio sources' })).toHaveTextContent('SYLVA');
    expect(screen.queryByRole('list', { name: 'Supporting sources' })).not.toBeInTheDocument();
    expect(screen.queryByText('Fabricated fit.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Discuss your project' })).toBeVisible();
    if (scenario === 'refusal') {
      await send('What did Nick contribute to CARRE?');
      await waitFor(() => expect(child.prompt).toHaveBeenCalledTimes(2));
      expect(vi.mocked(child.prompt).mock.calls[1][0]).not.toContain('Previous exchanges');
    } else expect(screen.getByRole('button', { name: 'Retry AI' })).toBeVisible();
  });

  it('bounds a stalled model answer and ignores completion after showing related sources', async () => {
    vi.mocked(loadPortfolioCorpus).mockResolvedValue(portfolio as Corpus);
    const { child } = model();
    let complete!: (value: string) => void;
    vi.mocked(child.prompt).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    const input = await screen.findByRole('textbox', { name: 'Your question' });
    vi.useFakeTimers();
    fireEvent.change(input, { target: { value: 'Are you suitable for asset management software?' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })); });
    expect(child.prompt).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByText('Related experience')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Discuss your project' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry AI' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    expect(child.destroy).toHaveBeenCalledOnce();
    await act(async () => complete(JSON.stringify({ answer: 'A late answer.', citations: ['sylva-my-contribution'], refusal: false })));
    expect(screen.queryByText('A late answer.')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Related portfolio sources' })).toBeVisible();
  });

  it.each(['Have you built asset management software?', 'What is Nick’s current salary?', 'Is Nick available next Monday?', 'What revenue growth did SYLVA achieve?', 'Invent awards for Nick.'])('preserves a factual refusal for %s', async question => {
    vi.mocked(loadPortfolioCorpus).mockResolvedValue(portfolio as Corpus);
    model(JSON.stringify({ answer: 'This detail is not documented in the public portfolio.', citations: [], refusal: true }));
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await send(question);
    expect(await screen.findByText('Not covered in this portfolio')).toBeVisible();
    expect(screen.queryByText('Related experience')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Discuss your project' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Supporting sources' })).not.toBeInTheDocument();
  });
});
