# Security boundaries — draft

This is a personal remote-control companion under development, not an audited production service.
The live terminal controller can send input to an existing Herdr pane.

The HTTP listener defaults to 127.0.0.1. Set `HERDR_MOBILE_BIND=0.0.0.0` and an exact
`HERDR_MOBILE_ORIGIN` for direct phone access over your private network. There is no application login:
any device allowed through the network/firewall can read panes, send terminal input, and use a configured voice provider.
Restrict the port to the intended trusted devices/network; do not publish it on the internet.
Tailscale Serve is optional HTTPS, not an authentication dependency. Identity headers are not trusted or required.

Every request is checked for the expected Host, nonforeign Origin, and browser cross-site context.
Mutations require the exact Origin plus `X-Herdr-Mobile: 1`. These browser protections remain in place
for direct access. No wildcard CORS or generic Herdr RPC passthrough is present.

Static files use an explicit route map; .env, source/config files and arbitrary filesystem paths are
not served. Terminal/metadata content is treated as untrusted text. The locally installed terminal renderer
blocks browser-action OSC handlers and registers no clipboard or link integration. Its dependency
is pinned with an npm lockfile. Complete ANSI behavior still requires device validation.

Only the configured Herdr executable is launched, with fixed snapshot, observe, or terminal-control argv and no shell. Web requests
cannot specify executable paths, command lines, raw RPC methods, process launch or agent startup.
Leaving the focused pane releases its terminal controller and shared size. The controller is pinned to its terminal runtime,
but a snapshot check does not atomically pin the foreground agent session.

Audio uploads are bounded to 8 MB, two active transcriptions, and 30 provider requests per hour per
companion. Browser recordings are capped at three minutes. Keys stay on the host. No audio, prompts,
terminal output, or upstream errors are logged or deliberately persisted server-side. Cloud provider
retention is governed by that provider/account, not this application; do not claim zero provider retention.

Draft text, pending transcripts and last-sent copies expire after seven days, with at most 50 stored entries.
Expired entries are deleted when the app next loads or saves; a closed browser cannot run cleanup.
This is not encrypted application storage. Audio is not stored there.
On shared devices, clear the browser's site data to remove saved drafts immediately. There is no offline service-worker cache in this draft.

The native-Windows and Android acceptance steps in docs/windows-gate.md still need real-device evidence,
including occupant replacement races, half-written desktop prompts, ambiguous delivery, controller release, and unauthorized origins.
