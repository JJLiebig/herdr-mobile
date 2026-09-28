# Architecture and first-draft decision

## Draft implementation

```text
Android / desktop browser
  metadata-only overview | one-pane view | local text/voice draft
                 |
        same-origin HTTP + SSE
                 |
  Node companion on configured address:8787
      |-- demo fixtures (explicitly marked)
      |-- Herdr read-only adapter
      |     |-- exact.exe api snapshot
      |     `-- exact.exe terminal session observe <terminal_id>
      `-- optional recorded-audio transcription
            fixed OpenAI endpoint; server-held key
```

Direct access uses a configured bind address and HTTP/HTTPS origin; private-network/firewall access
replaces an application login. Tailscale Serve is optional HTTPS for browser microphone support.
One companion per host; host switching is top-level navigation to a configured origin.
No remote-shell bootstrap, new PTY runtime or cloud orchestration layer is introduced.

## ADR 001: no-build reference prototype

The original blueprint suggested React/TypeScript + Rust. This draft uses browser ES modules and Node built-ins
so its small demo and safety model run without installing a dependency tree or Rust toolchain. It is a deliberate
implementation-prototype deviation, not an assertion that the originally proposed stack is already present.

Benefits: immediate local preview, no backend framework dependency, small review surface, tests run offline.
Tradeoff: no compile-time TypeScript contract, no embedded single Rust executable, and a simple DOM renderer.
React/TypeScript and a Rust companion can replace either side later without changing the product or wire contract;
do not maintain duplicate implementations now. Do not port just for parity before the Windows transport is proven.

The only third-party UI component is locally installed xterm.js for live ANSI frames. Demo output is
plain fixture text, not a hand-written terminal emulator. No dependency is fetched automatically by this code.

## Wire surface

| Route | Meaning |
| --- | --- |
| GET /api/snapshot | Normalized metadata, host, companion epoch, timestamps and capabilities |
| GET /api/output?terminal=... | Demo-only illustrative text |
| GET /api/terminal?terminal=...&pane=...&session=...&epoch=... | Read-only SSE observer, matched to current snapshot |
| POST /api/terminal?... | Standard Herdr controller stream with phone columns/rows; no terminal input |
| POST /api/viewport | Resize the exact attached controller using its stream ID; invalid after release |
| POST /api/prompt | Demo-only operation; live mode returns 501 |
| POST /api/transcribe | Bounded recorded audio, explicit cloud consent, returned text |

A companion epoch is NOT a Herdr server epoch. It protects draft requests across companion restarts but cannot
prove daemon identity across a daemon restart under the same companion. This is one reason live writes remain
unimplemented. Before adding them, obtain a real Herdr server/occupant generation or prove equivalent pinning.

Owner-approved exception: viewport control uses standard Herdr attach/resume, including its ability to resume
a dormant saved agent. It changes the shared PTY dimensions, with no automatic takeover and no keystrokes.
The browser measures terminal cells against the available content box and sends changes on viewport resize.
Closing the stream kills the controller client and releases Herdr ownership. Herdr restores active desktop
geometry where available; a detached host may retain the last size until its next desktop attach/resize.

The frontend has separate local draft keys and action targets. Known native sessions preserve drafts across
companion restarts; unknown sessions isolate by companion epoch. Reopening is required after an identity change.
Neither convention is itself an atomic write guard inside Herdr.

The ledger deduplicates operation IDs in one companion lifetime and refuses over-capacity writes. It stores
hashes/outcomes, not prompt bodies. It is not durable and does not promise exactly-once delivery.

## Protocol evidence

Source/interfaces inspected on 2026-09-28:

- https://herdr.dev/docs/socket-api/
- https://herdr.dev/docs/persistence-remote/
- https://github.com/herdrdev/herdr/blob/master/src/client/terminal_sessions.rs
- https://github.com/herdrdev/herdr/blob/master/src/api/schema/session.rs
- https://github.com/herdrdev/herdr/blob/master/src/api/schema/agents.rs
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://tailscale.com/docs/features/tailscale-serve

These support adapter design, not proof against a particular Windows build. The user must run the exact-build gate.
