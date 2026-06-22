<svelte:head>
  <title>Resume Q&amp;A — Mirage</title>
</svelte:head>

<section class="hero">
  <h1>Resume Q&amp;A</h1>
  <p class="subtitle">
    Ask anything about my CV. Default mode uses token-overlap extraction over the structured CV.
    Loading the LLM (~5 GB) unlocks richer answers.
  </p>
</section>

<script lang="ts">
  import { browser } from '$app/environment';
  import { answerFromContext, retrieve } from '$lib/demos/resume/rag';
  import { webllm } from '$lib/ai/webllm-engine.svelte';

  let question = $state('');
  let history = $state<Array<{ q: string; a: string; method: 'extractive' | 'llm' }>>([]);
  let statusText = $state('idle');
  let useLLM = $state(false);
  let modelLoaded = $state(webllm.isReady());

  $effect(() => {
    if (webllm.statusText) statusText = webllm.statusText;
  });

  async function loadModel() {
    statusText = 'loading LLM…';
    try {
      await webllm.load();
      modelLoaded = true;
      useLLM = true;
      statusText = 'LLM ready';
    } catch (e) {
      statusText = `model load failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function ask() {
    const q = question.trim();
    if (!q) return;
    question = '';
    history = [...history, { q, a: '…thinking…', method: 'extractive' }];

    let answer: string;
    let method: 'extractive' | 'llm' = 'extractive';
    if (useLLM && modelLoaded) {
      try {
        const chunks = retrieve(q, 4).map((c) => `[${c.section}] ${c.text}`).join('\n\n');
        const response = await webllm.generate(
          [
            {
              role: 'system',
              content: `You are Nick Portokallidis, a senior full-stack developer. Use the following context from Nick\u2019s CV to answer the question. If the context doesn\u2019t contain the answer, say so. Be brief and concrete.\n\nCONTEXT:\n${chunks}`
            },
            { role: 'user', content: q }
          ],
          { temperature: 0.4, maxTokens: 384 }
        );
        answer = response;
        method = 'llm';
      } catch (e) {
        answer = `LLM error: ${e instanceof Error ? e.message : String(e)}\n\nFalling back to extractive answer:\n${answerFromContext(q)}`;
      }
    } else {
      answer = answerFromContext(q);
    }
    history = [...history.slice(0, -1), { q, a: answer, method }];
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  }
</script>

<div class="card">
  <div class="row gap-2" style="margin-bottom: 1rem;">
    <input
      type="text"
      bind:value={question}
      onkeydown={onKeydown}
      placeholder="Ask about experience, skills, projects, education…"
      style="flex: 1;"
    />
    <button class="primary" onclick={ask}>ask</button>
    {#if !modelLoaded && browser}
      <button class="ghost" onclick={loadModel}>load LLM</button>
    {/if}
    <span class="dim mono small">{statusText}</span>
  </div>

  {#if history.length === 0}
    <div class="dim small">
      Try: "What AI experience does Nick have?" or "Which companies has he worked at?" or "Where did he study?"
    </div>
  {:else}
    <div class="chat">
      {#each history as entry}
        <div class="entry">
          <div class="q">
            <strong>Q:</strong>
            <span>{entry.q}</span>
            <span class="badge" style="margin-left: 0.4rem;">{entry.method}</span>
          </div>
          <div class="a mono small" style="white-space: pre-wrap;">{entry.a}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chat { display: flex; flex-direction: column; gap: 1rem; }
  .entry { padding: 0.7rem; border: 1px solid var(--border); border-radius: 4px; background: rgba(0, 0, 0, 0.2); }
  .q { margin-bottom: 0.5rem; }
  .a { color: var(--text); }
  .small { font-size: 0.85rem; }
</style>