import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { Arrow } from '../../components/Shared';
import { projects } from '../../content';
import { displayPreferredName } from '../../display-name';
import type { StartupState } from '../../routes/Ask';
import { loadPortfolioCorpus } from './corpus';
import type { ChatExchange, LocalEngine } from './model-engine';
import { isFitQuestion, retrieve, tokenize, validateQuestion } from './retrieval';
import { parseAnswer, type Corpus, type CorpusChunk } from './types';
import './ask-work.css';

interface Turn {
  id: number;
  question: string;
  retrievalTopic: string;
  answer: string;
  label: string;
  sources: CorpusChunk[];
  excerpts: boolean;
  pending: boolean;
  fitQuestion: boolean;
  answered: boolean;
}
interface Props {
  engine: LocalEngine | null;
  startup: StartupState;
  onRetry: () => void;
  onCancel: () => void;
}

export function Sources({ chunks, excerpts = false, related = false }: { chunks: CorpusChunk[]; excerpts?: boolean; related?: boolean }) {
  if (!chunks.length) return null;
  return <ul className={excerpts ? 'chat-sources chat-excerpts' : 'chat-sources'} aria-label={related ? 'Related portfolio sources' : 'Supporting sources'}>
    {chunks.map(chunk => <li key={chunk.id}><a href={chunk.url}>{displayPreferredName(chunk.title)}<span className="chat-source-section"> / {chunk.section}</span><span aria-hidden="true"> ↗</span></a>
      {excerpts && <blockquote>{displayPreferredName(chunk.text.length > 420 ? chunk.text.slice(0, 420).trimEnd() + '…' : chunk.text)}</blockquote>}
    </li>)}
  </ul>;
}

