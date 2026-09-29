# Thread view

## Historical design brief (superseded by the current input decision below)

User-approved interaction, 2026-09-28: existing terminal fills the phone; a persistent right-side input control opens text, voice, or terminal keys. Text opens a normal draft field and the phone keyboard, reducing the visible terminal area. A confirmed successful send closes both. Failure or unknown delivery keeps the draft. Closing the editor preserves its text.

Reference: [SSHHIP demo](https://x.com/kunchenguid/status/2080100310505410725), inspected by the reference scout. Its press-drag-release dial, green selection and voice state are inspiration. This app uses a small tap-accessible curved menu; it does not claim SSHHIP's complete gesture system. Voice remains reviewable before explicit Send. No automatic terminal approval.

## Direction contract

THESIS: Read one existing terminal with controls available on demand.

OWN-WORLD: Charcoal terminal and header, off-white text, muted context, restrained green input control; native system labels and monospace terminal output.

STORY: Open the agent, read, tap input, compose, explicitly send, return to reading.

FIRST VIEWPORT: A 48px back/name/context header, remaining height devoted to the terminal, and one 52px lower-right input button. The three choices expand above and left. An open composer consumes only its intrinsic height above the keyboard.

FORM: User-pinned fullscreen terminal with transient input, refined by the supplied SSHHIP screenshot and explicit text behavior. No alternate topology is required.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Current validation boundary

The owner approved standard Herdr attach/resume and shared PTY sizing. Opening an existing pane attaches a terminal controller without takeover. Its columns and rows follow the actual browser content box, including keyboard and rotation changes. Closing/backgrounding releases control. Herdr restores desktop sizing when an active desktop geometry owner exists; otherwise the last size can remain until the next desktop attach/resize. Standard attach may resume a saved dormant agent.

Direct terminal keys use the attached controller. Browser recording remains deferred and requires HTTPS and a configured transcription provider when restored.

Touch swipes and mouse wheels go to Herdr's attached terminal scrollback/application wheel handling.
The streamed renderer keeps no independent local history. The input button floats over the terminal;
only the compact connection-status strip and device safe area reserve space at the bottom.

## Current input decision

The owner removed the separate composer. The floating keyboard button now focuses xterm directly;
the phone keyboard types into the existing TUI input. Enter is a normal terminal key. Voice is deferred.
The terminal fills the visible viewport; no persistent live/phone-size footer or composer spacer remains.
