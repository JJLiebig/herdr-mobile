# Validation — 2026-09-28

## Current Windows validation

- Node 26.10.0 on native Windows: `npm run check` passes 53 tests and syntax-checks 23 modules.
- Exact configured `C:\Code\herdr\target\release\herdr.exe`: client and daemon 0.9.1,
  protocol 22; schema JSON and real snapshots successfully parsed. About 30 live agents were present.
- Two read-only observations of the caller's exact pane started with full ANSI frames and released cleanly.
  Snapshot comparison confirmed unchanged focus, layouts and terminal identity. No input or resize was sent.
- xterm 6.0.0 installed with scripts disabled and a lockfile; npm audit reported zero vulnerabilities.
  It is the current stable npm release, published 2025-12-22 (older than seven days).
- Real Chrome over the Tailscale HTTP address loaded the actual app and renderer. Live output,
  multiline Unicode/Enter, draft recovery after reload and automatic recovery after a browser-simulated
  network disconnect passed. Page overflow checks passed at 320px and 393px portrait widths and 852px landscape.
- Both the Tailscale and configured LAN HTTP addresses returned real snapshots and renderer assets.
  HTTP tests also cover both allowed addresses and rejection of mismatched Host/Origin combinations.
- Regression tests cover pane-label merging, storage getter failure, actual deletion of expired drafts,
  full-frame reconnect, background cleanup and refusing to follow a replaced session. DOM/stream doubles
  are explicitly separate from the real-browser and native-Windows checks above.

Actual Android output/keyboard/rotation acceptance, the second Windows host, browser microphone capture,
paid transcription, live input and control ownership remain unverified. HTTP intentionally does not support
browser microphone capture. No Tailscale Serve or firewall configuration was changed.

## Original draft evidence (Linux; historical)

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

## Not executed by the original draft author

Native Windows execution or PowerShell publishing; real Herdr snapshot/observer/control; xterm installation/rendering;
Tailscale Serve/proxy identity behavior; real Android microphone or keyboard; a paid transcription request; GitHub
repository creation, push, or CI run. The publishing script has not modified GitHub.

## Original included evidence

- [Node checks: 49 passed, 0 failed](validation/node-tests.txt)
- [Seven offline mobile DOM checks](validation/browser-smoke.json)
- [Overview](preview/overview.png) and [focused pane](preview/focus.png) screenshots

The optional reproducible harness is `scripts/validation/browser-smoke.py` and requires Python Playwright
plus Chromium. It is not part of the no-dependency Node test suite. Run it only with port 8787 free;
its fixtures and outputs are local. It writes new evidence to ignored `artifacts/browser-smoke/`.

The live-input acceptance gate remains open. Passing the local suite does not make this a live-control release.
# Mobile viewport follow-up — 2026-09-28

- Integrated approved Priority/Spaces landing and fullscreen thread controls; landing Review Suite fast completed after verified fixes.
- 56 Node tests pass, including measured terminal geometry, same-controller resize, lease invalidation on disconnect, CSRF enforcement and unknown-send draft retention.
- Actual native Windows controller on this agent's existing pane produced an initial full 44x35 frame and a subsequent 62x24 frame, then released. No keystrokes or prompts were sent.
- Actual Chrome: 393px phone viewport rendered a 362px terminal surface; opening the composer and reducing viewport height resized the terminal height. Landscape 852px rendered an 816px terminal surface. Back released control.
- Physical Android keyboard/rotation acceptance remains with the user. Desktop size restoration follows Herdr's active geometry owner; no independent mobile PTY is claimed.