export default function AskWork({ engine, startup, onRetry, onCancel }: Props) {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [sourceError, setSourceError] = useState('');
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [question, setQuestion] = useState('');
  const [inputError, setInputError] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [failedEngine, setFailedEngine] = useState<LocalEngine | null>(null);
  const request = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const input = useRef<HTMLTextAreaElement | null>(null);
  const transcript = useRef<HTMLDivElement | null>(null);
  const followBottom = useRef(true);
  const loading = ['checking', 'downloading', 'preparing'].includes(startup.phase);

  useEffect(() => {
    const controller = new AbortController();
    setSourceError('');
    void loadPortfolioCorpus(controller.signal).then(value => {
      if (!controller.signal.aborted) setCorpus(value);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setSourceError(reason instanceof Error ? reason.message : 'Portfolio sources couldn’t load.');
    });
    return () => controller.abort();
  }, [sourceAttempt]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!loading && corpus) input.current?.focus({ preventScroll: true });
  }, [loading, corpus]);
  useEffect(() => {
    const container = transcript.current;
    const latest = container?.querySelector('.chat-turn:last-child');
    if (followBottom.current && container && latest) container.scrollTop += latest.getBoundingClientRect().top - container.getBoundingClientRect().top - 24;
  }, [turns]);

  function stop() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setTurns(items => items.map(item => item.pending ? { ...item, pending: false, answer: 'Answer stopped.', label: 'Stopped' } : item));
    input.current?.focus({ preventScroll: true });
  }
  function clear() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setTurns([]);
    setQuestion('');
    setInputError('');
    input.current?.focus({ preventScroll: true });
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || !corpus || loading) return;
    let query: string;
    try { query = validateQuestion(question); }
    catch (reason) { setInputError(reason instanceof Error ? reason.message : 'Enter a question.'); input.current?.focus(); return; }
    setInputError('');
    setQuestion('');
    const controller = new AbortController();
    request.current = controller;
    const id = ++nextId.current;
    followBottom.current = true;
    const history: ChatExchange[] = turns.filter(turn => turn.answered)
      .slice(-3).map(turn => ({ question: turn.question, answer: turn.answer }));
    // Keep the last resolved topic across elliptical follow-ups, without indexing prior answers.
    const words = (value: string) => ' ' + value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    const questionWords = words(query);
    const explicitProject = projects.some(project => [project.name, project.slug].some(name => questionWords.includes(words(name))));
    const explicitIdentity = /\b(?:nick|nikolaos|portokallidis)\b/i.test(query);
    const previousTurn = turns.at(-1);
    const previousTopic = previousTurn?.retrievalTopic;
    // Treat a declarative reply to the last fit question as requirements, without carrying a new question into that topic.
    const clarification = previousTurn?.fitQuestion && /\?\s*$/.test(previousTurn.answer) && !query.includes('?')
      && !/^(?:who|what|how|when|where|which|why|have|has|did|does|is|are|can|could|would|tell|ignore|forget|new|different)\b/i.test(query);
    const followUp = previousTopic && !explicitProject && !explicitIdentity && (tokenize(query).length === 0
      || clarification || /\b(it|its|that|those|these|they|their|he|him|his|this project|there)\b/i.test(query));
    const retrievalTopic = followUp ? previousTopic : query;
    const searchQuery = followUp ? retrievalTopic + ' ' + query : query;
    const fitQuestion = isFitQuestion(query) || Boolean(followUp && previousTurn?.fitQuestion
      && (clarification || /^(?:it|this|that|we|our|the software|the product)\b/i.test(query)));
    const results = retrieve(searchQuery, corpus.chunks);
    setBusy(true);
    setTurns(items => [...items, { id, question: query, retrievalTopic, answer: '', label: 'Finding sources', sources: [], excerpts: false, pending: true, fitQuestion, answered: false }]);
    const finish = (update: Partial<Turn>) => {
      if (!controller.signal.aborted && request.current === controller) setTurns(items => items.map(turn => turn.id === id ? { ...turn, ...update, pending: false } : turn));
    };
    const relatedExperience = () => finish({
      label: 'Related experience',
      answer: 'Explore Nick’s documented experience below.'
        + (clarification ? '' : ' Which requirements and workflows matter most for your project?'),
      sources: results.map(result => result.chunk), excerpts: true,
    });
    try {
      if (!results.length) {
        finish({ label: 'Not covered in this portfolio', answer: 'This detail isn’t covered in the public portfolio. You can explore the project pages or get in touch to discuss it.' });
      } else if (!engine || failedEngine === engine) {
        if (fitQuestion) relatedExperience();
        else finish({ label: 'Source search', answer: 'Here are the matching passages from my public portfolio.', sources: results.map(result => result.chunk), excerpts: true });
      } else {
        setTurns(items => items.map(turn => turn.id === id ? { ...turn, label: 'Thinking on your device' } : turn));
        const timeout = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          // Bound the UI wait even if the browser ignores cancellation of a stalled model call.
          const generated = await Promise.race([
            engine.answer(query, results, history, AbortSignal.any([controller.signal, timeout.signal]), fitQuestion),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => { reject(new Error('The local answer timed out.')); timeout.abort(); }, 60_000);
            }),
          ]);
          const answer = parseAnswer(generated.result, results.map(result => result.chunk.id));
          if (answer.refusal && fitQuestion) relatedExperience();
          else finish({ label: answer.refusal ? 'Not covered in this portfolio' : fitQuestion ? 'Relevant experience' : 'Answered locally', answer: answer.answer, sources: answer.citations.map(citation => results.find(result => result.chunk.id === citation)!.chunk), answered: !answer.refusal });
        } finally { clearTimeout(timer); }
      }
    } catch {
      if (!controller.signal.aborted) {
        setFailedEngine(engine);
        if (fitQuestion) relatedExperience();
        else finish({ label: 'Source search', answer: 'I couldn’t generate a reliable answer. Here are the matching public sources.', sources: results.map(result => result.chunk), excerpts: true });
      }
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); input.current?.focus({ preventScroll: true }); }
    }
  }

  if (loading || !corpus) return <section className="chat-loading panel" aria-label="Preparing the chat">
    <svg className="chat-symbol" viewBox="0 0 32 32" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="16" cy="16" r="10" strokeDasharray="3 5" /></svg>
    <h2>{sourceError ? 'Sources couldn’t load' : loading ? 'Preparing your chat' : 'Loading portfolio sources'}</h2>
    {sourceError ? <><p role="alert">{sourceError}</p><Button className="button-secondary" onClick={() => setSourceAttempt(value => value + 1)}>Retry loading sources</Button></>
      : <><p role="status">{loading ? startup.detail : 'Loading the public portfolio…'}</p><progress aria-label="Chat loading progress" max={1} value={startup.progress ?? undefined} />{startup.progress !== null && <p className="chat-progress-value">{Math.round(startup.progress * 100)}%</p>}</>}
    <Button className="button-secondary" onClick={onCancel}>Cancel</Button>
  </section>;

  return <section className="chat-work" aria-label="Portfolio chat">
    <div className="chat-toolbar">
      <p className="chat-status" role="status"><span className={engine && failedEngine !== engine ? 'chat-dot ready' : 'chat-dot'} aria-hidden="true" />{engine && failedEngine !== engine ? 'On-device chat' : 'Portfolio source search'}</p>
      {turns.length > 0 && <button className="chat-text-button" onClick={clear} type="button">Clear conversation</button>}
    </div>
    <div className="chat-transcript" role="log" aria-label="Conversation" aria-live="polite" ref={transcript} onScroll={event => {
      const element = event.currentTarget;
      followBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    }}>
      {!turns.length && <div className="chat-welcome"><h2>Let’s talk about the work.</h2><p>Ask about a project, a technology, or my research.</p></div>}
      {turns.map(turn => <div className="chat-turn" key={turn.id}>
        <div className="chat-question"><span className="visually-hidden">You: </span><p>{turn.question}</p></div>
        <article className="chat-answer" aria-label={'Reply to: ' + turn.question} aria-busy={turn.pending}>
          <p className="eyebrow">{turn.label}{turn.pending && '…'}</p>
          {turn.answer && <p className="chat-answer-text">{displayPreferredName(turn.answer)}</p>}
          {turn.fitQuestion && !turn.pending && <Link className="text-link" to="/#contact">Discuss your project<Arrow diagonal /></Link>}
          <Sources chunks={turn.sources} excerpts={turn.excerpts} related={turn.fitQuestion && turn.excerpts} />
        </article>
      </div>)}
    </div>
    {(!engine || failedEngine === engine) && <div className="chat-fallback"><p>{failedEngine ? 'The model couldn’t finish reliably. Source search is available.' : startup.detail}</p>{(startup.phase === 'error' || failedEngine) && <button className="chat-text-button" type="button" onClick={onRetry}>Retry AI</button>}</div>}
    <form className="chat-form" onSubmit={send}>
      <label className="visually-hidden" htmlFor="chat-question">Your question</label>
      <textarea id="chat-question" ref={input} rows={2} maxLength={500} value={question} placeholder="Ask about my work…" aria-describedby={inputError ? 'chat-input-error' : 'chat-input-hint'} aria-invalid={inputError ? true : undefined} onChange={event => setQuestion(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
      }} />
      <div className="chat-composer-bottom"><p id="chat-input-hint">Enter to send · Shift + Enter for a new line</p>{busy ? <Button type="button" className="button-secondary" onClick={stop}>Stop<span aria-hidden="true">■</span></Button> : <Button type="submit">Send<Arrow /></Button>}</div>
      {inputError && <p className="chat-input-error" id="chat-input-error" role="alert">{inputError}</p>}
    </form>
  </section>;
}
