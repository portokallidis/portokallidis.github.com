# BUGS.md — Mirage Ralph Loop Log

This file tracks every issue found and fixed during the iterative
self-review (the "Ralph loop") that produced Mirage. Each entry
records the bug, severity, location, and fix.

| ID  | Severity | Component                                          | Summary                                                                  | Status |
| --- | -------- | -------------------------------------------------- | ------------------------------------------------------------------------ | ------ |
| 001 | high     | `src/lib/privacy/guard.ts` + `+layout.svelte`      | Privacy guard installed in `onMount`; race window for hydration fetches. | fixed  |
| 002 | medium   | `src/lib/demos/threat/matrix.ts`                   | Permalink used deprecated `btoa/unescape`; no shape validation.           | fixed  |
| 003 | medium   | `src/lib/demos/auditor/rules.ts`                   | False-positive on commented-out secrets.                                 | fixed  |
| 004 | low      | `src/lib/demos/shredder/rules.ts`                  | Luhn check on 16-digit PANs triggered on serial numbers.                 | fixed  |
| 005 | low      | `src/lib/ai/face-detector.worker.ts`               | OffscreenCanvas `transferControlToOffscreen` called twice on resume.    | fixed  |
| 006 | medium   | `src/lib/ai/face-detector.client.ts`               | `getUserMedia` rejection left `modelStatus='loading'` forever.           | fixed  |
| 007 | medium   | `src/routes/mirage/+page.svelte`                   | Text-mode camera path didn't roll back partial stream on entry error.    | fixed  |
| 008 | low      | `src/lib/ai/webllm-engine.svelte.ts`               | `AbortSignal` checked but not forwarded to WebLLM `generate`.            | fixed  |
| 009 | medium   | `src/lib/ai/webllm-engine.svelte.ts`               | `load(A)` then `load(B)` short-circuited B to A's promise.               | fixed  |
| 010 | low      | `src/lib/privacy/store.svelte.ts`                  | `$state` array length written inside `$effect` → reactivity warning.     | fixed  |
| 011 | critical | `src/routes/inspect/+page.svelte`                  | `document.querySelector` ran during SSR → 500 on prerender.              | fixed  |
| 012 | critical | `src/lib/components/InspectAI.svelte`              | Same SSR `document` bug; modal crashed prerender of every page.          | fixed  |
| 013 | high     | `src/lib/privacy/guard.ts` image-src               | Image setter logged "blocked" but still set the src → leaked fetch.      | fixed  |
| 014 | high     | `src/lib/privacy/guard.ts` allow-list              | Host-wide regexes; no path restriction.                                  | fixed  |
| 015 | medium   | `src/lib/privacy/guard.ts` XHR                     | XHRs `open()`ed before patches could leak.                               | fixed  |
| 016 | medium   | `src/lib/privacy/guard.ts` image getter            | Image getter bound to prototype, wrong `this` on second call.             | fixed  |
| 017 | medium   | `src/lib/privacy/guard.ts` install order           | `_installed` flag set before patches complete.                           | fixed  |
| 018 | low      | `src/lib/privacy/guard.ts` XHR loadend             | Listener added without `{ once: true }`; stale on XHR reuse.             | fixed  |
| 019 | low      | `src/lib/privacy/guard.ts` blob:                   | Cross-origin `blob:` URLs accepted as local.                             | fixed  |
| 020 | low      | `src/routes/recruiter/+page.svelte`                | STT `interimResults` re-rendered transcript on every chunk → jitter.     | fixed  |
| 021 | low      | `src/lib/ai/text-detector.worker.ts`               | Worker leaked Uint8ClampedArray buffers between frames.                  | fixed  |

## Severity legend

- **critical** — broke build or SSR prerender; user-visible failure.
- **high** — security or privacy gap (could leak data, defeat guard).
- **medium** — race condition, state corruption, or unhandled rejection.
- **low** — minor correctness, jitter, or code-hygiene issue.

## Review passes

- **Pass 1** (self-review after subagent build timed out): 001–005
- **Pass 2** (after first round of fixes): 006–012 (incl. 2 SSR killers)
- **Pass 3** (Codex via `mcp_codex_codex` on `guard.ts` only): 013–019
- **Pass 4** (final UX pass over voice recruiter + text detector): 020–021

## What was deferred

Nothing. All 21 bugs are fixed in the shipped build. Codex Pass 3
medium/low findings (016, 017, 018) were applied before commit.
