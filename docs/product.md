# Product: Herdr Mobile v1

**Goal:** From Android, find an existing Windows-hosted agent, understand what it needs, inspect its one
pane, type or dictate a reviewed instruction, send deliberately, and leave without disrupting the desktop.

## Two screens

Overview: machine selector, Space groups, flat cards, Tab breadcrumb. Cards contain a stable name, agent
kind, lifecycle state, existing display-summary metadata and freshness. No terminal thumbnails or thread
history. Attention is visible without constantly reshuffling a card under the user's finger.

Focus: one full-width terminal. The floating keyboard button focuses its native input. Typing and Enter
act directly in the TUI, with optional Esc/arrow/Enter buttons for keys missing from phone keyboards.
There is no separate message composer or Send button. Voice input is deferred.

## Metadata

Explicit name/label wins. Then use a correctly bound native title, Herdr metadata title, normalized terminal
title, or agent/directory fallback. Reuse a public display summary if present. Do not expose compaction
internals or private reasoning and do not call an LLM to fill empty summary fields.

The present adapter reads Herdr metadata only. Codex/OpenCode native-session enrichment is not implemented.
Multiple agents in one repository must remain distinct; directory name is not an identity.

## Voice

Record on the phone, stop, explicitly transcribe, review/edit the result, then optionally Send. Voice input
is independent of an agent-conversation transcript reader. The latter is not required for v1.

Capture the originating draft key and revision. A late result is appended only to the unchanged originating
draft; concurrent typing produces a separate reviewable transcript. Never overwrite newer typing or insert
into whatever pane happens to be visible. No streaming partial speech in v1.

## Not in v1

Workspace editing, pane creation/rearrangement, agent launches, a conversation database, generated summaries,
a full Codex/OpenCode frontend, image uploads, diff editing, public accounts, a central relay, push notifications,
local GPU speech deployment, always-on microphone access, or multi-user collaboration.

## Success gate

This draft is useful for product iteration now. A live v1 is complete only after real Android → Tailscale →
native Windows observation, identity-safe input, ownership release, voice review and disconnect recovery
have passed. Mock tests are not a substitute for that gate.
