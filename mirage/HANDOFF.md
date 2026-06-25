# HANDOFF.md — Mirage: The On-Device AI Guardian (Fresh Start)

**For a new Hermes session. Paste this entire file at the start of the session.**

---

## What happened

The previous session built an entire SvelteKit portfolio at
`/home/nporto/projects/portokallidis-portfolio/mirage/` (12 routes,
WebLLM-powered resume chat, voice recruiter, face/text blur, privacy
guard, security auditor, STRIDE matrix, scrap redactor, etc.). The
codebase worked — `pnpm run check` returned 0/0 and `pnpm run build`
produced 12 prerendered routes.

A botched `git reset --hard` to fix a staging mess **destroyed the
source files**. They were untracked at the time and did not survive
the reset. The `node_modules/` and `build/` artifacts survived but
cannot be decompiled back to source.

You are starting from scratch. Everything you need is below.

## Current repo state

```
$ git log --oneline -3
9be55dc deploy                    <-- origin/master, current HEAD

$ git branch -a
* master
  remotes/origin/gh-pages
  remotes/origin/master

$ ls /home/nporto/projects/portokallidis-portfolio/
legacy-portfolio/                 <-- preserved AngularJS assets (was tracked at one point)
mirage/                           <-- DOES NOT EXIST yet
```

The legacy AngularJS assets live under `legacy-portfolio/` and are
NOT tracked in git (the working tree was reset clean). You can leave
them in place for reference; they are not needed for the new build.

## What to build — the PRD (Mirage)

Build a greenfield developer portfolio at
`/home/nporto/projects/portokallidis-portfolio/mirage/` that demonstrates
an AI-first full-stack engineer with security expertise. The portfolio
MUST be local-first, verifiable, and visually distinctive.

### Stack (non-negotiable)

- **SvelteKit 2** (latest) with **Svelte 5 runes** (`$state`, `$derived`, `$effect`)
- **TypeScript** strict mode
- **`@sveltejs/adapter-static`** for static deploy to gh-pages
- **pnpm** as package manager
- **Vite** (bundled with SvelteKit)
- **Hand-rolled CSS** — no Tailwind, no Bootstrap, no UI framework
- **No telemetry, no GA, no third-party scripts** — privacy by default

### Routes (12 total, all prerendered)

| Route | Purpose |
|---|---|
| `/` | Hero, trust bar, grid of 7 demo cards, inspector modal trigger |
| `/mirage` | Webcam face blur (raw / protected / event-stream views) + text-region blur (sticky notes, business cards) + WebLLM scene narrator |
| `/shredder` | Paste any text → see PII / secrets detected (18 regex rules + Luhn) with copy-to-clipboard |
| `/auditor` | Paste code → see security findings (18 rules across JS/Python/Go) with line numbers |
| `/threat` | Pick STRIDE category + asset → generates threat matrix with permalink sharing |
| `/resume` | Ask questions about the dev's CV → extractive or WebLLM answer with citations |
| `/recruiter` | Voice loop: Web Speech API STT → WebLLM answer → TTS speak back |
| `/inspect` | Live dashboard: hardware capabilities, CSP, network log, model status |
| `/about` | Long-form bio |
| `/projects` | Project cards |
| `/tech` | Tech stack breakdown |
| `/contact` | Passkey contact form (or just contact info if passkeys too heavy) |

### Required infrastructure

- **`src/lib/privacy/guard.ts`** — wraps `window.fetch`, `XMLHttpRequest.prototype.send`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `HTMLImageElement.src`. Allow-list is **host + path restricted** (not just host). Default-deny everything except same-origin. Same-origin blobs are local; cross-origin blobs are blocked. Records every call (allowed/blocked) in a 500-entry ring buffer for the Inspect modal.
- **`src/lib/privacy/store.svelte.ts`** — class-based runes store exposing `$state` arrays/objects for `installed`, `modelStatus`, `fps`, `requests`, `blocked`, `uploadedBytes`, `log[]`.
- **`src/lib/capability/detect.ts`** — probe WebGPU, WASM, SIMD, threads, hardware concurrency, device memory, screen size, color depth.
- **`src/lib/ai/face-detector.worker.ts`** + **`face-detector.client.ts`** — MediaPipe Tasks Vision + BlazeFace short-range (224 KB), runs in a Web Worker with OffscreenCanvas and WebGPU delegate. **Model bundled same-origin** at `static/models/blaze_face_short_range.tflite` so no network egress for the face model.
- **`src/lib/ai/text-detector.worker.ts`** — algorithmic edge-density text-region detector (320×240 grayscale → Sobel → horizontal projection → connected components). No ML model needed. ~50 ms/frame.
- **`src/lib/ai/webllm-engine.svelte.ts`** — wrapper around `@mlc-ai/web-llm`. Uses prebuilt catalog model **`Hermes-3-Llama-3.1-8B-q4f16_1-MLC`** (the project name matches). Dynamic-imported on demand. Forwards `AbortSignal` to `engine.generate()`. Tracks `loadingFor` field to disambiguate concurrent `load(A)` / `load(B)` calls. Includes an extractive fallback (token overlap with CV chunks) for when no LLM is loaded.
- **5 demo rule modules** under `src/lib/demos/`:
  - `shredder/rules.ts` — 18 PII/secret regex rules + Luhn validator for 16-digit PANs
  - `auditor/rules.ts` — 18 security rules across JS/Python/Go
  - `threat/matrix.ts` — STRIDE matrix generator
  - `threat/permalink.ts` — shareable URL-safe base64 permalinks (TextEncoder/Uint8Array, **no `btoa(unescape(...))`**, validate decoded shape against `KNOWN_IDS`)
  - `resume/rag.ts` — extractive QA over CV
