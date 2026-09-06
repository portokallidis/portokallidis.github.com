# Deployment

Use Node.js 22.20.0 and npm 10.9.3 for the recorded local environment.
Install the resolved dependencies with `npm ci`.
The application builds into `dist/`, which is the only deployment directory.

## Verify the release

```sh
npm ci
npm run check
npm run evaluate:retrieval
npm test
npx tsx tests/e2e/build-artifact-check.ts
npm run build
npm run verify:dist
npx tsx tests/e2e/reproducible-build.ts
npx playwright install chromium firefox webkit
npx playwright test
```

Set `SITE_ORIGIN=https://nporto.com` for the production build.
The origin is public metadata configuration and must not contain a placeholder.
Do not put credentials in frontend environment variables.

`npm run preview:cloudflare` starts the local Cloudflare static-assets runtime at `http://127.0.0.1:8787`.
Start the preview after the build finishes.
On Windows, restart the preview after rebuilding if Wrangler reports an `EPERM` watcher error or an existing prerendered route unexpectedly returns 404.
It exercises the configured canonicalization, headers, legacy redirects, and custom 404 behavior.
A passing local Cloudflare test is not evidence of a deployed domain or production DNS configuration.

## Local model assets and WebMCP

The release uses browser-managed native AI and source search.
No model WASM, weights, inference worker, or portable runtime is included in dist.
The CSP permits only same-origin connections and scripts and disables workers.
No inference endpoint, API key, model host, or WASM execution permission is configured.
The rejected WebGPU experiment remains a local development tool; npm run prepare:model writes its assets under the ignored .build/model-assets directory.
That command is not part of the release build.

WEBMCP_ORIGIN_TRIAL_TOKEN is optional build configuration.
Obtain a Chrome WebMCP origin-trial token for the exact HTTPS deployment origin and inject it at build time.
The browser validates feature eligibility, origin, and expiry.
Do not use a localhost token for production or present a flag-enabled local check as a production rollout.
Without a valid token or a browser exposing document.modelContext, the ordinary portfolio and chat still work.
The tools policy remains same-origin, with origin isolation enabled.

For a local real-browser test, run npx tsx scripts/verify-webmcp.ts against the Wrangler preview.
The test uses an isolated Chrome profile and the WebMCP development feature flag.
This does not modify the user's normal browser profile.
Record the trial token expiry in deployment operations when a real token is configured.
## Publish

Authenticate Wrangler to the intended Cloudflare account or configure a narrowly scoped deployment token in the deployment environment.
Confirm the account, Worker name, and domain before the production upload.
Run `npx wrangler deploy` only after reviewing the release artifact and verification report.
Configure `nporto.com` as the site's Cloudflare custom domain and verify the resulting DNS and TLS status in that account.
The build copies the root `CNAME` into `dist/` for GitHub Pages.

The local verification commands above do not publish or modify DNS.
Retain the verified `dist/` artifact and browser reports with the release.
Use a distinct Cloudflare project or preview version for staging so preview work cannot silently replace production.
After publication, repeat route, redirect, header, canonical, contact, and 404 checks against the actual HTTPS domain.

## Current hosting status

As checked on 5 September 2026, Wrangler is not authenticated to a Cloudflare account.
No production upload or DNS change was made.
The requested Previous portfolio link points to `https://2018.nporto.com/`; that hostname still returned NXDOMAIN through Windows DNS and Google Public DNS when rechecked on 6 September 2026.
TLS and HTTP reachability cannot be verified until it resolves.
The link is present in the site; hosting the archived portfolio at that address remains separate deployment work.

## Rollback

Record the Cloudflare version identifier and retain the tested `dist/` artifact for each production release.
Roll back to the previous tested deployment through Cloudflare's deployment history, then repeat the production route and header checks.
If the prior deployment is unavailable, rebuild its reviewed Git revision with the recorded Node/npm versions and lockfile, verify it, and redeploy that artifact.
Do not use the historical archive as an unreviewed automatic fallback.
