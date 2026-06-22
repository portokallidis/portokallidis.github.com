<script lang="ts">
  import { detectCapabilities } from '$lib/capability/detect';
  import { privacyStore } from '$lib/privacy/store.svelte';

  let { open, onClose }: { open: boolean; onClose: () => void } = $props();
  let capabilities = $state(detectCapabilities());

  $effect(() => {
    if (open) capabilities = detectCapabilities();
  });
</script>

{#if open}
  <div class="backdrop" role="presentation" onclick={onClose}></div>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section class="modal" role="dialog" aria-modal="true" aria-label="Inspect AI dashboard">
    <header class="row between gap-2">
      <div>
        <p class="badge accent">inspect ai</p>
        <h2>Runtime evidence</h2>
      </div>
      <button onclick={onClose}>close</button>
    </header>

    <div class="grid compact">
      <div class="card">
        <h3>Capabilities</h3>
        <p>WebGPU: <strong>{capabilities.webgpu ? 'yes' : 'no'}</strong></p>
        <p>WASM: <strong>{capabilities.wasm ? 'yes' : 'no'}</strong></p>
        <p>SIMD: <strong>{capabilities.simd ? 'yes' : 'no'}</strong></p>
        <p>Threads: <strong>{capabilities.threads ? 'yes' : 'no'}</strong></p>
        <p>CPU threads: <strong>{capabilities.hardwareConcurrency}</strong></p>
        <p>Memory: <strong>{capabilities.deviceMemory ?? 'unknown'} GB</strong></p>
      </div>
      <div class="card">
        <h3>Models</h3>
        <p>Face: <strong>{privacyStore.modelStatus.face}</strong></p>
        <p>Text: <strong>{privacyStore.modelStatus.text}</strong></p>
        <p>LLM: <strong>{privacyStore.modelStatus.llm}</strong></p>
        <p class="dim">{privacyStore.modelStatus.message}</p>
      </div>
      <div class="card">
        <h3>Network Guard</h3>
        <p>Total requests: <strong>{privacyStore.requests.total}</strong></p>
        <p>Allowed: <strong>{privacyStore.requests.allowed}</strong></p>
        <p>Blocked: <strong>{privacyStore.requests.blocked}</strong></p>
        <p>Uploaded: <strong>{privacyStore.uploadedBytes}</strong> bytes</p>
      </div>
    </div>

    <div class="card log">
      <div class="row between">
        <h3>Last guard events</h3>
        <button onclick={() => privacyStore.clearLog()}>clear</button>
      </div>
      {#if privacyStore.log.length === 0}
        <p class="dim">No guarded network calls yet.</p>
      {:else}
        <table>
          <thead><tr><th>kind</th><th>method</th><th>status</th><th>url</th></tr></thead>
          <tbody>
            {#each privacyStore.log.slice(0, 12) as entry}
              <tr class:blocked={!entry.allowed}>
                <td>{entry.kind}</td>
                <td>{entry.method ?? '-'}</td>
                <td>{entry.allowed ? 'allowed' : 'blocked'}</td>
                <td>{entry.url}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </section>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(0, 0, 0, 0.65);
  }
  .modal {
    position: fixed;
    z-index: 100;
    top: 5vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(960px, calc(100vw - 1.6rem));
    max-height: 90vh;
    overflow: auto;
    background: var(--bg-elev);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
    padding: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .compact { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .log { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 0.72rem; }
  th, td { text-align: left; border-bottom: 1px solid var(--border); padding: 0.45rem; vertical-align: top; }
  td:last-child { max-width: 480px; overflow-wrap: anywhere; }
  tr.blocked td { color: var(--err); }
</style>
