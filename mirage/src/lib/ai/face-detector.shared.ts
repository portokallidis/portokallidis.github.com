/**
 * Shared face-detector logic — imported by both the worker entry point
 * and unit tests. Owns the MediaPipe FaceDetector singleton so init/detect
 * can be called from either context.
 */

import type {
  FaceDetector as MediaPipeFaceDetector,
  FaceDetectorResult
} from '@mediapipe/tasks-vision';

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

let detector: MediaPipeFaceDetector | null = null;
let initPromise: Promise<MediaPipeFaceDetector> | null = null;

export async function init(modelUrl: string): Promise<MediaPipeFaceDetector> {
  if (detector) return detector;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
    );
    detector = await FaceDetector.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5
    });
    return detector;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export async function detect(
  bitmap: ImageBitmap,
  timestamp: number
): Promise<FaceBox[]> {
  if (!detector) throw new Error('Face detector not initialized — call init() first');
  const result: FaceDetectorResult = detector.detectForVideo(bitmap, timestamp);
  return (result.detections ?? [])
    .map((d) => {
      const bb = d.boundingBox;
      return bb ? { x: bb.originX, y: bb.originY, width: bb.width, height: bb.height } : null;
    })
    .filter((b): b is FaceBox => b !== null);
}

export function close() {
  detector?.close();
  detector = null;
}

export function isInitialized(): boolean {
  return detector !== null;
}