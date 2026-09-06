# Native WebMCP verification

The built site was tested at `http://127.0.0.1:8787` on 6 September 2026 with installed Chrome `152.0.7977.82` and separate `.build/webmcp-chrome` profiles.
The normal Chrome run did not expose `document.modelContext`; navigation and the unstarted chat remained usable without requesting portfolio data or a model.
The experimental run explicitly used `--enable-features=WebMCP`, which matches the installed Chrome version's [WebMCP testing flag implementation](https://chromium.googlesource.com/chromium/src/+/refs/tags/152.0.7977.82/chrome/browser/about_flags.cc).
No production origin-trial token, extension, hosted inference, or substituted browser API was used.

The native API discovered exactly `search_portfolio` and `get_portfolio_source` before Start.
Discovery and invalid inputs fetched no corpus.
Actual tool calls returned approved passages with matching IDs, URLs, sections, content hashes, and Nick's preferred name.
About, Work, and Ask navigation preserved exactly two registrations.
The temporary callback-contract diagnostic was removed after execution.
All 34 observed page requests were same-origin GET requests, with zero model requests and zero page errors.

Chrome 152 has a verified cancellation limitation.
Aborting `executeTool()` rejected its caller with `AbortError` after 164.5 ms, but the deliberately delayed corpus request subsequently completed.
A temporary tool registered through the real API received one callback argument and no execution signal.
This matches the installed version's [implementation](https://chromium.googlesource.com/chromium/src/+/refs/tags/152.0.7977.82/third_party/blink/renderer/core/script_tools/model_context.cc): caller cancellation rejects the resolver, while the tool callback receives only its input object.
The site supports the [documented execution signal](https://developer.chrome.com/docs/ai/webmcp/imperative-api) when a browser supplies it and maintains its own registration cleanup signal.
This run does not establish that Chrome 152 cancels the underlying fetch.

The result is `passed-with-browser-limitation`.
The [preserved native report](evidence/webmcp-runtime-bf6b0418efd5e767.json) contains actual browser command lines, native function identities, tool definitions, raw returned results, request observations, and cancellation evidence.
Its SHA256 is `bf6b0418efd5e767d1ff5eea5d46eacb39af18065fc13ae9c6b4119568ac3f6f`.
The tested corpus hash is `0ce0ccb69c76449e1903def3c7ece534e66ffd8c5c566d9b45bf3f7b5425f52d`.
These findings apply to this browser and corpus snapshot; they do not imply support in ordinary browser sessions without an origin trial or testing flag.

With the current production build served on port 8787, repeat the native check with:

```sh
npx tsx scripts/verify-webmcp.ts
```

The script writes `.build/webmcp-runtime.json` and preserves successful native evidence under `docs/evidence/` with a verified SHA256 copy.
