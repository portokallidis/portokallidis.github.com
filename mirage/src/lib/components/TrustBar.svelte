<script lang="ts">
  import { privacyStore } from '$lib/privacy/store.svelte';
</script>

<section class="trust" aria-label="Privacy posture">
  <div class="trust-inner">
    <span class="badge accent">local-first</span>
    <span>guard {privacyStore.installed ? 'armed' : 'pending'}</span>
    <span>{privacyStore.requests.blocked} blocked</span>
    <span>{Math.round(privacyStore.allowedRate * 100)}% allowed by policy</span>
    <span>{Math.round(privacyStore.uploadedBytes / 1024)} KB upload surface</span>
  </div>
</section>

<style>
  .trust {
    border-bottom: 1px solid var(--border);
    background: rgba(0, 255, 200, 0.035);
  }
  .trust-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0.45rem 1.2rem;
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: center;
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--text-dim);
  }
</style>
