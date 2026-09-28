# Herdr Mobile Web — v1 blueprint

**Date:** 28 September 2026  
**Status:** Proposed implementation plan; documentation and source inspected, not tested against the user's Windows builds.  
**Working name:** `herdr-mobile` (a proposed companion, not an existing Herdr command).

## 1. Product decision

Build a mobile remote for existing Herdr agents, not a browser copy of the desktop workspace manager.

The workflow is **find agent → open one pane → read → type or dictate → send → leave**.

Native Windows desktop and laptop remain the execution hosts. Android connects over the existing Tailscale network. Do not move the workflow into WSL, relaunch agents under a new runtime, or create duplicate Codex/OpenCode conversations.

Ship two screens: an overview and a focused agent view. A small settings sheet handles the host list, connection details, and transcription configuration. No central server, account system, or persistent conversation database.

## 2. Screens

### Overview

Use a machine selector, collapsible Space groups, and flat agent/pane cards. Tabs appear as labels and filters, not nested terminal layouts. Default to agents, with an All panes filter for shells and logs.

```text
DESKTOP ▾                       Connected

NEXTIDE                         1 needs input
  Scheduler fixes                    Codex
  Daedalus · implementation
  Needs input · “Run the wider tests?”

  Creator ingestion               OpenCode
  Kraken · ingestion
  Working · “Adding retry coverage”

TOOLS
  Mobile input fixes                 Codex
  Herdr · main
  Ready · updated 2 minutes ago
```

The text above is illustrative, not retrieved session content.

Each card has a primary title, Space/Tab breadcrumb, agent kind, state, optional one-line description, and freshness. Put attention items first without continuously reshuffling the card being touched. Do not stream terminal output or load full histories on this screen.

**Title precedence:** explicit Herdr agent/pane label → trusted native thread title → Herdr metadata title or normalized terminal title → agent kind plus directory name. Preserve a custom user label even when upstream titles change.

**Description precedence:** existing display-summary metadata → downstream-provided human-readable summary → a clearly labeled last-answer excerpt → nothing. Missing summaries are acceptable. Do not run a summarizer or expose internal compaction/reasoning text just to fill a card.

Show Working, Needs input, Ready, and Unknown. Track connection freshness separately: stale data must not masquerade as current state. “New output” is a mobile-local unread marker, not proof that a task succeeded.

### Focus

Tapping a card opens exactly one pane. Keep the machine, agent, and Space/Tab breadcrumb visible while typing. Back returns to the same overview position.

```text
‹ Nextide / Daedalus          DESKTOP
Scheduler fixes · Codex

           ONE AGENT'S OUTPUT
           Full-width, scrollable

[Latest] [Esc] [↑] [↓] [Enter] [More]

┌─────────────────────────────────┐
│ Normal editable multiline text  │
│ or a reviewed voice transcript  │
└─────────────────────────────────┘
[Record]                  [Send to Codex]
```

The v1 output baseline is the selected terminal, not a four-pane mosaic. Include readable font sizing, scroll/follow controls, copy selection, and a keyboard-safe composer. Keep raw terminal typing behind an explicit mode so terminal keystrokes and phone text editing cannot mix accidentally.

A clean conversation reader is an enhancement, not a prerequisite. Enable it only when genuine structured user/assistant messages are available for the exact live session. Otherwise display the terminal honestly; do not convert screen refreshes into fake chat messages.

## 3. Existing interfaces and the Windows gate

Herdr documents local named-pipe RPC on Windows, session snapshots/events, agent/pane metadata, native session references, and an installed-binary schema command.[1]

**Important distinction:** Herdr's ordinary direct `agent attach` / `terminal attach` is documented as unavailable on native Windows. The separate machine-readable `terminal session observe/control` interface is the candidate bridge surface; do not substitute the ordinary attach command.[2]

Current source implements JSON frame output and JSON control input through Herdr's platform IPC layer.[3] This makes it a useful integration candidate, **not a claim that it works on the user's particular build**.

The first implementation task must use the exact configured checkout-built executable, not an assumed PATH installation. Record the client/server versions and schema capabilities. In an isolated test session, prove that native Windows can enumerate, observe, control, resize, and release a single existing terminal.

Use the documented JSON observer/controller CLI through ordinary redirected stdin/stdout. Do not initially build a new PTY host, wrap the full Herdr TUI in ConPTY, or implement Herdr's binary rendering protocol independently.

If this gate fails, isolate the unsupported operation and make a narrowly scoped Herdr transport fix or report the required version. Do not silently switch to WSL, restart active agents, or hide the problem behind a full-desktop mirror.

