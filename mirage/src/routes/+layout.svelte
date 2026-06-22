<script lang="ts">
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';
  import TrustBar from '$lib/components/TrustBar.svelte';
  import InspectAI from '$lib/components/InspectAI.svelte';
  import '$lib/privacy/guard';
  import { privacyStore } from '$lib/privacy/store.svelte';

  let { children } = $props();
</script>

<Nav />
<TrustBar />

<main>
  {@render children?.()}
</main>

<InspectAI open={privacyStore.inspectorOpen} onClose={() => privacyStore.closeInspector()} />

<footer class="footer">
  <div class="row between" style="max-width: 1100px; margin: 0 auto; padding: 0 1.2rem;">
    <div class="dim mono" style="font-size: 0.75rem;">
      © 2026 Nick Portokallidis · Built with SvelteKit + on-device AI
    </div>
    <div class="dim mono" style="font-size: 0.75rem;">
      <a href="https://github.com/portokallidis/portokallidis.github.com" target="_blank" rel="noopener">source</a>
      <span class="faint"> · </span>
      <a href="/inspect">inspect</a>
    </div>
  </div>
</footer>

<style>
  .footer {
    border-top: 1px solid var(--border);
    padding: 1.2rem 0;
    margin-top: 4rem;
  }
</style>