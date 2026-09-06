# Verification report

The execution date is 6 September 2026 on Windows, using Node.js 22.20.0 and npm 10.9.3.
The production target remains https://nporto.com; no production upload or DNS change was made.
All deployment checks below use the built static site through Cloudflare Wrangler at http://127.0.0.1:8787.

## Portfolio and deployment

- The original dark design is retained, with the original enlarged NP logo and no visible header or footer wordmark.
- Selected work has horizontal hover padding and no numbering.
- Contact shows Nick Portokallidis and an Email me action, without displaying the email address.
- About contains the three verified 2026 publications, with DOI links and the original publication metadata.
- The previous-portfolio link is https://2017.nporto.com/.
- Eight canonical routes and a real static 404 page are prerendered, with unique metadata, a shared sitemap manifest, and direct legacy redirects.
- No production page contains a recording selector, mode menu, downloadable CV, synthetic answer, or developer evaluation interface.

The original archive passes 49/49 SHA256 comparisons.
The retired public recording artifacts are separately preserved byte-for-byte in docs/evidence/public-lab-d2ebbc8ce331a106.
Only the current approved corpus is deployed under lab-artifacts.
The newly supplied raw CV and private claim ledger remain outside the public repository.
Archived historical contact information remains part of the existing repository history; archiving does not make that history private.
The Email me address is still readable in the mailto link source.

## Executed release checks

| Check | Result |
| --- | --- |
| TypeScript and ESLint | Passed with npm run check |
| Unit and integration tests | 37/37 passed across six files |
| Production browser suite | 78/78 passed in 1.5 minutes across Chromium, Firefox, and WebKit |
| HTML, redirects, and HTTP status | All eight published routes, direct legacy redirects, missing routes, and nested 404s passed through Wrangler |
| Accessibility and keyboard | Automated WCAG AA audits, skip links, source links, input validation, focus, and reduced-motion checks passed |
| Responsive layout | No overflow at 320, 375, 768, 1024, and 1440 pixels; the started mobile chat and Send control were visually inspected at 320 x 740 |
| Chat state and fallback | Start boundary, progress, cancellation, late-result cleanup, retry, Clear, source failure recovery, citation rejection, and multi-turn topic changes passed |
| Content and publication records | Nine projects and nine publications validated; the three new 2026 papers appear first |
| Archive | 49/49 original SHA256 hashes match |
| Deployment boundary | No archive, recordings, evaluation cases, model files, portable runtime, or inference worker in dist |
| Reproducibility | All 35 deployed files match an isolated second build byte-for-byte |
| Asset budgets | Gzip initial JavaScript 83,176 bytes; CSS 5,457 bytes; initial homepage total 94,122 bytes |
| Artifact preservation regressions | Exact historical copies, hashes, idempotence, failed-copy protection, and accidental portable-asset rejection passed |

The reproducible artifact manifest SHA256 is e7cdc40bff56387792ff688f7757ac36974fb56528a65862cb080f5187354046.
The native lifecycle tests use controlled browser API fixtures; the separate real native runs below establish actual inference.
An earlier local Wrangler proxy process exited during concurrent build diagnostics; restarting it and running the final suite against the completed build passed.
A Firefox history test initially reloaded before its lazy route finished loading; it now waits for the visible case page and hydration, and passed three focused repeats and the full final suite.

## Chat and real inference

Start is the activation boundary for the interface, retrieval corpus, and model session.
Questions and answers stay in memory, generated text is escaped, and citations resolve only to approved source records.
Cancellation, retry, source-search fallback, Clear, bounded inputs, and session cleanup are tested separately from answer quality.

The current corpus has 38 chunks and SHA256 0ce0ccb69c76449e1903def3c7ece534e66ffd8c5c566d9b45bf3f7b5425f52d.
BM25 retrieves all 19 expected passages across the applicable evaluation questions.
The evaluation set contains 30 questions: 16 answerable, six unsupported, four date-sensitive, and four adversarial.
Additional model probes exercise follow-up context and a Unicode-heavy question.
Injection fixtures remain outside public career content.

Actual native generation was tested in installed Chrome 152.0.7977.82 using an isolated profile and normal browser feature settings.
All 33 native attempts returned structurally valid answers and citation references.
Automated source review found 23 supported responses and ten appropriate refusals, including useful answers for all 16 answerable questions.
The 30 main cases agree with the expected refusal flag in 29/30 cases.
The remaining date-sensitive response correctly states Start: 2024 and says present participation is unknown, but sets refusal to false.
One historical Bliss answer uses the imprecise wording from 2019; its past-tense claim was reviewed as supported, with a date-precision caution.
Human source review remains pending.
The browser does not expose the native model revision.

A real production-runtime smoke test returned the CARRE contribution with a valid source link, no page errors, and zero optional-feature requests before Start.
Native startup took 25.020 seconds in that final smoke test while the browser suite ran concurrently.
The separate evaluation observed an initial cached-model session startup of 16.290 seconds and a repeat startup of 1.472 seconds.
These are diagnostics on a shared workstation, not a controlled performance benchmark or a promise about other devices.

The portable WebGPU experiments exposed answer-quality failures that schema validation alone cannot catch.
Failed raw captures and source reviews are preserved as development evidence; they are not recorded examples in the site.
The initial portable attempt captured 22 responses and produced only 4/16 useful answerable responses.
The revised attempt captured 20 responses, with 12/16 useful answerable responses and four accepted unsupported answers.
Eight focused probes using the official sampling settings produced four supported answers, three accepted unsupported answers, and one citation-validation failure.
The repeated inventions concerned Bliss responsibilities, SYLVA revenue growth, and ThrombUS+ clinical efficacy.
The WebGPU backend is therefore excluded from the published chat, assets, and CSP.
Other browsers retain source search in the same interface.
The [combined reviews](evidence/current-model-attempt-reviews.json) and [capture manifest](evidence/current-model-runs/manifest.json) preserve exact outputs and denominators.

## WebMCP

The site registers two read-only tools: search_portfolio and get_portfolio_source.
Registration does not fetch the corpus or initialize a model.
Actual Chrome API discovery, argument validation, source lookup, search, and SPA registration checks passed with the WebMCP experimental flag.
The ordinary Chrome profile did not expose the API.
No production origin-trial token is configured, so this is an implemented progressive enhancement, not a claim of general browser availability.

The test observed 34 same-origin GET requests, no model or external requests, and no page errors.
Chrome 152 rejected an aborted tool caller but did not pass the documented execution signal to the callback, allowing the pending corpus GET to finish.
This browser limitation is documented in [the native WebMCP verification](webmcp-runtime-verification.md), together with exact browser flags and hashed evidence.

## Remaining verification boundaries

Automated browser, accessibility, and viewport checks do not establish a manual screen-reader pass, a physical mobile-device result, or production Core Web Vitals.
The historical Lighthouse result in performance.md is explicitly tied to its older build.
The previous-portfolio hostname returned NXDOMAIN through Windows DNS and Google Public DNS on 6 September 2026; its link is implemented, but the destination requires separate hosting and DNS work.
Production DNS, TLS, live deployment, and an actual WebMCP production origin trial remain untested.
