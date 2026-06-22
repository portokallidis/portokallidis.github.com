import type { FaceBox } from './face-detector.worker';

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; id: number; boxes: FaceBox[] }
  | { type: 'error'; id?: number; message: string };

type PendingDetection = {
  resolve: (boxes: FaceBox[]) => void;
  reject: (error: Error) => void;
};

export class FaceDetectorClient {
  #worker: Worker | null = null;
  #pending = new Map<number, PendingDetection>();
  #ready: Promise<void> | null = null;
  #nextId = 1;

  init() {
    if (typeof Worker === 'undefined') {
      return Promise.reject(new Error('Workers are not available in this browser'));
    }

    if (this.#ready) return this.#ready;

    this.#worker = new Worker(new URL('./face-detector.worker.ts', import.meta.url), {
      type: 'module'
    });

    this.#ready = new Promise<void>((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'ready') {
          resolve();
          return;
        }

        if (event.data.type === 'error' && event.data.id === undefined) {
          reject(new Error(event.data.message));
          return;
        }

        this.#handleWorkerMessage(event.data);
      };

      this.#worker?.addEventListener('message', onMessage);
      this.#worker?.postMessage({ type: 'init', modelUrl: '/models/blaze_face_short_range.tflite' });
    });

    return this.#ready;
  }

  async detect(source: ImageBitmapSource, timestamp = performance.now()) {
    await this.init();
    if (!this.#worker) throw new Error('Face detector worker is not available');

    const id = this.#nextId++;
    const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);

    return new Promise<FaceBox[]>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#worker?.postMessage({ type: 'detect', id, bitmap, timestamp }, [bitmap]);
    });
  }

  close() {
    for (const pending of this.#pending.values()) {
      pending.reject(new Error('Face detector closed'));
    }
    this.#pending.clear();
    this.#worker?.postMessage({ type: 'close' });
    this.#worker = null;
    this.#ready = null;
  }

  #handleWorkerMessage(message: WorkerResponse) {
    if (message.type === 'result') {
      const pending = this.#pending.get(message.id);
      this.#pending.delete(message.id);
      pending?.resolve(message.boxes);
      return;
    }

    if (message.type === 'error' && message.id !== undefined) {
      const pending = this.#pending.get(message.id);
      this.#pending.delete(message.id);
      pending?.reject(new Error(message.message));
    }
  }
}