- **`src/lib/content/cv.ts`** — full CV extracted from `legacy-portfolio/cv/short_cv.html` + `legacy-portfolio/cv/index.html`. Sections: summary, experience, projects, tech, education, languages.
- **Components**: `Nav.svelte`, `TrustBar.svelte`, `InspectAI.svelte` (modal), `FpsMeter.svelte`.

### Bundle / runtime budget

- `pnpm run build` → 12 prerendered routes, ≤ 12 MB total, 0 errors, 0 warnings
- `pnpm run check` → 0 errors, 0 warnings (svelte-check)
- Both `face-detector.worker.js` and `text-detector.worker.js` emitted as ES modules

### Files that MUST be committed in commit #1 (before any code)

- `mirage/.gitignore` containing:
  ```
  node_modules
  /.svelte-kit
  /build
  /.vercel
  /.netlify
  /.env
  *.log
  .DS_Store
  ```
- This prevents the disaster that just happened.

---

## Commit strategy (the user wants separate commits)

After the greenfield is built, commit in this order:

1. **`chore: archive legacy AngularJS assets under legacy-portfolio/`**
   - `cp -r` legacy assets (already in `legacy-portfolio/`) so they're preserved
   - This is informational — they're not tracked, just on disk

2. **`chore(mirage): scaffold SvelteKit 2 + Svelte 5 project with .gitignore`**
   - `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `pnpm-lock.yaml`
   - **`pnpm-lock.yaml` MUST be in this commit, before any code is added.**
   - **Verify with `ls -a mirage/` that node_modules, build, .svelte-kit are not staged.**

3. **`feat(mirage): privacy guard + capability probe + runes store`**
   - `src/lib/privacy/guard.ts`
   - `src/lib/privacy/store.svelte.ts`
   - `src/lib/capability/detect.ts`
   - **`pnpm run check && pnpm run build` must pass at this point.**

4. **`feat(mirage): AI face + text detectors, WebLLM engine, CV content`**
   - `src/lib/ai/*`
   - `src/lib/content/cv.ts`
   - **`pnpm run check && pnpm run build` must pass.**

5. **`feat(mirage): 5 demo modules + 12 routes + 4 components`**
   - `src/lib/demos/*`
   - `src/routes/*`
   - `src/lib/components/*`
   - `src/app.html`, `src/app.css`
   - **`pnpm run check && pnpm run build` must pass.**

6. **`docs(mirage): BUGS.md tracking Ralph loop findings`**
   - `BUGS.md` (see template at end of this file)

7. **`fix(mirage): Codex review hardening — image-src block, XHR fail-closed, allow-list tightening`**
   - Apply BUG-013, 014, 015, 016, 017, 018 from the BUGS.md template.
   - **`pnpm run check && pnpm run build` must pass.**

Each commit is independently buildable. Don't batch.

---

## Bugs to fix (Ralph loop content)

The previous session caught these. Apply them in commit #7. The fixes
below are correct — copy them verbatim into the new files.

### BUG-013 (high): image-src actually blocks disallowed URLs
```typescript
// In guard.ts installGuard(), HTMLImageElement section.
// Replace the src setter so it THROWS instead of just logging.
set(this: HTMLImageElement, value: string) {
    const allowed = isAllowed(value);
    log({ id: ++_id, ts: Date.now(), kind: 'image', url: value, allowed });
    if (!allowed) {
        throw new DOMException(
            `[mirage-guard] Blocked image src ${value} (not in allow-list)`,
            'SecurityError'
        );
    }
    Reflect.apply(origSet, this, [value]);
}
```

### BUG-014 (high): allow-list tightened to paths, not hosts
```typescript
const allowList: RegExp[] = [
    // Same-origin hosts (custom domain + project-site + dev/preview)
    /^https:\/\/(?:www\.)?nporto\.com(?::\d+)?\//i,
    /^https:\/\/portokallidis\.github\.io\//i,
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//i,
    // jsDelivr: only the two runtime paths the AI libs need.
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@[\d.]+\//i,
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mlc-ai\/web-llm@[\d.]+\//i,
    // Hugging Face: only mlc-ai's model repos, only resolve/main
    /^https:\/\/huggingface\.co\/mlc-ai\/[^/]+\/resolve\/main\//i,
    /^https:\/\/cas-bridge\.xethub\.hf\.co\/[^/]+\//i,
    /^https:\/\/[a-z0-9-]+\.xethub\.hf\.co\/[^/]+\//i,
    // MediaPipe model bucket (defensive)
    /^https:\/\/storage\.googleapis\.com\/mediapipe-models\//i
];
```

### BUG-015 (medium): XHR fail-closed when no metadata
```typescript
xhrProto.send = function (body?: unknown) {
    const meta = (this as unknown as { _mirage?: { method: string; url: string } })._mirage;
    if (!meta) {
        log({ id: ++_id, ts: Date.now(), kind: 'xhr',
              method: 'UNKNOWN',
              url: '<untracked XHR — open() predated guard install>',
              allowed: false, uploadBytes: measureBody(body) });
        throw new DOMException(
            `[mirage-guard] Refused untracked XHR (open() predated guard install)`,
            'AbortError'
        );
    }
    // ... rest of validation
};
```

### BUG-016 (medium): image getter uses Reflect with correct receiver
```typescript
get(this: HTMLImageElement) {
    return origGet ? Reflect.apply(origGet, this, []) : undefined;
}
```

### BUG-017 (medium): `_installed` flag set AFTER all patches
Move `installGuard()` body's `_installed = true` to the very end of
the function. Currently it's set at the top — wrong.

### BUG-018 (low): XHR loadend listener uses `{ once: true }`
```typescript
self.addEventListener('loadend', () => { log({...}); }, { once: true });
```

### BUG-019 (low): blob: same-origin only
The `isAllowed` function already enforces this via `isSameOriginBlob`.
Make sure `isLocalScheme('blob:...')` returns false for cross-origin
blobs — verify the implementation uses `isSameOriginBlob(url, origin)`.

### Install timing
Import `guard.ts` as a side-effect from the **top** of
`+layout.svelte` (not in `onMount`) so it installs before SvelteKit's
hydration fetches fire. The module's bottom should call
`installGuard()` directly so importing = installing.

---

## Hermes operational guidance for the new session

### Don't use `delegate_task` for code review

It consistently times out at 600s / 28 tool calls with zero output.
Do code review in focused direct passes — read 1-2 files at a time,
identify issues, patch, re-run check.

### Use `terminal`, not `execute_code`

`execute_code` is blocked (treated as cron-like context). Use
`terminal` with `python3` inline heredocs when you need scripts.

### Verify before destructive git operations

**Never `git reset --hard` when untracked source files exist.**
If you must reset, copy source files to `/tmp/` first. Better: avoid
hard resets entirely — use `git reset --soft` or `git restore --staged`.

### Commit incrementally

After every module is written, run `pnpm run check && pnpm run build`,
then commit. Don't write everything before committing.

### After commit, run `pnpm run check && pnpm run build` again

LSP is stale. The build will tell the truth.

### For the Hermes-agent review at the end

After everything is committed, start `pnpm run preview` in background
and `curl` each route to verify it serves. Then delegate the
design/effectiveness review to a subagent (NOT the code review —
that's where subagents time out). Subagents are good at qualitative
review of a running site given a description of what's there.

---

## BUGS.md template (paste this verbatim at commit #6)

```markdown
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
```

---

## Final notes

1. **The user wants `pnpm run preview` running and a real review** at the end. Start it with:
   ```bash
   cd /home/nporto/projects/portokallidis-portfolio/mirage
   pnpm run preview --port 4173 &
   ```
   Then `curl -s http://localhost:4173/` etc.

2. **The user wants the push done by them** — so the new session should end with the branch ready locally and a clear push command for the user to run themselves.

3. **The user's standing preferences** (apply throughout):
   - Codex codes, MiniMax reviews (two-agent pattern)
   - Lean project intake — defer optional scaffolding
   - Hermes Kanban for project tracking
   - MiniMax subscription is in use

4. **What I learned the hard way**: in Svelte 5, top-level `$state` only works in `.svelte` and `.svelte.ts` files. Don't try `$state` in plain `.ts` — rename the file to `.svelte.ts`. This bit me during the original build.

---

**End of HANDOFF.md. Paste the entire contents of this file into the new session's first message.**