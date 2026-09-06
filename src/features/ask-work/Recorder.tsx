import { useEffect, useRef, useState } from 'react';
export function LocalModelControls({ model, onStop }: {
  model: ReturnType<typeof useLocalModel>;
  onStop: () => void;
}) {
  if (model.availability === 'checking') return <p className="muted" role="status">Checking whether this browser supports local AI…</p>;
  if (model.availability === 'unavailable') return <div className="ask-notice">
    <p><strong>Local AI is unavailable on this browser or device.</strong></p>
    {model.error && <><p role="status">{model.error}</p><button type="button" className="button button-secondary" onClick={model.retryAvailability}>Check local AI again</button></>}
    <p>Try a supported desktop version of Chrome. You can search the same portfolio sources here without a model.</p>
    <a href="https://developer.chrome.com/docs/ai/prompt-api#hardware-requirements" target="_blank" rel="noreferrer">Chrome requirements ↗</a>
  </div>;
  if (model.phase === 'ready') return <div className="ask-model-ready"><span>● Local model ready</span><button type="button" className="ask-text-button" onClick={onStop}>Turn off local AI</button></div>;
  if (model.phase === 'loading') return <div className="ask-notice" aria-live="polite">
    <p>{model.progress === null ? 'Preparing the local model…' : `Model download: ${Math.round(model.progress * 100)}%`}</p>
    <progress aria-label="Model download progress" max={1} value={model.progress ?? undefined} />
    <button type="button" className="button button-secondary" onClick={onStop}>Cancel download</button>
  </div>;
  return <div className="ask-notice">
    <p><strong>Enable AI when you are ready.</strong></p>
    <p>Chrome may download a large model and needs a supported desktop device. In Chrome, Gemini Nano runs on your device. This site does not send your questions to an AI service.</p>
    {model.error && <p role="alert">{model.error}</p>}
    <button type="button" className="button button-secondary" onClick={model.enable}>{model.phase === 'error' ? 'Retry local AI' : 'Enable local AI'}</button>
  </div>;
}


import { generateAnswer, NativeOutputError, systemPrompt } from './native';
import { buildPrompt, retrieve } from './retrieval';
import { fetchArtifact, parseCorpus, parseEvaluationCases, type Corpus, type EvaluationCase, type RecordedAttempt, type RecordedRun } from './types';
import { useLocalModel } from './useLocalModel';
import './ask-work.css';

async function browserVersion(): Promise<string> {
  const browser = navigator as Navigator & {
    userAgentData?: { getHighEntropyValues: (hints: string[]) => Promise<{ fullVersionList?: { brand: string; version: string }[] }> };
  };
  try {
    const data = await browser.userAgentData?.getHighEntropyValues(['fullVersionList']);
    const chrome = data?.fullVersionList?.find((item) => item.brand === 'Google Chrome');
    if (chrome) return `Google Chrome ${chrome.version}`;
  } catch { /* Use the browser's reported user agent when detailed version data is unavailable. */ }
  return navigator.userAgent;
}

