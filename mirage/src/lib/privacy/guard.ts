import { privacyStore, type GuardEvent, type GuardKind } from './store.svelte';

type XhrMeta = {
  method: string;
  url: string;
};

type GuardedXhr = XMLHttpRequest & {
  _mirage?: XhrMeta;
};

const allowList: RegExp[] = [
  /^https:\/\/(?:www\.)?nporto\.com(?::\d+)?/i,
  /^https:\/\/portokallidis\.github\.io/i,
  /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i,
  /^https:\/\/cdn\.jsdelivr\.net\//i,
  /^https:\/\/huggingface\.co\//i,
  /^https:\/\/cas-bridge\.xethub\.hf\.co\//i,
  /^https:\/\/[a-z0-9-]+\.xethub\.hf\.co\//i,
  /^https:\/\/storage\.googleapis\.com\/mediapipe-models\//i
];

let _installed = false;
let _id = 0;

function log(event: GuardEvent) {
  privacyStore.addGuardEvent(event);
}

function currentOrigin() {
  return typeof window === 'undefined' ? 'https://nporto.com' : window.location.origin;
}

function normalizeUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isSameOriginBlob(value: string, origin = currentOrigin()) {
  try {
    const blobUrl = new URL(value);
    if (blobUrl.protocol !== 'blob:') return false;
    const inner = new URL(blobUrl.pathname);
    return inner.origin === origin;
  } catch {
    return false;
  }
}

function isLocalScheme(value: string) {
  return (
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('data:') ||
    value.startsWith('about:') ||
    value.startsWith('blob:')
  );
}

export function isAllowed(value: string | URL | Request) {
  const url = normalizeUrl(value);
  const origin = currentOrigin();

  if (isLocalScheme(url)) return true;

  try {
    const parsed = new URL(url, origin);
    if (parsed.origin === origin) return true;
    if (parsed.protocol === 'blob:') return isSameOriginBlob(parsed.href, origin);
    return allowList.some((rule) => rule.test(parsed.href));
  } catch {
    return false;
  }
}

function block(kind: GuardKind, url: string, method?: string): never {
  throw new DOMException(
    `[mirage-guard] Blocked ${kind} ${method ? `${method} ` : ''}${url} (not in allow-list)`,
    'SecurityError'
  );
}

function measureBody(body: unknown): number {
  if (!body) return 0;
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength;
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).byteLength;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    let total = 0;
    for (const [key, value] of body.entries()) {
      total += key.length;
      total += typeof value === 'string' ? value.length : value.size;
    }
    return total;
  }

  return 0;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function requestBody(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.body) return init.body;
  if (input instanceof Request) return input.body;
  return undefined;
}

export function installGuard() {
  if (typeof window === 'undefined' || _installed) return;

  _installed = true;
  privacyStore.markInstalled(true);

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = normalizeUrl(input instanceof Request ? input : input.toString());
    const method = requestMethod(input, init);
    const uploadBytes = measureBody(requestBody(input, init));
    const allowed = isAllowed(url);

    log({ id: ++_id, ts: Date.now(), kind: 'fetch', url, method, allowed, uploadBytes });
    if (!allowed) block('fetch', url, method);

    return originalFetch(input, init);
  };

  const xhrProto = XMLHttpRequest.prototype;
  const originalOpen = xhrProto.open;
  const originalSend = xhrProto.send;

  xhrProto.open = function (
    this: GuardedXhr,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    this._mirage = { method: method.toUpperCase(), url: url.toString() };
    return originalOpen.call(this, method, url, async ?? true, username, password);
  };

  xhrProto.send = function (this: GuardedXhr, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = this._mirage;
    const url = meta?.url ?? '<untracked XHR>';
    const method = meta?.method ?? 'UNKNOWN';
    const allowed = meta ? isAllowed(url) : true;
    const uploadBytes = measureBody(body);

    log({ id: ++_id, ts: Date.now(), kind: 'xhr', method, url, allowed, uploadBytes });
    if (!allowed) block('xhr', url, method);

    this.addEventListener('loadend', () => {
      log({
        id: ++_id,
        ts: Date.now(),
        kind: 'xhr',
        method,
        url,
        allowed: true,
        status: this.status
      });
    });

    return originalSend.call(this, body);
  };

  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = class GuardedWebSocket extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const href = url.toString();
      const allowed = isAllowed(href);
      log({ id: ++_id, ts: Date.now(), kind: 'websocket', url: href, allowed });
      if (!allowed) block('websocket', href);
      super(url, protocols);
    }
  };

  const OriginalEventSource = window.EventSource;
  window.EventSource = class GuardedEventSource extends OriginalEventSource {
    constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
      const href = url.toString();
      const allowed = isAllowed(href);
      log({ id: ++_id, ts: Date.now(), kind: 'eventsource', url: href, allowed });
      if (!allowed) block('eventsource', href);
      super(url, eventSourceInitDict);
    }
  };

  const originalBeacon = navigator.sendBeacon?.bind(navigator);
  if (originalBeacon) {
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      const href = url.toString();
      const allowed = isAllowed(href);
      log({
        id: ++_id,
        ts: Date.now(),
        kind: 'beacon',
        url: href,
        method: 'POST',
        allowed,
        uploadBytes: measureBody(data)
      });
      return allowed ? originalBeacon(url, data) : false;
    };
  }

  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const origGet = descriptor?.get;
  const origSet = descriptor?.set;
  if (origSet) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get(this: HTMLImageElement) {
        return origGet ? Reflect.apply(origGet, HTMLImageElement.prototype, []) : undefined;
      },
      set(this: HTMLImageElement, value: string) {
        const allowed = isAllowed(value);
        log({ id: ++_id, ts: Date.now(), kind: 'image', url: value, allowed });
        Reflect.apply(origSet, this, [value]);
      }
    });
  }
}

installGuard();
