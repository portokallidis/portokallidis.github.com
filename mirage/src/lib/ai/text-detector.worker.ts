/**
 * Text-region detector — algorithmic edge-density text-region detector.
 * No ML model. Runs in a Web Worker.
 *
 * Algorithm:
 *  1. Downsample to 320×240 grayscale
 *  2. Sobel-X edge magnitude per pixel
 *  3. Sum edges per row → vertical profile
 *  4. Find rows where profile > threshold (text rows)
 *  5. Group consecutive text rows into text "bands"
 *  6. For each band, find horizontal extents by column projection
 *  7. Return boxes in original-frame coordinates
 *
 * Why no ML: a 10MB+ Tesseract traineddata bloat the bundle for what's
 * a detection-only use case (we just need the bounding boxes of likely
 * text regions, not OCR).
 */

export type TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

type DetectMessage = {
  type: 'detect';
  id: number;
  bitmap: ImageBitmap;
  width: number;
  height: number;
};

type WorkerInbound = DetectMessage;

type ResultMessage = { type: 'result'; id: number; boxes: TextBox[]; inferenceMs: number };
type ErrorMessage = { type: 'error'; id: number; message: string };

type WorkerOutbound = ResultMessage | ErrorMessage;

const TARGET_WIDTH = 320;
const TARGET_HEIGHT = 240;
const EDGE_THRESHOLD = 28;
const ROW_MIN_EDGES = 8;
const MIN_BAND_HEIGHT = 6;
const MIN_BAND_WIDTH = 24;
const MERGE_GAP = 4;

function detectTextRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number
): TextBox[] {
  // Step 1+2: build a single-pass edge + row-profile.
  const rowProfile = new Float32Array(height);
  for (let y = 1; y < height - 1; y++) {
    let rowSum = 0;
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -data[i - width - 1] + data[i - width + 1] +
        -2 * data[i - 1] + 2 * data[i + 1] +
        -data[i + width - 1] + data[i + width + 1];
      const gy =
        -data[i - width - 1] - 2 * data[i - width] - data[i - width + 1] +
        data[i + width - 1] + 2 * data[i + width] + data[i + width + 1];
      const mag = Math.abs(gx) + Math.abs(gy);
      if (mag > EDGE_THRESHOLD) rowSum += 1;
    }
    rowProfile[y] = rowSum;
  }

  // Step 3+4: find text bands (groups of consecutive text rows).
  const bands: Array<{ yStart: number; yEnd: number }> = [];
  let inBand = false;
  let bandStart = 0;
  for (let y = 0; y < height; y++) {
    const isText = rowProfile[y] >= ROW_MIN_EDGES;
    if (isText && !inBand) {
      bandStart = y;
      inBand = true;
    } else if (!isText && inBand) {
      if (y - bandStart >= MIN_BAND_HEIGHT) {
        bands.push({ yStart: bandStart, yEnd: y });
      }
      inBand = false;
    }
  }
  if (inBand && height - bandStart >= MIN_BAND_HEIGHT) {
    bands.push({ yStart: bandStart, yEnd: height });
  }

  // Step 5+6: for each band, find horizontal extents via column projection.
  const boxes: TextBox[] = [];
  for (const band of bands) {
    const colProfile = new Float32Array(width);
    for (let y = band.yStart; y < band.yEnd; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const left = data[i - 1] ?? 0;
        const right = data[i + 1] ?? 0;
        const top = data[i - width] ?? 0;
        const bottom = data[i + width] ?? 0;
        if (Math.abs(left - right) > EDGE_THRESHOLD || Math.abs(top - bottom) > EDGE_THRESHOLD) {
          colProfile[x] += 1;
        }
      }
    }
    // Group consecutive text columns.
    let colStart = 0;
    let inCol = false;
    for (let x = 0; x < width; x++) {
      const isColText = colProfile[x] >= 2;
      if (isColText && !inCol) {
        colStart = x;
        inCol = true;
      } else if (!isColText && inCol) {
        const w = x - colStart;
        if (w >= MIN_BAND_WIDTH) {
          boxes.push({
            x: colStart,
            y: band.yStart,
            width: w,
            height: band.yEnd - band.yStart,
            confidence: Math.min(1, (w / 100) * (band.yEnd - band.yStart) / 20)
          });
        }
        inCol = false;
      }
    }
    if (inCol && width - colStart >= MIN_BAND_WIDTH) {
      boxes.push({
        x: colStart,
        y: band.yStart,
        width: width - colStart,
        height: band.yEnd - band.yStart,
        confidence: 0.5
      });
    }
  }

  // Step 7: merge boxes that are within MERGE_GAP pixels of each other.
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: TextBox[] = [];
  for (const box of boxes) {
    const last = merged[merged.length - 1];
    if (
      last &&
      box.y - (last.y + last.height) <= MERGE_GAP &&
      box.x - (last.x + last.width) <= MERGE_GAP * 4
    ) {
      const x = Math.min(last.x, box.x);
      const y = Math.min(last.y, box.y);
      const right = Math.max(last.x + last.width, box.x + box.width);
      const bottom = Math.max(last.y + last.height, box.y + box.height);
      last.x = x;
      last.y = y;
      last.width = right - x;
      last.height = bottom - y;
      last.confidence = Math.max(last.confidence, box.confidence);
    } else {
      merged.push({ ...box });
    }
  }
  return merged;
}

self.addEventListener('message', (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;
  if (msg.type !== 'detect') return;
  const { id, bitmap } = msg;
  const start = performance.now();
  try {
    const off = new OffscreenCanvas(TARGET_WIDTH, TARGET_HEIGHT);
    const ctx = off.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    ctx.drawImage(bitmap, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
    const imageData = ctx.getImageData(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
    const gray = new Uint8ClampedArray(imageData.data.length / 4);
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      // ITU-R BT.601 luma
      gray[j] = (imageData.data[i] * 299 + imageData.data[i + 1] * 587 + imageData.data[i + 2] * 114) / 1000;
    }
    const detected = detectTextRegions(gray, TARGET_WIDTH, TARGET_HEIGHT);
    // Scale boxes back to original frame coordinates.
    const scaleX = bitmap.width / TARGET_WIDTH;
    const scaleY = bitmap.height / TARGET_HEIGHT;
    const boxes: TextBox[] = detected.map((b) => ({
      x: Math.round(b.x * scaleX),
      y: Math.round(b.y * scaleY),
      width: Math.round(b.width * scaleX),
      height: Math.round(b.height * scaleY),
      confidence: b.confidence
    }));
    postMessage({
      type: 'result',
      id,
      boxes,
      inferenceMs: performance.now() - start
    } satisfies WorkerOutbound);
  } catch (err) {
    postMessage({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err)
    } satisfies WorkerOutbound);
  } finally {
    bitmap.close();
  }
});
