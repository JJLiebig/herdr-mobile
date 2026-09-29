# Agent instructions

Read README.md, docs/product.md, docs/architecture.md, docs/windows-gate.md, and docs/implementation.md
before changing behavior. Preserve the original blueprint as historical design input; current gaps and
stack decisions are recorded separately.

## Hard requirements

- Keep overview metadata-only and focus limited to one existing pane.
- Use standard Herdr attach/resume behavior for an explicitly opened existing pane (owner-approved).
  The phone may control its shared terminal dimensions; release control when leaving/backgrounding.
  Never create conversations, move the workflow to WSL, or spawn a shell as a fallback.
- Native Windows is a first-class target. Use the exact configured Herdr executable and its own CLI/schema.
- The owner approved standard Herdr terminal input on the existing controller. No live-input bypass flag.
- Normal prompts and raw terminal dialog keys are different operations. Do not create an automatic Approve action.
- Missing metadata is acceptable. Reuse explicit labels and existing summaries; no new AI summarization call.
- Bind drafts, voice results and operations to the original host and exact agent/session. Never route by current focus or cwd.
- Bind live input to the original attached controller, pinned by Herdr to its terminal runtime. Snapshot
  checks do not atomically pin the foreground agent session; do not claim that stronger guarantee.
  Preserve ordinary shared-terminal behavior and never automatically clear existing desktop input.
- Unknown outcomes must not be automatically retried. A durable exact-once guarantee is not implemented.
- Never log prompt bodies, audio, raw terminal frames, keys, or tokens.
- Browser audio goes to a configured provider only after explicit consent and action; never auto-send its transcript.
- Direct private-network access is owner-approved. Support an explicit bind address (including 0.0.0.0)
  and exact HTTP/HTTPS origin; keep Host/Origin checks. Network/firewall access replaces application login.
- Do not add public ingress, telemetry, background account sync, generic process execution, or arbitrary proxy APIs.

Run `npm run check` after changes. Tests require no packages. Add tests alongside behavior, not just docs.
Keep native Windows/Tailscale/Android evidence separate from mocks. Never say tests were run when they were not.

Next task: complete the native-Windows read-only observation gate and dependency/renderer setup, then implement
one narrowly reviewed live-control slice with explicit ownership and target pinning.
