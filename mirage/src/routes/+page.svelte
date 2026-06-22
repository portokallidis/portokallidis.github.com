<script lang="ts">
  import { privacyStore } from '$lib/privacy/store.svelte';

  const demos = [
    ['mirage', 'Face/text blur with browser workers and WebLLM narration.'],
    ['shredder', 'PII and secret redaction with 18 deterministic rules.'],
    ['auditor', 'Security scanner for JavaScript, Python, and Go snippets.'],
    ['threat', 'STRIDE matrix generator with shareable permalinks.'],
    ['resume', 'CV question-answering with citations and LLM fallback.'],
    ['recruiter', 'Voice interview loop: speech in, grounded answer out.'],
    ['inspect', 'Live guard, capabilities, model, and request telemetry.']
  ] as const;
</script>

<svelte:head>
  <title>Mirage: The On-Device AI Guardian</title>
  <meta name="description" content="Local-first AI/security portfolio by Nick Portokallidis." />
</svelte:head>

<section class="hero">
  <span class="badge accent">on-device ai guardian</span>
  <h1>Mirage turns portfolio claims into <span class="accent">inspectable runtime evidence</span>.</h1>
  <p class="subtitle">
    A SvelteKit portfolio for an AI-first full-stack engineer: browser computer vision, extractive RAG,
    security rule engines, STRIDE modeling, and a privacy guard that records every attempted egress.
  </p>
  <div class="row gap-2">
    <a class="btn primary" href="/mirage">launch mirage</a>
    <button onclick={() => privacyStore.openInspector()}>inspect guard</button>
  </div>
</section>

<section class="grid">
  {#each demos as [href, description]}
    <a class="demo-card" href={`/${href}`}>
      <span class="badge">demo</span>
      <h3>/{href}</h3>
      <p class="desc">{description}</p>
    </a>
  {/each}
</section>
