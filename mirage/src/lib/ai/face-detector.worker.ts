/**
 * Face detector — MediaPipe Tasks Vision + BlazeFace short-range, running
 * in a Web Worker. Pull-based: each `detect(bitmap)` returns the boxes
 * found in that frame.
 *
 * Why this exists: a portfolio page that demonstrates face detection
 * without ALSO showing where the frames go would be misleading. By
 * running detection off the main thread, the page stays interactive
 * and the user can verify in DevTools that no frames leave the device.
 */

import type { FaceBox } from './face-detector.shared';

import {
  close,
  init as initShared,
  detect as detectShared
} from './face-detector.shared';

export type { FaceBox };

type InitMessage = { type: 'init'; modelUrl: string };
type DetectMessage = { type: 'detect'; id: number; bitmap: ImageBitmap; timestamp: number };
type CloseMessage = { type: 'close' };

type WorkerInbound = InitMessage | DetectMessage | CloseMessage;

type ReadyMessage = { type: 'ready' };
type ResultMessage = { type: 'result'; id: number; boxes: FaceBox[] };
type ErrorMessage = { type: 'error'; id?: number; message: string };

type WorkerOutbound = ReadyMessage | ResultMessage | ErrorMessage;

self.addEventListener('message', async (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;
  if (msg.type === 'init') {
    try {
      await initShared(msg.modelUrl);
      postMessage({ type: 'ready' } satisfies WorkerOutbound);
    } catch (err) {
      postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err)
      } satisfies WorkerOutbound);
    }
    return;
  }
  if (msg.type === 'detect') {
    try {
      const boxes = await detectShared(msg.bitmap, msg.timestamp);
      postMessage({
        type: 'result',
        id: msg.id,
        boxes
      } satisfies WorkerOutbound);
    } catch (err) {
      postMessage({
        type: 'error',
        id: msg.id,
        message: err instanceof Error ? err.message : String(err)
      } satisfies WorkerOutbound);
    } finally {
      msg.bitmap.close();
    }
    return;
  }
  if (msg.type === 'close') {
    close();
    (self as unknown as { close: () => void }).close();
  }
});