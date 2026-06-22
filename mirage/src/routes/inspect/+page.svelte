<svelte:head>
  <title>Inspect — Mirage</title>
  <meta name="description" content="Live privacy and runtime telemetry dashboard." />
</svelte:head>

<section class="hero">
  <h1>Inspect AI</h1>
  <p class="subtitle">Live runtime telemetry and privacy guard log. Click the dot in the navigation bar for the modal version.</p>
</section>

<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { privacyStore } from '$lib/privacy/store.svelte';
  import { detectCapabilities } from '$lib/capability/detect';

  let caps = $state<ReturnType<typeof detectCapabilities> | null>(null);

  onMount(() => {
    if (browser) {
      caps = detectCapabilities();
    }
  });

  function formatBytes(n: number): string {
    if (n === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }
</script>

<div class="grid">
  <div class="card">
    <h3>Capabilities</h3>
    <table>
      <tbody>
        <tr><td>WebGPU</td><td class="mono">{caps?.webgpu ? '✓' : '✗'}</td></tr>
        <tr><td>WASM</td><td class="mono">{caps?.wasm ? '✓' : '✗'}</td></tr>
        <tr><td>SIMD</td><td class="mono">{caps?.simd ? '✓' : '✗'}</td></tr>
        <tr><td>Threads</td><td class="mono">{caps?.threads ? '✓' : '✗'}</td></tr>
        <tr><td>CPU cores</td><td class="mono">{caps?.hardwareConcurrency ?? '?'}</td></tr>
        <tr><td>Memory</td><td class="mono">{caps?.deviceMemory ?? '?'} GB</td></tr>
        <tr><td>Screen</td><td class="mono">{caps?.screen.width}×{caps?.screen.height}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h3>Models</h3>
    <p>Face: <strong class="mono">{privacyStore.modelStatus.face}</strong></p>
    <p>Text: <strong class="mono">{privacyStore.modelStatus.text}</strong></p>
    <p>LLM: <strong class="mono">{privacyStore.modelStatus.llm}</strong></p>
    {#if privacyStore.modelStatus.loadingFor}
      <p class="dim small mono">loading: {privacyStore.modelStatus.loadingFor}</p>
    {/if}
    <p class="dim small">{privacyStore.modelStatus.message}</p>
  </div>

  <div class="card">
    <h3>Privacy guard</h3>
    <p>Installed: <strong>{privacyStore.installed ? 'yes' : 'no'}</strong></p>
    <p>Requests: <strong class="mono">{privacyStore.requests.total}</strong></p>
    <p>Blocked: <strong class="mono" class:err={privacyStore.requests.blocked > 0}>{privacyStore.requests.blocked}</strong></p>
    <p>Uploaded: <strong class="mono">{formatBytes(privacyStore.uploadedBytes)}</strong></p>
    <p>Allow-rate: <strong class="mono">{(privacyStore.allowedRate * 100).toFixed(1)}%</strong></p>
    <button onclick={() => privacyStore.clearLog()} class="ghost" style="margin-top: 0.5rem;">clear log</button>
  </div>
</div>

<div class="card" style="margin-top: 1rem;">
  <h3>Recent network log <span class="dim mono small">({privacyStore.log.length})</span></h3>
  {#if privacyStore.log.length === 0}
    <p class="dim">No guarded network calls yet. Open a demo to generate traffic.</p>
  {:else}
    <table>
      <thead><tr><th>kind</th><th>method</th><th>status</th><th>url</th></tr></thead>
      <tbody>
        {#each privacyStore.log.slice(0, 20) as entry}
          <tr class:blocked={!entry.allowed}>
            <td class="mono">{entry.kind}</td>
            <td class="mono">{entry.method ?? '-'}</td>
            <td class="mono">{entry.status ?? (entry.allowed ? 'allowed' : 'BLOCKED')}</td>
            <td class="mono small">{entry.url}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  table { width: 100%; font-size: 0.85rem; border-collapse: collapse; }
  table th, table td { text-align: left; padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--border); }
  table th { color: var(--text-dim); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
  table tr.blocked { background: rgba(255, 85, 119, 0.04); }
  .small { font-size: 0.75rem; }
  .err { color: var(--err); }
</style>