## 4. Small architecture

```text
Android Chrome / installable PWA
           │ HTTPS / WebSocket over Tailscale
           ▼
Tailscale Serve on the selected Windows host
           │ loopback only
           ▼
herdr-mobile companion, same Windows user as Herdr
           ├─ metadata / state → Herdr local RPC
           ├─ selected output → JSON terminal observer/controller
           ├─ prompt / keys   → Herdr agent control
           ├─ optional metadata adapters → exact native agent session
           └─ recorded audio → configured transcription API
```

Recommended implementation: React + TypeScript + Vite frontend; xterm.js for the selected terminal; a small Rust HTTP/WebSocket companion embedding the built frontend. These are proposed choices, not mandatory existing Herdr components.

Install one companion on each host. For v1, switching machines navigates to that host's own HTTPS origin. Store an explicit allowlisted host list; do not build cross-machine aggregation, arbitrary reverse proxying, or shared cross-origin authentication. Drafts remain scoped to their host and session.

A Herdr plugin can later supply a Start mobile access action and packaging. Keep the voice feature and web UI in the companion initially rather than making a general-purpose plugin framework.

Cache only the PWA shell. Keep session output out of the service-worker cache. Use local draft storage with a visible Clear drafts action; keep only the necessary metadata and bounded terminal frames in memory on the companion.

## 5. Agent metadata without new AI work

Herdr's existing metadata is the first source. Native metadata adapters are optional, read-only enrichment and must fail independently of terminal control.

Codex App Server documents stored-thread reads without resuming, with names available when set. OpenCode documents session/message reads and connecting to its running server.[4][5] These are separate integrations, not automatic access to any live terminal process.

Bind the adapter to the exact native session reference reported for the pane. Never match by repository directory alone. Respect the correct Codex home/profile and OpenCode instance, including multiple sessions in the same repo. Probe the user's fork/version instead of assuming upstream compatibility.

For Codex, do not call resume/start merely to inspect metadata or claim that a second app server's runtime status describes the existing CLI. For OpenCode, resolve the running instance rather than creating a new server as a substitute. Do not call a summarize endpoint to populate cards.

On missing identity, stale metadata, unsupported APIs, or reader errors: keep the Herdr label and terminal working. No inference call is needed for overview navigation.

## 6. Text input and control safety

Use an actual multiline textarea. Android keyboard dictation, paste, selection, autocorrect, and composition should operate on the local draft, not an emulated terminal keyboard. Enter adds a newline; only Send submits. Never submit while IME composition is active.

Send the completed draft using Herdr's agent-level prompt operation. Herdr documents paste-aware submission, Windows Codex handling, blocked-agent rejection, and warnings against retrying an ambiguous timeout.[6] Preserve those semantics rather than implementing paste-plus-an-arbitrary-delay in the browser.

Normal prompts and terminal-dialog responses are separate actions. When blocked, keep the draft and show the actual live dialog. Offer deliberate keys, including arrows, Enter, Esc, and Ctrl+C under More. Do not invent a universal Approve button or automatically send `y`.

Bind every action to the host, server epoch, terminal identity, and current agent/session where available. Revalidate before writing. On pane replacement, agent exit, or unknown identity, reject instead of allowing the prompt to fall into a shell. Use JSON/stdin, never shell interpolation of user text.

Attach a client-generated operation ID and deduplicate repeated requests in the companion. Distinguish accepted-by-bridge, submitted, failed, and outcome-unknown. A network disconnect or companion crash after a write can leave the outcome unknown: do not claim exactly-once delivery or automatically replay. Retain the text until submission is acknowledged; keep a recoverable last-sent copy without an auto-resend action.

Overview browsing must not focus, zoom, or rearrange the desktop. Start passive; taking interactive control must be explicit and visible. Allow only one mobile controller per terminal, and require confirmation before takeover. Do not overwrite a half-written desktop prompt.

Resizing the controlled terminal can affect its shared PTY; do not promise independent phone/desktop terminal dimensions. Test ownership restoration and verify that unrelated panes/layouts remain untouched.

## 7. Voice transcription belongs in v1

Ship **record → stop → transcribe → review/edit → Send**. No automatic sending, always-on microphone, speaker diarization, or realtime voice conversation.

The microphone is on the Android phone. Browser capture requires a secure context and permission.[7] Record using browser media APIs with supported-format detection. Set a proposed three-minute recording cap and a bounded upload size. Show elapsed time, Cancel, Transcribing, and recoverable errors.

