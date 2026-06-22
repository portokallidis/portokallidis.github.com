export type GuardKind = 'fetch' | 'xhr' | 'websocket' | 'eventsource' | 'beacon' | 'image';

export type GuardEvent = {
  id: number;
  ts: number;
  kind: GuardKind;
  url: string;
  method?: string;
  allowed: boolean;
  status?: number;
  uploadBytes?: number;
  reason?: string;
};

export type ModelStatus = {
  face: 'idle' | 'loading' | 'ready' | 'error';
  text: 'idle' | 'loading' | 'ready' | 'error';
  llm: 'idle' | 'loading' | 'ready' | 'error';
  loadingFor: string | null;
  message: string;
};

const MAX_LOG_ENTRIES = 500;

export class PrivacyStore {
  installed = $state(false);
  modelStatus = $state<ModelStatus>({
    face: 'idle',
    text: 'idle',
    llm: 'idle',
    loadingFor: null,
    message: 'Models load only after an explicit local action.'
  });
  fps = $state({ face: 0, text: 0, camera: 0 });
  requests = $state({ total: 0, allowed: 0, blocked: 0 });
  blocked = $state({ total: 0, byKind: {} as Record<GuardKind, number> });
  uploadedBytes = $state(0);
  log = $state<GuardEvent[]>([]);

  allowedRate = $derived(
    this.requests.total === 0 ? 1 : this.requests.allowed / this.requests.total
  );

  recentBlocked = $derived(this.log.filter((entry) => !entry.allowed).slice(0, 12));

  markInstalled(value = true) {
    this.installed = value;
  }

  setModelStatus(update: Partial<ModelStatus>) {
    this.modelStatus = { ...this.modelStatus, ...update };
  }

  setFps(kind: keyof typeof this.fps, value: number) {
    this.fps[kind] = Math.max(0, Math.round(value));
  }

  addGuardEvent(event: GuardEvent) {
    this.requests.total += 1;
    if (event.allowed) {
      this.requests.allowed += 1;
    } else {
      this.requests.blocked += 1;
      this.blocked.total += 1;
      this.blocked.byKind[event.kind] = (this.blocked.byKind[event.kind] ?? 0) + 1;
    }

    if (event.uploadBytes) {
      this.uploadedBytes += event.uploadBytes;
    }

    this.log = [event, ...this.log].slice(0, MAX_LOG_ENTRIES);
  }

  clearLog() {
    this.requests = { total: 0, allowed: 0, blocked: 0 };
    this.blocked = { total: 0, byKind: {} as Record<GuardKind, number> };
    this.uploadedBytes = 0;
    this.log = [];
  }
}

export const privacyStore = new PrivacyStore();
