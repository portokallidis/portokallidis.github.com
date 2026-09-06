# Performance diagnostics

These are local production-build measurements, not deployed-site field percentiles.
The [official Lighthouse CLI](https://github.com/GoogleChrome/lighthouse#using-the-node-cli) supplied the performance measurements.
The full local output is retained in `.build/diagnostics/lighthouse-mobile.json`.
This run measured the dark-theme build before the later preferred-name, site-brand, and logo updates.
Lighthouse was not rerun for those changes; current compressed artifact sizes are recorded in `docs/verification-report.md`.

## Recorded mobile run

| Item | Recorded value |
| --- | --- |
| Measured at | 2026-09-05T19:59:30.665Z |
| URL | `http://127.0.0.1:8787/` |
| Host | Local Cloudflare Wrangler static-assets runtime |
| Lighthouse | 13.4.1 |
| Browser | Chromium 153.0.8010.12, headless, Windows |
| Emulation | Mobile, 412 x 823 CSS px, device scale 1.75 |
| Throttling | Simulated; 4x CPU slowdown, 150 ms RTT, 1,638.4 Kbps throughput |
| Performance score | 99/100 |
| Largest Contentful Paint | 1,782.069 ms |
| Cumulative Layout Shift | 0 |
| Total Blocking Time | 0 ms |
| First Contentful Paint | 1,543.391 ms |
| INP | Not measured |
| Warnings/runtime error | None |

The recorded asset requests were the document, `index-BYK4ud6M.js`, `index-sa3h-cpb.css`, `Home-4NE60CE6.js`, `Shared-CFm12KZg.js`, and the local favicon.
No corpus, recorded-run, model, or third-party assets were requested.
The corresponding homepage HTML SHA-256 was `3f3f2556e94c0155ed804b96c850ca602f28aa96bebd69583f70954f7c23c112`.
The Vite manifest SHA-256 was `074044cfaada70a72496a7ae0d0022a32c34c1c00d42b5256dfe646ab94823c5`.
The reproduced deployment-artifact manifest SHA-256 was `fb952b7522754f85af5bec5f771525c26a1179447c7515129d871f50163535cb`.
Asset or content edits after this build require a new measurement before treating these figures as measurements of the changed build.

## Reproduce

After building and starting `npm run preview:cloudflare`, set `CHROME_PATH` to the installed Chromium executable and run:

```sh
npm exec --yes --package=lighthouse@13.4.1 -- lighthouse http://127.0.0.1:8787/ --only-categories=performance --output=json --output-path=.build/diagnostics/lighthouse-mobile.json --chrome-flags="--headless=new" --quiet
npx tsx tests/e2e/reflow-diagnostics.ts
```

Create `.build/diagnostics/` first if it does not exist.
The reflow diagnostic checks 200% desktop CSS zoom and mobile pinch-zoom emulation, writing its exact conditions and screenshots to that directory.
CSS zoom and emulated pinch zoom are reported as automated stress checks and do not establish a manual browser-zoom, physical-device, or screen-reader pass.
Mobile pinch zoom intentionally narrows the visual viewport while retaining the page's layout width.
