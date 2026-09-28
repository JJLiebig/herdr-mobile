# Native Windows acceptance gate

**No live prompt/key input may be enabled until this is proved on the actual Windows desktop and laptop builds.**
Use an isolated existing test session, not valuable active production work. The read-only probe does not create one.

The owner separately approved standard Herdr attach/resume and shared terminal sizing. Viewport control is
implemented and tested on the desktop; it does not enable prompts or raw keys. This supersedes the original
non-resizing/no-resume assumption for an explicitly opened pane.

## 1. Capture exact identity and supported interfaces

Run `npm run probe:windows` with the exact absolute `HERDR_BIN_PATH`. Keep the schema, version and snapshot locally.
Confirm the daemon/client versions match, the intended socket/pipe is selected, and returned terminal/pane/native-session
IDs are concrete. Never match by cwd. Local evidence can contain sensitive paths; it is ignored by Git.

The probe only reads version, schema, snapshot and CLI help. A controller --help success is NOT a control test.

## 2. Observe without disrupting

With an identified test terminal, verify the documented `terminal session observe` command yields an initial full
ANSI frame and subsequent monotonic frames on native Windows. Validate the optional xterm renderer locally. Changing
phone views must not focus, resize, zoom or rearrange the desktop. Disconnecting must leave agents alive.

Test process exit, missing executable, mismatched protocol, invalid/truncated JSON, renderer backpressure, network
loss, desktop focus changes, and resubscription. A fresh observer must start with a full frame before deltas apply.

## 3. Implement and prove control (not present in this draft)

Use the documented JSON terminal controller rather than the full Herdr TUI or ordinary direct attach.
Take control explicitly, expose ownership and takeover, and release on disconnect/background. Do not auto-takeover.
Independent mobile/desktop PTY dimensions must not be promised; document and test actual shared sizing behavior.

Prompts should go through agent.prompt semantics; dialog keys are separate. Preserve half-written desktop input.
Prove occupant identity is pinned AT the authoritative write, not merely in a preceding snapshot. If the current API
cannot provide this, add a narrowly scoped upstream guarded operation instead of claiming the race is fixed.

## 4. Failure matrix

| Case | Required outcome |
| --- | --- |
| Two agents in the same repo; pane moves/replacement; agent exits to shell | Correct exact identity or reject; never route by focus/cwd |
| Desktop draft already present | Preserve it; require deliberate conflict handling |
| Double Send / old operation ID with changed payload | One operation or explicit conflict |
| Lost response / companion crash after potential write | Outcome unknown; no replay |
| Herdr daemon restart while companion stays alive | Detect true daemon/occupant generation before another write |
| German umlauts, emoji, multiline paste and IME composition | Exact reviewed text; Enter never implicitly submits composer |
| Android keyboard opens/closes; rotate; screen lock; return | Readable single pane, usable composer, fresh state before writes |
| Voice permission denied, 3-minute cap, 8-MB cap, pane switch, concurrent typing | Recoverable failure; original draft binding; no auto-send |
| Foreign Host/Origin; untrusted network access | Reject browser requests; firewall limits network access |

## Evidence to attach to the future live-control PR

Exact binary/version/schema identity; OS and phone/browser version; pass/fail table; replayable tests; bounded diagnostic
logs containing no prompts or secrets; and explicit remaining limitations. Do not label a Linux mock as Windows proof.
