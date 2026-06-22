<svelte:head>
  <title>Shredder — Mirage</title>
  <meta name="description" content="PII / secret detector with 18 rule families and Luhn validation." />
</svelte:head>

<section class="hero">
  <h1>Shredder</h1>
  <p class="subtitle">Paste any text. Detect PII and secrets: emails, phones (international + Greek), credit cards (Luhn-validated), API keys, IBANs, Greek AFM, URLs with embedded credentials, and more.</p>
</section>

<script lang="ts">
  import { detectPII, redactFindings, RULE_LABELS } from '$lib/demos/shredder/rules';

  let input = $state(`Hello, you can reach me at portokallidis@gmail.com or call +30 6946 985 370.
My AWS key is AKIAIOSFODNN7EXAMPLE and my GitHub token is ghp_16C7e42F292c6912E7710c838347Ae178B4a7e.
Card on file: 4111 1111 1111 1111 (expires 12/29).
Server: 192.168.1.42, backup at https://admin:hunter2@db.internal.example.com/api.
Greek tax ID: 090000043 (AFM).`);
  let findings = $derived(detectPII(input));
  let redacted = $derived(redactFindings(input, findings));
  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(redacted);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (e) {
      console.error('copy failed', e);
    }
  }
</script>

<div class="grid" style="grid-template-columns: 1fr 1fr;">
  <div class="card">
    <h3>Input <span class="dim mono small">({input.length} chars)</span></h3>
    <textarea bind:value={input} rows="14"></textarea>
    <p class="dim small" style="margin-top: 0.5rem;">
      {RULE_LABELS.length} rule families loaded.
    </p>
  </div>

  <div class="card">
    <div class="row between" style="margin-bottom: 0.5rem;">
      <h3>Findings <span class="dim mono small">({findings.length})</span></h3>
      <button onclick={copy} disabled={findings.length === 0}>{copied ? '✓ copied' : 'copy redacted'}</button>
    </div>
    {#if findings.length === 0}
      <p class="dim">No findings yet.</p>
    {:else}
      <div class="findings">
        {#each findings as f}
          <div class="finding">
            <div class="row between">
              <strong>{f.label}</strong>
              <span class="badge">{(f.confidence * 100).toFixed(0)}%</span>
            </div>
            <div class="mono small">
              <span class="dim">{f.start}:{f.end}</span> · <code>{f.redacted}</code>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<div class="card" style="margin-top: 1rem;">
  <h3>Redacted</h3>
  <pre><code>{redacted}</code></pre>
</div>

<style>
  .findings { display: flex; flex-direction: column; gap: 0.4rem; max-height: 360px; overflow-y: auto; }
  .finding { padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; background: rgba(0, 0, 0, 0.2); }
  .small { font-size: 0.78rem; }
</style>