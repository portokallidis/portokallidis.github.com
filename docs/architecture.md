# Architecture

The application remains a static React and TypeScript portfolio with Cloudflare Workers Static Assets.
No application Worker, inference service, or database is required.
The route manifest drives static rendering, per-page metadata, and sitemap generation.
The canonical chat route is /lab/ask-about-my-work; /lab and /demos redirect directly there.

## Portfolio

The fixed dark palette, original NP logo, restrained violet accents, and existing project composition are retained.
Header and footer branding is icon-only, with nporto.com as accessible image text and metadata.
The personal name is Nick Portokallidis.
Contact exposes an Email me mailto link without displaying the address.
The mailto address remains readable in the link source.

Typed content and trusted Markdown describe approved historical contributions.
Publication titles link to verified DOI records.
Canonical publications are append-only to retain existing corpus IDs, while the About view sorts newest first.
Public content never implies current employment or clinical outcomes from historical participation.

## Chat lifecycle

The prerendered introduction and tiny native bootstrap are independent of the deferred chat interface.
Start calls native session creation before awaiting imports, preserving browser user activation.
The interface and public corpus load concurrently.
When native AI is unavailable, the same composer returns original public source excerpts.
Failed downloads expose a retry without silently choosing another model.

The native adapter uses bounded prompts and strict output/citation validation.
The native adapter clones the base session for each answer and measures context where supported.
No inference worker, portable runtime, or model asset is deployed.

The corpus uses BM25 and up to five passages.
Broad employer-fit questions include the engineering overview, SYLVA contribution, and CARRE transferable-experience passages alongside up to two keyword matches.
Qualified connections to a proposed use case cite documented skills without claiming direct domain experience.
Questions are bounded to 500 characters, conversation context to three recent exchanges, and model context to 4,096 tokens with response space reserved.
Previous replies provide conversational context only and are never factual evidence.
Unsupported factual questions identify the detail not covered in the portfolio.
Fit questions that cannot be answered show related original passages and a contact link.
Generated HTML is never executed and source links are resolved from validated corpus records.

Questions and replies remain in memory.
Clear conversation cancels an active answer and clears visible history without discarding cached model files.
Navigation destroys active sessions.
Model failures preserve source search in the same composer.
Answers that do not finish within 60 seconds are cancelled and fall back to source search.

## WebMCP and archive boundaries

WebMCP tool registration is a small progressive enhancement on every page.
Only an explicit tool invocation imports retrieval and loads the corpus; it never initializes a model.
Tools return approved public sources, not hidden chat state or contact actions.
Browser origin isolation and same-origin tool permissions remain enabled.

The legacy-site archive and its SHA256 manifest were removed from the working tree and remain in Git history.
Development recordings do not enter dist.
The new raw CV and private editorial records remain outside the public repository.

## Browser AI choice

Reviewed on 6 September 2026, the supplied [on-device RAG article](https://huggingface.co/blog/rasgaard/on-device-rag) combines Transformers.js, a small language model, embeddings, and PGlite with pgvector.
Its author reports switching to a 360M model for phone memory limits and approximately four to five generated tokens per second.
That is a useful feasibility demonstration, but this portfolio has only 38 approved chunks and its BM25 evaluation finds all 19 expected passages.
An embedding model and browser database would add downloads and state without a measured retrieval benefit here.

The current [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) provides browser-managed native inference, user-activated model creation, download progress, and cancellation.
It is the first choice where the browser and hardware support it.
[WebLLM](https://webllm.mlc.ai/docs/) supplied a working WebGPU experiment with download progress, a dedicated worker, and constrained JSON.
Actual Qwen3 0.6B runs nevertheless invented unsupported revenue and clinical-efficacy claims, including after switching to the model's recommended sampling settings.
That experiment failed the source-support release gate and is retained only for development and reproducibility.
Its roughly 353 MB download and runtime are absent from the production build.
A larger model would require another measured quality and device-compatibility evaluation before inclusion.
[Transformers.js](https://huggingface.co/docs/transformers.js/index) remains an inference alternative, but changing runtimes does not establish better model grounding.
These are choices for this measured corpus and interface, not a general claim that one framework or model is best.