function RecordingSurface() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [cases, setCases] = useState<EvaluationCase[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<RecordedAttempt[]>([]);
  const [completed, setCompleted] = useState(false);
  const [download, setDownload] = useState('');
  const request = useRef<AbortController | null>(null);
  const model = useLocalModel();

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetchArtifact('/lab-artifacts/corpus.json', controller.signal),
      fetchArtifact('/.build/evaluation-cases.json', controller.signal),
    ]).then(([source, questions]) => {
      if (controller.signal.aborted) return;
      const loadedCorpus = parseCorpus(source);
      const loadedCases = parseEvaluationCases(questions, loadedCorpus.hash);
      if (loadedCases.length !== 30) throw new Error('Recording requires the complete set of 30 evaluation cases.');
      setCorpus(loadedCorpus);
      setCases(loadedCases);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Recorder data could not load.');
    });
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!completed || !corpus || runs.length !== 30) return;
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, release: corpus.release, corpusHash: corpus.hash, recordedAt: new Date().toISOString(), runs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    setDownload(url);
    return () => URL.revokeObjectURL(url);
  }, [completed, corpus, runs]);

  function stop() {
    request.current?.abort();
    setBusy(false);
    setError('Recording cancelled. A completed 30-case run is required before export.');
    model.stop();
  }

  async function record() {
    if (!corpus || !model.session.current || busy || cases.length !== 30) return;
    const baseSession = model.session.current;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true);
    setCompleted(false);
    setDownload('');
    setRuns([]);
    setError('');
    const recorded: RecordedAttempt[] = [];
    try {
      const version = await browserVersion();
      for (const item of cases) {
        if (controller.signal.aborted) return;
        const context = retrieve(item.question, corpus.chunks);
        const started = performance.now();
        const provenance: RecordedRun['provenance'] = { api: 'Chrome Prompt API', browserVersion: version, modelFamily: 'Gemini Nano', modelRevision: null, modelRevisionStatus: 'not-exposed' };
        const metadata = {
          schemaVersion: 1 as const,
          id: item.id,
          question: item.question,
          contextIds: context.map(({ chunk }) => chunk.id),
          corpusHash: corpus.hash,
          corpusRelease: corpus.release,
          systemPrompt,
          provenance,
        };
        try {
          const generated = await generateAnswer(baseSession, item.question, context, controller.signal);
          if (controller.signal.aborted) return;
          recorded.push({ ...metadata, status: 'answered', ...generated.result, prompt: generated.prompt, rawOutput: generated.rawOutput, recordedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started) });
        } catch (reason) {
          if (controller.signal.aborted) return;
          recorded.push({
            ...metadata, status: 'failed',
            error: reason instanceof Error ? reason.message : 'Native generation failed.',
            prompt: reason instanceof NativeOutputError ? reason.prompt : buildPrompt(item.question, context),
            rawOutput: reason instanceof NativeOutputError ? reason.rawOutput : null,
            recordedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started),
          });
        }
        setRuns([...recorded]);
      }
      setCompleted(true);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'Recording failed. Nothing has been published.');
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <div className="ask-work">
    {!corpus && !error && <p role="status">Loading approved public sources and evaluation cases…</p>}
    <LocalModelControls model={model} onStop={stop} />
    <p>Each of the 30 questions will run through the same retrieval and native model pipeline as the portfolio. Raw prompts, responses, citations, timing, and available provenance are preserved for review.</p>
    <button type="button" className="button" onClick={() => void record()} disabled={!corpus || model.phase !== 'ready' || busy}>{runs.length ? 'Record all 30 cases again' : 'Record all 30 cases'}</button>
    {busy && <button type="button" className="button button-secondary" onClick={stop}>Stop recording</button>}
    <p role="status">{runs.length} / 30 cases captured. {runs.filter((run) => run.status === 'failed').length} failed.{completed ? ' Ready for source review.' : ''}</p>
    {error && <p role="alert">{error}</p>}
    {completed && download && <a className="button" href={download} download={`portfolio-recordings-${corpus?.release}.json`}>Download recordings for review</a>}
    <ol className="ask-recorder-runs">{runs.map((run) => <li key={run.id}><details className={run.status === 'failed' ? 'ask-recorder-failure' : undefined}><summary>{run.id}: {run.question}{run.status === 'failed' ? ' (failed)' : ''}</summary>{run.status === 'failed' ? <><p>{run.error}</p><h2>Raw response</h2><pre>{run.rawOutput ?? '(No response was returned.)'}</pre><h2>Exact prompt</h2><pre>{run.prompt}</pre></> : <><p>{run.answer}</p><p>{run.refusal ? 'Refused' : `Citations: ${run.citations.join(', ')}`}</p></>}</details></li>)}</ol>
  </div>;
}

export default function Recorder() {
  const [started, setStarted] = useState(false);
  return <main className="ask-recorder"><p className="eyebrow">Development only</p><h1>Record portfolio answers</h1><p>This tool creates actual native-model recordings. It never publishes them. Use the approved Chrome recording environment, then review the exported file before publication.</p>{started ? <RecordingSurface /> : <button type="button" className="button" onClick={() => setStarted(true)}>Start recorder</button>}</main>;
}
