# Implementation slices from this draft

## Slice 1 — native-Windows observation (next)

Run the probe on both hosts. Confirm snapshot fields from the exact installed schema, with fixtures for Codex,
OpenCode, a shell pane, and two sessions in one cwd. Install/audit/pin xterm with a lockfile or audited vendored assets.
Prove one read-only observer, initial full-frame behavior, reconnect, bounded output and cleanup. Replace the provisional
read-only snapshot polling with event subscription only after baseline correctness is measured.

Exit: the phone can locate and read the intended live pane over private HTTPS without changing desktop layout.
No live-write feature flag is added.

## Slice 2 — deliberate, identity-safe live control

Implement an explicit ownership state machine and exact target pinning with the existing Herdr APIs or the smallest
necessary upstream guarded extension. Reject unknown identity and occupant replacement. Keep agent.prompt and dialog
keys distinct. Handle an existing desktop draft without overwriting it. Extend operation statuses beyond demo and
preserve unknown outcomes across a dropped response; decide whether a small durable outcome journal is necessary.

Exit: native Windows multiline Unicode input reaches exactly the selected agent; desktop focus changes and reconnect
cannot redirect it, and closing the mobile view leaves work running.

## Slice 3 — real Android voice and UX

Test permission, capture formats, keyboard composition, full-page versus installed-web-app viewport, recording caps,
background cancellation, provider errors and voice-result conflict handling. Exercise actual transcription with a
user-configured API key and explicit consent. Add a real-browser suite with device-sized viewports; do not treat the
included offline DOM harness as Android evidence.

Exit: record/stop/transcribe/review/send works on the user's phone, with no automatic retries or pane misrouting.

## Optional after the above

Native Codex/OpenCode titles and public message summaries, bound to the exact reported session and correct profile.
No new conversations or inference calls. Missing enrichment must not affect observation or control.

A service worker, push notifications, cross-host aggregation, a full chat transcript reader, image uploads and local
speech inference are not required to finish v1. Keep them out of the critical path.
