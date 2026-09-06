# Local chat methodology

This optional chat answers questions about the approved public portfolio.
It is independent of the historical research projects and makes no clinical claims.

## Retrieval and generation

Start initializes native Chrome AI from the user gesture when available.
Otherwise the same composer searches public sources without generation.
The interface contains no model menu or recorded example selector.
When generation is unavailable, the same composer returns original source excerpts.

BM25 searches the versioned corpus and supplies up to five passages.
The corpus contains approved project contributions, professional background, education, and publication metadata.
The owner's name is excluded from lexical ranking because it does not distinguish evidence within this portfolio.
A name-only identity question searches the professional background.
Simple follow-up references reuse the preceding question's topic.

The native engine uses bounded context construction and strict output validation.
Inputs are limited to 500 characters, with at most three recent exchanges included as conversation context.
History never substitutes for source evidence.
Context is bounded for a 4,096-token model window and reserves 512 output tokens.
Native AI uses actual context measurement when the browser exposes it.
This bounded character preparation avoids adding a separate tokenizer dependency.

The model must return answer, citations, and refusal fields.
The response schema limits citation IDs to supplied sources, and application validation rejects malformed, uncited, or invented references.
Generated text is rendered as text; source links are constructed from corpus records.
Structural validation does not prove that every claim is supported, so actual answers also require a source review.

## Progress, cancellation, and privacy

Download progress comes from native browser events.
Preparation remains indeterminate where the runtime has no meaningful fraction.
Cancelling startup aborts the native operation.
Stop interrupts generation; clearing the conversation also discards in-memory turns.
Navigation releases model sessions.

Questions and answers are not persisted or transmitted to a hosted model.
The browser may cache model files.
No portable model host is contacted by the published site.
Read-only WebMCP tools return only approved sources when explicitly called and never receive or expose chat history.

## Evaluation and release gate

The development set contains 30 cases: 16 answerable, 6 unsupported, 4 date-sensitive, and 4 adversarial.
Three answerable questions cover the newly added 2026 publications.
The retrieval denominator is 19 expected passages across the applicable cases.
Keep synthetic injection fixtures in tests, separate from public career content.

Run npm run evaluate:retrieval to regenerate the corpus, questions, and measured retrieval report.
Run npx tsx scripts/evaluate-models.ts --native-only with the local Vite server and installed Chrome to capture real native attempts.
The runner includes follow-up questions and a Unicode context probe beyond the 30-case denominator.
It preserves exact prompts, outputs, errors, source passages, model identifiers, corpus and implementation hashes, timestamps, progress, and durations.
Native model revision remains not exposed.
A failed output is never replaced by an authored answer.

Review source support independently from schema validity and expected refusal flags.
Release acceptance requires valid source references, no unsupported factual claims, and useful supported answers on at least 15 of 16 answerable cases for each generative backend.
Report unsupported, date-sensitive, and adversarial results with their own denominators.
Do not relabel failed or untested checks as passes.
Timing measurements on this shared development workstation are diagnostics, not a cross-device performance benchmark.

## Rejected portable experiment

The development WebGPU adapter uses WebLLM 0.2.84 and the pinned Qwen3 0.6B model.
It supports real progress, worker termination, generation interruption, bounded context retry, and strict citation validation.
It is excluded from the published import graph and build assets because its actual answers failed source review.
Neither schema constraints nor the official sampling settings prevented unsupported career and clinical claims.
The [current attempt reviews](evidence/current-model-attempt-reviews.json) distinguish 33 native attempts, the 22-attempt initial portable run, the 20-attempt revised run, and eight final focused probes.
The final probes are a failure diagnosis, not a complete 30-question evaluation.
All reviews are automated source reviews by Codex; human review remains pending.

To reproduce the development experiment, run npm run prepare:model, start Vite, and run npx tsx scripts/evaluate-models.ts --webgpu-only.
The model WASM is prepared under the ignored .build/model-assets directory and served only by the local development server.
The experiment then downloads approximately 353 MB of pinned model assets and may cache them in its isolated browser profile.
Use --failure-probes to repeat the eight final diagnostic questions.

## Historical evidence

The removed public examples remain byte-preserved under docs/evidence/public-lab-d2ebbc8ce331a106.
That snapshot contains 36 files and a verified SHA256 manifest.
It retains the older corpus and actual native run outputs, including previously reported failures.
Those older measurements do not apply to the current corpus or chat implementation.
No recordings, evaluation cases, or model output bundles are deployed under lab-artifacts.
Only the approved corpus is deployed there.

Current executed results and remaining limitations belong in verification-report.md.
