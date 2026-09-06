# nporto.com

Nick Portokallidis's portfolio, built with React, strict TypeScript, Vite, React Router, Tailwind, and Base UI controls.
The existing dark design prioritizes project stories and contact for founders and recruiters.
Every published route has prerendered HTML and client hydration.

## Run and verify

Use Node.js 22.20.0 and npm 10.9.3.

```sh
npm ci
npm run dev
```

For the production Cloudflare Static Assets runtime:

```sh
npm run verify:archive
npm run check
npm run evaluate:retrieval
npm test
npm run build
npm run preview:cloudflare
```

Open http://127.0.0.1:8787.
The build produces eight public pages, a genuine 404, metadata, redirects, and a sitemap.
It does not download or deploy model assets.

```sh
npx tsx tests/e2e/build-artifact-check.ts
npx tsx tests/e2e/reproducible-build.ts
npx playwright install chromium firefox webkit
npm run test:e2e
```

See [the verification report](docs/verification-report.md) for actual results and limitations.

## Optional chat

The chat at /lab/ask-about-my-work shows one Start button.
Start creates the browser's native AI session from the user gesture when supported.
Other browsers use public source search in the same composer.
No model picker, recorded examples, hosted inference, embedding model, or browser database is used.

Chrome manages any native model download and reports progress.
Visitors can cancel loading, stop answers, retry failures, and clear the conversation.
Questions and replies stay in tab memory; browser-managed model files may remain cached.
Generated replies include links to approved sources.

WebMCP progressively registers two read-only tools, search_portfolio and get_portfolio_source.
Registration loads no corpus or model.
An explicit tool call may load the approved corpus independently of Start.
Production WebMCP requires a browser exposing the API and, where applicable, a valid origin-trial token.
See [deployment](docs/deployment.md) for configuration.

## Evidence and maintenance

```sh
npm run evaluate:retrieval
npx tsx scripts/evaluate-models.ts --native-only
```

The first command regenerates the approved corpus and measures BM25 against the 30 development question definitions.
The second requires the local Vite server and installed Chrome; it captures genuine native model attempts.
Read [the methodology](docs/evidence-methodology.md) before interpreting results.

A WebGPU model was implemented and tested, then excluded from the published chat because actual runs invented unsupported career and research claims.
The development experiment and its failed captures are retained for reproducibility.
To repeat it locally, run npm run prepare:model before npx tsx scripts/evaluate-models.ts --webgpu-only, with Vite running.
The experiment downloads approximately 353 MB of model assets and uses WebLLM, which is a development dependency.
It is excluded from the production dependency graph, assets, and CSP.

The original 49 website files remain byte-preserved under archive/legacy-site and excluded from deployment.
Historical recorded artifacts are preserved under docs/evidence with verified file hashes.
The new raw CV and private claim ledger remain outside the repository.
No production upload or DNS changes are made by the verification workflow.

See [content editing](docs/content-guide.md), [architecture](docs/architecture.md), and [deployment and rollback](docs/deployment.md).