The companion forwards the recording to one configured speech-to-text provider and returns text. Keep credentials on the host. A recorded-audio transcription API already supplies this operation; OpenAI's current guide documents the endpoint and accepted formats.[8] A cloud provider receives the audio: disclose the selected provider before first use. Do not send full agent transcripts as speech context by default.

Insert the result into the originating pane's draft. Capture draft revision and insertion position; a late result must not overwrite subsequent typing or appear in whichever pane the user switched to. Retain the recording transiently for explicit retry after failure, and discard it on success/cancel. No audio or prompt bodies in logs.

Support keyboard dictation as a fallback even when the custom microphone feature is unconfigured. Wispr Flow also has an Android app; testing it against the normal textarea is optional and does not require a Herdr plugin.[9] A local Whisper backend is a later alternative, not another v1 subsystem.

Do not depend on browser SpeechRecognition for the core microphone feature: browser coverage is limited.[10] Live partial transcription can be v1.1 after the record-and-review loop is dependable.

## 8. Network, security, and recovery

Use Tailscale Serve, not Funnel. Serve provides private-tailnet HTTPS routing, access-control enforcement, and identity headers; its backend should listen only on loopback.[11]

Authorize an explicit Tailscale user allowlist at the companion, reject absent/untrusted identity, and apply strict expected Host/Origin checks to HTTP mutations and WebSocket upgrades. Do not use wildcard CORS or expose the raw Herdr RPC. Restrict the companion API to required reads, prompt submission, terminal control, and transcription; omit server-stop, arbitrary process launch, filesystem writes, and generic proxy endpoints.

Treat all metadata and terminal output as untrusted display content. No raw HTML, terminal-driven clipboard writes, or unvalidated URL execution. Bound frames, queues, audio uploads, and requests. Reject unauthorized users before opening terminal streams or invoking transcription.

On reconnect, rebuild authoritative state before enabling writes. Preserve drafts, discard stale viewport frames, and require a fresh snapshot/full frame before applying deltas. If output frames are dropped under backpressure, resync rather than rendering corrupt incremental state.

When Android backgrounds the app, release interactive control after a short grace period; reacquire visibly on return. Closing the phone UI or companion must not stop Herdr or its agents. An asleep/offline host is unavailable: show that condition, not a forever-live spinner.

## 9. Delivery slices and scope boundary

| Slice | Exit criterion |
|---|---|
| **A — Windows transport proof** | Exact build: metadata, one-pane observer/controller, multiline Unicode submission, resize/release, and disconnect recovery pass in an isolated session. |
| **B — Usable mobile remote** | Overview cards, one focused terminal, keyboard-safe composer, safe routing, private HTTPS, and host switching work on Android. |
| **C — Voice and polish** | Record/review/send, per-pane draft recovery, attention markers, and failure-state tests pass. Optional native titles enrich rather than block release. |

Required acceptance cases: two similar agents in the same repo; reused pane identity; desktop focus changes while composing; existing desktop draft; German umlauts and emoji; multiline paste; microphone denial; host/pane switch during transcription; double-tap Send; network loss before/after submission; screen lock and return; companion restart; stale summary; unauthorized host/origin/user.

Explicitly out of scope: launching/rearranging agents or worktrees, unified cross-host live dashboards, a full Codex/OpenCode chat replacement, generated summaries, image uploads, diff editors, push notifications, background voice, local GPU speech deployment, and multi-user collaboration.

**Definition of done:** From Android, find the right Windows-hosted agent, understand its current state, inspect that one pane, dictate an instruction, correct the transcript, send it once deliberately, and return later without disrupting the existing desktop workflow.

## Sources inspected

References support current interface observations; all feature boundaries and implementation choices above are proposals.

1. Herdr Socket API: https://herdr.dev/docs/socket-api/
2. Herdr persistence / direct attach / JSON observer-controller: https://herdr.dev/docs/persistence-remote/
3. Herdr source, JSON terminal sessions: https://github.com/herdrdev/herdr/blob/master/src/client/terminal_sessions.rs ; CLI: https://github.com/herdrdev/herdr/blob/master/src/cli.rs
4. Codex App Server, stored-thread reads: https://developers.openai.com/codex/app-server/
5. OpenCode server: https://opencode.ai/docs/server/
6. Herdr agent automation: https://herdr.dev/docs/agent-automation/
7. Browser microphone capture: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
8. Recorded-audio transcription: https://developers.openai.com/api/docs/guides/speech-to-text
9. Wispr Flow Android: https://wisprflow.ai/android
10. Browser SpeechRecognition compatibility: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
11. Tailscale Serve: https://tailscale.com/docs/features/tailscale-serve
