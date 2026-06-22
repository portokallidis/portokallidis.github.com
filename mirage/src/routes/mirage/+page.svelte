<svelte:head>
  <title>Mirage — Webcam Demos</title>
  <meta name="description" content="Webcam face blur + text-region redaction, all on-device via BlazeFace + WebGPU." />
</svelte:head>

<section class="hero">
  <h1>Mirage <span class="dim small mono">/ webcam</span></h1>
  <p class="subtitle">
    Face detection runs in a Web Worker via MediaPipe Tasks Vision + BlazeFace short-range.
    Frames never leave the browser. Choose face or text blur, click start, watch the protected
    view lag the raw view by zero frames.
  </p>
</section>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { FaceDetectorClient } from '$lib/ai/face-detector.client';
  import { TextDetectorClient } from '$lib/ai/text-detector.client';
  import FpsMeter from '$lib/components/FpsMeter.svelte';

  let mode: 'face' | 'text' = $state('face');
  let running = $state(false);
  let statusText = $state('idle');
  let error = $state<string | null>(null);

  let video: HTMLVideoElement;
  let canvas: HTMLCanvasElement;
  let stream: MediaStream | null = null;
  let rafId: number | null = null;
  let fps = $state(0);
  let lastFrameTs = 0;
  let frameCount = 0;

  const faceClient = new FaceDetectorClient();
  const textClient = new TextDetectorClient();
  let boxes = $state<Array<{ x: number; y: number; width: number; height: number }>>([]);

  onDestroy(() => stop());

  async function start() {
    if (!browser || running) return;
    error = null;
    statusText = 'requesting camera…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      statusText = 'loading model…';
      running = true;
      statusText = mode === 'face' ? 'detecting faces…' : 'detecting text…';
      loop();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      statusText = 'error';
    }
  }

  function stop() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    }
    if (video) video.srcObject = null;
    faceClient.close();
    textClient.close();
    running = false;
    statusText = 'idle';
  }

  function loop() {
    if (!running || !video || !canvas) return;
    rafId = requestAnimationFrame(loop);

    const now = performance.now();
    if (lastFrameTs && now - lastFrameTs >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFrameTs = now;
    } else if (!lastFrameTs) {
      lastFrameTs = now;
    }
    frameCount += 1;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    // Run detection on a snapshot
    if (mode === 'face') {
      faceClient.detect(canvas, now).then((result) => {
        boxes = result;
      }).catch((e) => {
        error = e instanceof Error ? e.message : String(e);
      });
    } else {
      textClient.detect(canvas, w, h).then((result) => {
        boxes = result.boxes;
      }).catch((e) => {
        error = e instanceof Error ? e.message : String(e);
      });
    }

    // Draw blur over detected regions
    for (const b of boxes) {
      const px = Math.max(0, Math.floor(b.x));
      const py = Math.max(0, Math.floor(b.y));
      const pw = Math.min(w - px, Math.floor(b.width));
      const ph = Math.min(h - py, Math.floor(b.height));
      if (pw <= 0 || ph <= 0) continue;
      const imgData = ctx.getImageData(px, py, pw, ph);
      // Heavy pixelation = 16x blocks
      const block = 16;
      for (let y = 0; y < ph; y += block) {
        for (let x = 0; x < pw; x += block) {
          let r = 0, g = 0, bch = 0, n = 0;
          for (let yy = 0; yy < block && y + yy < ph; yy++) {
            for (let xx = 0; xx < block && x + xx < pw; xx++) {
              const i = ((y + yy) * pw + (x + xx)) * 4;
              r += imgData.data[i];
              g += imgData.data[i + 1];
              bch += imgData.data[i + 2];
              n++;
            }
          }
          r = Math.floor(r / n); g = Math.floor(g / n); bch = Math.floor(bch / n);
          for (let yy = 0; yy < block && y + yy < ph; yy++) {
            for (let xx = 0; xx < block && x + xx < pw; xx++) {
              const i = ((y + yy) * pw + (x + xx)) * 4;
              imgData.data[i] = r;
              imgData.data[i + 1] = g;
              imgData.data[i + 2] = bch;
            }
          }
        }
      }
      ctx.putImageData(imgData, px, py);
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);
    }
  }
</script>

<div class="card">
  <div class="row gap-2" style="margin-bottom: 1rem;">
    <button onclick={() => mode = 'face'} class:primary={mode === 'face'}>face blur</button>
    <button onclick={() => mode = 'text'} class:primary={mode === 'text'}>text-region blur</button>
    <span class="dim mono" style="margin-left: auto;">{statusText}</span>
    <FpsMeter label="fps" value={fps} />
    {#if !running}
      <button class="primary" onclick={start}>start camera</button>
    {:else}
      <button class="ghost" onclick={stop}>stop</button>
    {/if}
  </div>

  <div class="views">
    <div class="view">
      <h4>raw</h4>
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} muted playsinline></video>
    </div>
    <div class="view">
      <h4>protected</h4>
      <canvas bind:this={canvas}></canvas>
    </div>
  </div>

  {#if error}
    <div class="card err" style="margin-top: 1rem;">
      <strong>Error:</strong> {error}
    </div>
  {/if}
</div>

<style>
  .views {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .view {
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.4);
  }
  .view h4 {
    margin-bottom: 0.4rem;
    text-transform: uppercase;
    font-size: 0.7rem;
  }
  .view video, .view canvas {
    width: 100%;
    display: block;
    background: #000;
    border-radius: 4px;
  }
  @media (max-width: 720px) {
    .views { grid-template-columns: 1fr; }
  }
</style>