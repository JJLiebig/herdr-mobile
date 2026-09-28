# Security boundaries — draft

This is a personal remote-control companion under development, not an audited production service.
Live writes to Herdr are intentionally absent.

The HTTP listener binds only 127.0.0.1. Remote use requires a configured Tailscale HTTPS origin and
an explicit `HERDR_MOBILE_ALLOWED_LOGINS` allowlist. The application trusts Tailscale identity headers
only under that configured loopback-proxy topology. Local processes on the host remain inside the trust
boundary and can forge proxy headers; this is not isolation against a compromised local user/process.
Do not put an arbitrary reverse proxy in front of the server or expose the backend port.

Every request is checked for the expected Host, nonforeign Origin, and browser cross-site context.
Mutations require the exact Origin plus `X-Herdr-Mobile: 1`. Remote identity is checked before reading
session state or accepting audio. No wildcard CORS or generic Herdr RPC passthrough is present.

Static files use an explicit route map; .env, source/config files and arbitrary filesystem paths are
not served. Terminal/metadata content is treated as untrusted text. The optional terminal renderer
blocks browser-action OSC handlers and registers no clipboard or link integration. Its dependency
and complete ANSI behavior still require validation.

Only the configured Herdr executable is launched, with fixed read-only argv and no shell. Web requests
cannot specify executable paths, command lines, raw RPC methods, takeover, process launch or agent startup.
Exiting the observer kills only the observer subprocess, not the Herdr daemon or its agents.

Audio uploads are bounded to 8 MB, two active transcriptions, and 30 provider requests per hour per
companion. Browser recordings are capped at three minutes. Keys stay on the host. No audio, prompts,
terminal output, or upstream errors are logged or deliberately persisted server-side. Cloud provider
retention is governed by that provider/account, not this application; do not claim zero provider retention.

Draft text, pending transcripts and last-sent copies live in browser-local storage for up to seven days,
with at most 50 stored entries. This is not encrypted application storage. Audio is not stored there.
Use the Clear drafts action on shared devices. There is no offline service-worker cache in this draft.

Before any live-input release, finish docs/windows-gate.md, specifically occupant replacement races,
half-written desktop prompts, ambiguous delivery, controller takeover/release, and unauthorized origins.
