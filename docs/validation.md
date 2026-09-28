# Validation — 2026-09-28

## Executed in this workspace

`node scripts/check.mjs` ran on Node 22.16.0 / Linux. The included log records the exact test count and outcomes.
The suite covers naming and snapshot normalization, target identity, draft/voice conflicts, origin/host/user checks,
fixed provider routing and error redaction, duplicate-operation handling, real HTTP responses, and disabled live writes.
No paid transcription API was called; transcription provider behavior was mocked.

An offline Chromium DOM harness exercised seven cases at a 393 × 852 mobile-sized viewport: grouped cards, focus and
multiline Unicode/Enter behavior, isolated pane drafts, explicit simulated submission, last-sent recovery/settings,
attention filtering, and absence of page overflow/uncaught JavaScript errors. Screenshots are included under `preview/`.

The browser environment blocked direct localhost navigation. The DOM harness therefore injected the local application
assets, mocked browser storage/history, and bridged fetch to the generated local HTTP server. This is deliberately NOT
reported as real-origin browser end-to-end testing or as an Android/device test.

## Not executed here

Native Windows execution or PowerShell publishing; real Herdr snapshot/observer/control; xterm installation/rendering;
Tailscale Serve/proxy identity behavior; real Android microphone or keyboard; a paid transcription request; GitHub
repository creation, push, or CI run. The publishing script has not modified GitHub.

## Included evidence

- [Node checks: 49 passed, 0 failed](validation/node-tests.txt)
- [Seven offline mobile DOM checks](validation/browser-smoke.json)
- [Overview](preview/overview.png) and [focused pane](preview/focus.png) screenshots

The optional reproducible harness is `scripts/validation/browser-smoke.py` and requires Python Playwright
plus Chromium. It is not part of the no-dependency Node test suite. Run it only with port 8787 free;
its fixtures and outputs are local. It writes new evidence to ignored `artifacts/browser-smoke/`.

The live-input acceptance gate remains open. Passing the local suite does not make this a live-control release.
