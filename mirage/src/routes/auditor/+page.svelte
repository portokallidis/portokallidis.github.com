<script lang="ts">
  import { auditCode, detectLanguage } from '$lib/demos/auditor/rules';
  let code = $state("const token = 'secret-value';\neval(userInput);\ndocument.body.innerHTML = html;");
  const findings = $derived(auditCode(code));
  const language = $derived(detectLanguage(code));
</script>

<svelte:head><title>Security Auditor</title></svelte:head>
<section class="hero"><span class="badge accent">auditor</span><h1>Regex-light static checks with line numbers.</h1><p class="subtitle">Language: {language}</p></section>
<div class="grid">
  <label class="card col gap-2">Code<textarea bind:value={code}></textarea></label>
  <div class="card col gap-2"><h3>{findings.length} findings</h3>{#each findings as f}<p><span class={`badge ${f.severity === 'critical' ? 'err' : 'warn'}`}>{f.severity}</span> {f.line}:{f.column} {f.label} · {f.cwe}</p><p class="dim">{f.description}</p>{/each}</div>
</div>
