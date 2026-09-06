import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Arrow } from '../components/Shared';
import { Button } from '../components/Button';
import { beginNative, isNativeUnavailable, type LocalEngine, type ModelProgress } from '../features/ask-work/model-engine';

const AskWork = lazy(() => import('../features/ask-work/AskWork'));
export type StartupState = ModelProgress | { phase: 'checking' | 'ready' | 'unavailable' | 'error'; progress: null; detail: string };

class FeatureBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() {
    return this.state.failed ? <section className="panel" role="alert"><h2>The chat couldn’t load.</h2><p>Check your connection and try again.</p><a className="button" href="/lab/ask-about-my-work">Reload chat</a></section> : this.props.children;
  }
}

export default function Ask() {
  const [started, setStarted] = useState(false);
  const [engine, setEngine] = useState<LocalEngine | null>(null);
  const [state, setState] = useState<StartupState>({ phase: 'checking', progress: null, detail: 'Checking this browser…' });
  const startup = useRef<AbortController | null>(null);
  const activeEngine = useRef<LocalEngine | null>(null);

  function dispose() {
    startup.current?.abort();
    startup.current = null;
    activeEngine.current?.destroy();
    activeEngine.current = null;
  }
  useEffect(() => dispose, []);

  function start() {
    dispose();
    const controller = new AbortController();
    startup.current = controller;
    setStarted(true);
    setEngine(null);
    setState({ phase: 'checking', progress: null, detail: 'Checking this browser…' });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watchdog = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (startup.current !== controller || controller.signal.aborted) return;
        controller.abort();
        setState({ phase: 'error', progress: null, detail: 'Local AI took too long to start. You can still search the portfolio, or retry.' });
      }, 120_000);
    };
    controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
    watchdog();
    const progress = (value: ModelProgress) => {
      if (startup.current === controller && !controller.signal.aborted) { watchdog(); setState(value); }
    };
    // Keep native creation in the Start click, before lazy imports consume user activation.
    let native: Promise<LocalEngine> | null;
    try { native = beginNative(controller.signal, progress); }
    catch (reason) { native = Promise.reject(reason); }
    void (async () => {
      let loaded: LocalEngine | null;
      try {
        if (native) {
          try { loaded = await native; }
          catch (reason) {
            if (isNativeUnavailable(reason)) loaded = null;
            else throw reason;
          }
        } else loaded = null;
        if (startup.current !== controller || controller.signal.aborted) { loaded?.destroy(); return; }
        activeEngine.current = loaded;
        setEngine(loaded);
        setState(loaded
          ? { phase: 'ready', progress: null, detail: 'Ready. Answers run on your device.' }
          : { phase: 'unavailable', progress: null, detail: 'Local AI isn’t available here. You can still search the portfolio below.' });
      } catch (reason) {
        if (startup.current !== controller || controller.signal.aborted) return;
        const unsupported = reason instanceof Error && reason.name === 'NotSupportedError';
        setState({ phase: unsupported ? 'unavailable' : 'error', progress: null, detail: unsupported
          ? 'This device can’t run local AI. You can still search the portfolio below.'
          : 'Local AI couldn’t start. Check your connection and retry, or search the portfolio below.' });
      } finally { clearTimeout(timer); }
    })();
  }

  function cancel() { dispose(); setEngine(null); setStarted(false); }

  return <div className="chat-page" data-started={started}>
    <header className="page-intro ask-intro"><p className="eyebrow">A conversation, on your device</p><h1>Ask about <span>my work.</span></h1><p>Explore my projects, experience, and research. Follow the sources behind each answer.</p></header>
    {started ? <FeatureBoundary onFailure={dispose}><Suspense fallback={<section className="chat-start panel" role="status"><p>Loading the chat…</p><Button className="button-secondary" onClick={cancel}>Cancel</Button></section>}><AskWork engine={engine} startup={state} onRetry={start} onCancel={cancel} /></Suspense></FeatureBoundary>
      : <section className="chat-start panel" aria-label="Start a conversation">
        <svg className="chat-symbol" viewBox="0 0 32 32" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M6 6h20v15H15l-7 5v-5H6z" strokeLinejoin="round" /><path d="M11 12h10M11 16h6" strokeLinecap="round" /></svg>
        <h2>What would you like to know?</h2><p>Start to check your browser and prepare the chat.</p><Button onClick={start}>Start<Arrow /></Button>
        <p className="chat-download-note">Local AI works in supported desktop Chrome and may need a browser-managed model download. Other browsers can search the same portfolio sources. You can cancel while it loads.</p>
        <noscript><p>The chat needs JavaScript. You can explore all <a href="/work">project stories</a> directly.</p></noscript>
      </section>}
    <p className="chat-privacy">Questions stay in this tab. Check linked sources for accuracy. <Link to="/privacy">Privacy</Link></p>
  </div>;
}
