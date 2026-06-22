/**
 * Text-region detector client. Same pull-based protocol as face detector.
 */

export type TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

type WorkerResponse = { type: 'result'; id: number; boxes: TextBox[]; inferenceMs: number }
  | { type: 'error'; id: number; message: string };

type PendingDetection = {
  resolve: (value: { boxes: TextBox[]; inferenceMs: number }) => void;
  reject: (error: Error) => void;
};

export class TextDetectorClient {
  #worker: Worker | null = null;
  #pending = new Map<number, PendingDetection>();
  #nextId = 1;

  init() {
    if (typeof Worker === 'undefined') {
      return Promise.reject(new Error('Workers are not available in this browser'));
    }
    if (this.#worker) return Promise.resolve();
    this.#worker = new Worker(new URL('./text-detector.worker.ts', import.meta.url), {
      type: 'module'
    });
    this.#worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const pending = this.#pending.get(msg.id);
      if (!pending) return;
      this.#pending.delete(msg.id);
      if (msg.type === 'result') {
        pending.resolve({ boxes: msg.boxes, inferenceMs: msg.inferenceMs });
      } else {
        pending.reject(new Error(msg.message));
      }
    });
    return Promise.resolve();
  }

  async detect(source: ImageBitmapSource, width: number, height: number) {
    await this.init();
    if (!this.#worker) throw new Error('Text detector worker is not available');
    const id = this.#nextId++;
    const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);
    return new Promise<{ boxes: TextBox[]; inferenceMs: number }>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#worker?.postMessage({ type: 'detect', id, bitmap, width, height }, [bitmap]);
    });
  }

  close() {
    for (const pending of this.#pending.values()) {
      pending.reject(new Error('Text detector closed'));
    }
    this.#pending.clear();
    this.#worker?.terminate();
    this.#worker = null;
  }
}