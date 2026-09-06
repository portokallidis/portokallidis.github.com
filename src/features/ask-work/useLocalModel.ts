import { useEffect, useRef, useState } from 'react';
import { createNativeSession, nativeModel, sessionOptions, type Availability, type BrowserSession } from './native';

export function useLocalModel() {
  const [availability, setAvailability] = useState<Availability | 'checking'>('checking');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [checkAttempt, setCheckAttempt] = useState(0);
  const session = useRef<BrowserSession | null>(null);
  const load = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const model = nativeModel();
    setError('');
    setAvailability('checking');
    if (!model) setAvailability('unavailable');
    else {
      timer = setTimeout(() => {
        settled = true;
        if (!cancelled) {
          setAvailability('unavailable');
          setError('The browser took too long to check its local model. You can check again or keep using source search.');
        }
      }, 15_000);
      void model.availability(sessionOptions).then((value) => {
        if (!cancelled && !settled) {
          settled = true;
          clearTimeout(timer);
          setAvailability(['available', 'downloadable', 'downloading', 'unavailable'].includes(value) ? value : 'unavailable');
        }
      }).catch(() => {
        if (!cancelled && !settled) {
          settled = true;
          clearTimeout(timer);
          setAvailability('unavailable');
          setError('The browser could not check its local model. You can check again or use source search.');
        }
      });
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
      mounted.current = false;
      load.current?.abort();
      session.current?.destroy();
      session.current = null;
    };
  }, [checkAttempt]);

  function stop() {
    load.current?.abort();
    load.current = null;
    session.current?.destroy();
    session.current = null;
    setPhase('idle');
    setProgress(null);
    setError('');
  }

  function enable() {
    load.current?.abort();
    session.current?.destroy();
    session.current = null;
    const controller = new AbortController();
    load.current = controller;
    setPhase('loading');
    setProgress(null);
    setError('');
    let pending: Promise<BrowserSession>;
    try {
      pending = createNativeSession(controller.signal, (value) => {
        if (mounted.current && load.current === controller) setProgress(value);
      });
    } catch (reason) {
      pending = Promise.reject(reason);
    }
    void pending.then((value) => {
      if (!mounted.current || controller.signal.aborted || load.current !== controller) {
        value.destroy();
        return;
      }
      session.current = value;
      setAvailability('available');
      setPhase('ready');
    }).catch((reason: unknown) => {
      if (mounted.current && !controller.signal.aborted && load.current === controller) {
        setError(reason instanceof Error ? reason.message : 'Local AI could not start. You can retry or use search.');
        setPhase('error');
      }
    });
  }

  return { availability, phase, progress, error, session, enable, stop, retryAvailability: () => setCheckAttempt((value) => value + 1) };
}
