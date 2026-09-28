---
name: Herdr Mobile
description: A quiet phone view of existing Herdr sessions.
colors:
  surface: "#1b2024"
  surface-raised: "#252c30"
  ink: "#f1f3f2"
  muted: "#aeb8bd"
  line: "#3b4449"
  blocked: "#ed7978"
  working: "#f2c85e"
  done: "#69cbb5"
typography:
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    lineHeight: 1.45
  thread:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 520
    lineHeight: 1.35
---

## Overview

**Creative North Star: “The session list.”** Herdr Mobile shows the smallest useful route into an existing pane. The phone opens on Priority, with Spaces one tap away. The focused pane owns the screen after selection.

## Colors

Use charcoal surfaces and off-white text. Reserve color for agent state and deliberate action. Status dots are red for blocked, yellow for working, teal for new completion, and outlined teal for idle. Labels accompany color where the status matters.

## Typography

Use the system sans for controls and session names. Names lead; the space name, or the repository name when no space name exists, sits one line below in muted text. Terminal content alone uses monospace.

## Layout

On a phone, keep a small herdr/machine header, a top Priority/Spaces switch, then the list. Priority groups existing agents by state; Spaces expands through space, tab, and pane. Use native disclosure elements and full-width touch rows. On wider screens, cap the landing column at 760px.

## Elevation & Depth

The landing is flat. Hairline borders and one raised hover surface mark interaction; no cards or shadows.

## Shapes

Landing rows and navigation have square edges. Status dots are the only round motif.

## Components

Priority rows contain a state dot, pane name, muted space or repo subtitle, and a trailing direction cue. When names and spaces repeat, add tab context and a pane ordinal if needed. The Spaces tree uses a muted status subtitle under native disclosures. Selecting a row opens only that existing pane.

## Do's and Don'ts

Do keep metadata and navigation sparse. Do preserve stable workspace and tab identity when labels repeat. Do not add a hero, dashboard cards, terminal preview, generated summary, or agent-launch action to the landing.
