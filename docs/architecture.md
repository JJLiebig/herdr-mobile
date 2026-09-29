# Architecture and first-draft decision

## Draft implementation

```text
Android / desktop browser
  metadata-only overview | one-pane view | native terminal input
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
| POST /api/terminal?... | Standard Herdr controller stream with phone columns/rows and terminal input |
| POST /api/viewport | Resize the exact attached controller using its stream ID; invalid after release |
| POST /api/scroll | Forward a bounded wheel scroll to that same controller; invalid after release |
| POST /api/input | Raw xterm keyboard/paste data through its original live controller |
| POST /api/transcribe | Bounded recorded audio, explicit cloud consent, returned text |

A companion epoch is NOT a Herdr server epoch. It protects draft requests across companion restarts but cannot
prove daemon identity across a daemon restart under the same companion. The attached native controller pins the terminal runtime for its lifetime; it cannot follow a replacement daemon.
This does not atomically pin the foreground agent conversation inside that runtime.

Owner-approved exception: viewport control uses standard Herdr attach/resume, including its ability to resume
a dormant saved agent. It changes the shared PTY dimensions, with no automatic takeover. The owner also requested standard terminal input on this connection.
The browser measures terminal cells against the available content box and sends changes on viewport resize.
Closing the stream kills the controller client and releases Herdr ownership. Herdr restores active desktop
geometry where available; a detached host may retain the last size until its next desktop attach/resize.

Reopening is required after a known pane/session identity change. Snapshot checks are not themselves
an atomic foreground-process guard inside Herdr.

The former draft ledger is not used for direct keystrokes. Input is sent once with no automatic retry.

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

## Direct terminal input (owner-approved)

The separate mobile composer was removed at the owner's request. The floating keyboard button focuses
xterm's native input; its onData stream forwards characters, IME input, paste, and keys to the attached
Herdr controller. The local renderer enables bracketed paste so Herdr receives clipboard text as one paste
and applies the attached runtime's paste mode. Enter behaves exactly as in the TUI. No prompt emulation,
submission delay, or separate Send flow is used. Voice UI is deferred.

The first full frame is required before input. Each request captures the original controller lease;
leaving the view invalidates it. The browser serializes input so network timing cannot reorder keys.
On failure, disconnection, or backgrounding it closes that connection, discards unsent queued input,
and asks the user to return to Agents, reopen the pane, and check what arrived. It never retries input
or automatically attaches a new controller.

This is ordinary shared-terminal behavior: existing desktop text is preserved, and the controller
pins the terminal runtime rather than atomically pinning its foreground process. The controller has
no input acknowledgment; HTTP success means forwarded to its stdin, not accepted by the agent.
