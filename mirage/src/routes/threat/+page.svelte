<svelte:head>
  <title>Threat Matrix — Mirage</title>
  <meta name="description" content="STRIDE threat matrix generator with shareable permalinks." />
</svelte:head>

<section class="hero">
  <h1>Threat Matrix</h1>
  <p class="subtitle">Pick an asset + a STRIDE category. Get a structured threat list with attack vectors and mitigations. Share a permalink to reproduce the exact view.</p>
</section>

<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { STRIDE, ASSETS, generateThreats, type AssetId, type StrideId } from '$lib/demos/threat/matrix';
  import { encodePermalink, decodePermalink } from '$lib/demos/threat/permalink';

  let asset = $state<AssetId>('web');
  let stride = $state<StrideId>('S');
  let threats = $derived(generateThreats(asset, stride));
  let permalink = $state('');

  function updatePermalink() {
    if (!browser) return;
    const encoded = encodePermalink(asset, stride);
    permalink = `${window.location.origin}/threat?p=${encoded}`;
  }

  function applyPermalink(p: string) {
    const decoded = decodePermalink(p);
    if (decoded) {
      asset = decoded.a as AssetId;
      stride = decoded.s as StrideId;
    }
  }

  $effect(() => {
    asset; stride;
    updatePermalink();
  });

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p');
    if (p) applyPermalink(p);
    else updatePermalink();
  });

  async function copyPermalink() {
    try {
      await navigator.clipboard.writeText(permalink);
    } catch (e) {
      console.error('copy failed', e);
    }
  }
</script>

<div class="card">
  <div class="row gap-2" style="flex-wrap: wrap;">
    <label class="col" style="flex: 1; min-width: 240px;">
      <span class="dim small mono">asset</span>
      <select bind:value={asset}>
        {#each ASSETS as a}
          <option value={a.id}>{a.name}</option>
        {/each}
      </select>
    </label>
    <label class="col" style="flex: 1; min-width: 240px;">
      <span class="dim small mono">stride</span>
      <select bind:value={stride}>
        {#each STRIDE as s}
          <option value={s.id}>{s.id} — {s.name}</option>
        {/each}
      </select>
    </label>
    <div class="col" style="flex: 2; min-width: 280px;">
      <span class="dim small mono">permalink</span>
      <div class="row gap-1">
        <input type="text" readonly value={permalink} style="flex: 1; font-size: 0.78rem;" />
        <button onclick={copyPermalink}>copy</button>
      </div>
    </div>
  </div>

  <p class="dim small" style="margin-top: 0.8rem;">
    {ASSETS.find((a) => a.id === asset)?.description} —
    {STRIDE.find((s) => s.id === stride)?.description}
  </p>
</div>

<div class="threats">
  {#each threats as t}
    <div class="card threat">
      <div class="row between">
        <h3>{t.title}</h3>
        <span class="badge {t.severity === 'critical' || t.severity === 'high' ? 'err' : t.severity === 'medium' ? 'warn' : ''}">{t.severity}</span>
      </div>
      <p style="margin-top: 0.5rem;">{t.description}</p>
      <div class="meta">
        <div>
          <span class="dim small mono">attack vector</span>
          <p class="small">{t.attackVector}</p>
        </div>
        <div>
          <span class="dim small mono">mitigation</span>
          <p class="small">{t.mitigation}</p>
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .threats { display: flex; flex-direction: column; gap: 0.8rem; margin-top: 1rem; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.6rem; }
  .small { font-size: 0.85rem; }
  @media (max-width: 720px) {
    .meta { grid-template-columns: 1fr; }
  }
</style>