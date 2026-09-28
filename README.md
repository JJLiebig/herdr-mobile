# Herdr Mobile

**v0.1.0-draft.1 — a mobile-first companion for existing Herdr agents.**

Find an agent, open one pane, read, type or dictate, review, and send deliberately.
Windows remains the execution host. No agent relaunch, WSL migration, or duplicate conversation.

> This is a first implementation draft, not a finished live-control release.
> Demo interaction works. The real Herdr adapter is read-only and still needs native-Windows validation.
> There is no switch to enable live prompt submission in this revision.

[Overview preview](docs/preview/overview.png) · [Focused agent preview](docs/preview/focus.png)

## Run the draft

Requires Node.js 22.16+ and npm. **No dependency install or build step is needed for the demo.**

```powershell
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
| Herdr snapshot normalization and JSON terminal observer | Adapter code present; native-Windows acceptance gate remains open |
| Live ANSI display | Optional xterm renderer present; dependency not installed or validated here |
| Real agent prompts, terminal keys, input ownership, resize/release | **Not implemented; server rejects live mutations** |
| PWA manifest | Included; no service worker/offline mode in this draft |
| Private-tailnet host/origin/user checks | Implemented and HTTP-tested; actual Tailscale deployment not exercised |

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

For the optional live ANSI renderer, install the pinned draft dependency locally:

```powershell
npm install --no-save --ignore-scripts --package-lock=false @xterm/xterm@5.5.0
npm start
```

The browser loads its JavaScript/CSS from the local companion, never a runtime CDN. Version 5.5.0 is a
pinned prototype target, not a claim about the latest release. Dependency installation, auditing and
renderer integration remain unverified here; commit a reviewed dependency/lockfile before shipping it.
Without it, the demo still works and live mode displays an explicit renderer-installation message.

Read [Windows gate](docs/windows-gate.md) before testing real terminals. A failed adapter does not fall
back to launching Herdr, a new agent, a shell, or a WSL instance.

## Android over Tailscale

Configure your exact `https://machine.tailnet-name.ts.net` origin plus an explicit login allowlist in
`.env`; use Tailscale **Serve**, not Funnel. The companion always binds `127.0.0.1`.

A typical Serve command is `tailscale serve --bg http://127.0.0.1:8787`. Verify it against your installed
Tailscale CLI and confirm the configured origin, forwarded Host and identity behavior before relying on
it. The default loopback configuration deliberately rejects unconfigured remote origins.

For a machine switcher, copy `herdr-mobile.config.example.json` to `herdr-mobile.config.json`, replace
the sample URLs, and set `HERDR_MOBILE_CONFIG=herdr-mobile.config.json`. Switching hosts navigates to the
other host's own private HTTPS origin; no central host aggregator or cross-origin API proxy exists.

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
