# Herdr Mobile

**v0.1.0-draft.1 — a mobile-first companion for existing Herdr agents.**

Find an agent, open one pane, read, type or dictate, review, and send deliberately.
Windows remains the execution host. Existing panes use standard Herdr attach/resume behavior.

The mobile terminal now controls the selected pane's shared dimensions so the agent renders at phone
width. Keyboard and rotation changes resize it too. Leaving/backgrounding releases control to Herdr;
an active desktop geometry owner restores its sizing. Live prompt submission and keys remain disabled.

> This is a first implementation draft, not a finished live-control release.
> Demo interaction works. The real Herdr adapter supports native-Windows read-only observation.
> There is no switch to enable live prompt submission in this revision.

[Overview preview](docs/preview/overview.png) · [Focused agent preview](docs/preview/focus.png)

## Run the draft

Requires Node.js 22.16+ and npm. No build step is needed. Install the pinned terminal renderer once:

```powershell
npm ci --ignore-scripts
npm start
```

Open `http://127.0.0.1:8787` on that computer. The cards and output are clearly labeled fixtures.
Try multiline typing, agent switching, draft recovery, attention filtering, and simulated Send.

```powershell
npm run check
```

This runs syntax checks and dependency-free Node tests. No Herdr installation, credentials, transcription
billing, or active agent session is involved.

## What is in this draft?

| Area | Status |
| --- | --- |
| Overview: spaces, flat pane cards, tab context, search, attention filter | Implemented; DOM-smoke checked |
| Focus: one output view, normal multiline composer, explicit Send | Implemented in demo; DOM-smoke checked |
| Draft isolation, late-transcript conflicts, duplicate-operation handling | Implemented; automated tests |
| Browser recording and host-side OpenAI file transcription | Implemented; provider mocked in tests; real microphone/API not exercised |
| Herdr snapshot normalization and JSON terminal observer | Native Windows snapshot, full frame, reconnect and layout preservation checked |
| Live ANSI display | xterm 6.0.0 installed and locked; Android display acceptance remains open |
| Real agent prompts, terminal keys, input ownership, resize/release | **Not implemented; server rejects live mutations** |
| PWA manifest | Included; no service worker/offline mode in this draft |
| Direct private-network access | Configurable bind and exact origin; no separate app login |

### The deliberately small first-draft stack

The original blueprint recommends React/TypeScript and a Rust companion. This reference draft instead uses
**plain browser ES modules and Node's built-in HTTP server**, so the demo and safety tests run without a
build chain or installed dependencies. This is an explicit prototype implementation choice, not a hidden
claim that the recommended production stack has been built. See [architecture decision](docs/architecture.md).

## Voice

Copy `.env.example` to `.env`, add your own `OPENAI_API_KEY`, and restart. The host keeps the key; the
browser never receives it. The default configured model is `gpt-4o-mini-transcribe`, adjustable via
`HERDR_MOBILE_TRANSCRIPTION_MODEL`.

The flow is **Record → Stop → Transcribe → review/edit → explicit Send**. Transcribe sends recorded audio
to OpenAI and may incur API charges. It is separate from sending to the agent. No full conversation
history is supplied as speech context. Audio stays transient in browser/server memory and is retained
in the browser only for explicit retry after a failed transcription.

Phone recording needs HTTPS and microphone permission. Keyboard dictation works in the ordinary text
field independently of the optional transcription integration. Native Android microphone behavior has
not been verified in this draft.

## Read-only Herdr integration

First use the **exact Windows-built executable**, not an assumed PATH binary:

```powershell
$env:HERDR_BIN_PATH = 'C:\Code\herdr\target\release\herdr.exe'
npm run probe:windows
```

The probe runs version/schema/snapshot/help reads only and writes local evidence under ignored
`artifacts/windows-probe`. It does not prove control or send commands to an agent.

Then set `HERDR_MOBILE_MODE=herdr-readonly` and the same absolute `HERDR_BIN_PATH` in `.env`.
Keep `HERDR_SOCKET_PATH` aligned with the existing session where necessary.

The renderer is included by `npm ci`. Its JavaScript/CSS comes from the companion, never a runtime CDN.
Interrupted read-only streams reconnect after a fresh snapshot validates the same pane and session.

Read [Windows gate](docs/windows-gate.md) before testing real terminals. A failed adapter does not fall
back to launching Herdr, a new agent, a shell, or a WSL instance.

## Android over Tailscale

In `.env`, set the following, replacing the sample IP with the output of `tailscale ip -4`:

```dotenv
HERDR_MOBILE_MODE=herdr-readonly
HERDR_BIN_PATH=C:\Code\herdr\target\release\herdr.exe
HERDR_MOBILE_BIND=0.0.0.0
HERDR_MOBILE_ORIGIN=http://100.64.0.1:8787
```

Run `npm start`, then open that URL on your phone with Tailscale connected. No Serve setup or app login
is needed. Access is controlled by your network and host firewall. Keep the port private.
For home Wi-Fi too, set `HERDR_MOBILE_EXTRA_ORIGINS=http://192.168.178.24:8787` using your computer's
LAN address. Multiple additional addresses can be comma-separated. Drafts are separate for each URL.

Typing works over HTTP. The in-page Record button requires HTTPS; phone keyboard dictation is independent.
For optional HTTPS, use Tailscale Serve with the companion bound to loopback and configure the exact
HTTPS origin. There is no mandatory Tailscale-user header or login allowlist.

For a machine switcher, copy `herdr-mobile.config.example.json` to `herdr-mobile.config.json`, replace
the sample URLs, and set `HERDR_MOBILE_CONFIG=herdr-mobile.config.json`. Switching hosts navigates to the
other host's own configured HTTP/HTTPS origin; no central host aggregator or cross-origin API proxy exists.

See [security](SECURITY.md). Do not expose the companion's port publicly.

## Publish to a new private GitHub repository

**The GitHub repository has not been created by this deliverable.** The connected chat tool did not expose
repository creation. The source package includes a create-only local publishing script targeting
`JJLiebig/herdr-mobile` by default.

From a fresh extraction, with Git and GitHub CLI installed, your Git author configured, and `gh auth login`
completed for the intended personal account:

```powershell
.\scripts\Publish-GitHub.ps1
```

The script runs checks, initializes `main`, makes the first draft commit, creates a **private** repository,
pushes it, and prints verified remote metadata. It refuses an existing repository or `.git` directory,
never force-pushes, and stages only explicit project paths. It has not been executed against GitHub here.
It creates an initial draft commit, not a draft pull request.

## Continue implementation

Start with [AGENTS.md](AGENTS.md), [product](docs/product.md), [implementation slices](docs/implementation.md),
and [validation evidence](docs/validation.md). The [original blueprint](docs/blueprint.md) is preserved.

No license is granted in this draft; choose one deliberately before publishing publicly. This companion
is not an official Herdr release and contains no vendored Herdr implementation.
