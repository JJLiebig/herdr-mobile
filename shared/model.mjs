/** Shared pure functions. No DOM, network, or process dependencies. */
export const MAX_DRAFT = 16000;
export const MAX_AUDIO = 8 * 1024 * 1024;
export const MAX_RECORDING_MS = 180000;
export const STALE_AFTER_MS = 15000;
export const STATUS_LABELS = Object.freeze({ working: 'Working', blocked: 'Needs input', idle: 'Idle', done: 'Finished', unknown: 'Unknown' });
export function cleanText(value, limit = 160) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}
export function titleFor(pane) {
  return cleanText(pane.name) || cleanText(pane.label) || cleanText(pane.nativeTitle) || cleanText(pane.title) || cleanText(pane.terminal_title_stripped) || cleanText(pane.terminal_title) || `${cleanText(pane.agent) || 'Shell'} · ${cleanText(pane.cwd?.split(/[\\/]/).filter(Boolean).at(-1)) || 'session'}`;
}
export function draftKey(hostId, epoch, pane) {
  // A native session can survive companion restart. Without one, isolate epochs.
  return JSON.stringify([hostId, pane.terminalId, pane.sessionId || `epoch:${epoch}`]);
}
export function appendTranscript(draft, expectedRevision, text) {
  const transcript = typeof text === 'string' ? text.trim() : '';
  if (!transcript) return { kind: 'empty', draft };
  if (draft.revision !== expectedRevision) return { kind: 'conflict', draft, transcript };
  const joined = [draft.text.trimEnd(), transcript].filter(Boolean).join('\n');
  if (joined.length > MAX_DRAFT) return { kind: 'too-long', draft, transcript };
  return { kind: 'applied', draft: { text: joined, revision: draft.revision + 1 } };
}
export function guardTarget(snapshot, target) {
  if (!target || target.epoch !== snapshot.epoch || target.hostId !== snapshot.host.id) throw new Error('stale_target');
  const pane = snapshot.panes.find(p => p.terminalId === target.terminalId && p.paneId === target.paneId);
  if (!pane || (pane.sessionId || '') !== (target.sessionId || '') || !pane.agent) throw new Error('stale_target');
  return pane;
}
export function validOperation(value) {
  return value && typeof value.id === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value.id) && typeof value.text === 'string' && value.text.trim().length > 0 && value.text.length <= MAX_DRAFT && value.target && typeof value.target === 'object';
}
export function isFresh(snapshot, now = Date.now()) {
  return !!snapshot && snapshot.connected === true && Number.isFinite(snapshot.observedAt) && now >= snapshot.observedAt - 60000 && now - snapshot.observedAt < STALE_AFTER_MS;
}
/** Validate normalized data before browser rendering; external metadata is not HTML. */
export function isSnapshot(s) {
  return !!s && s.schemaVersion === 1 && typeof s.epoch === 'string' && typeof s.host?.id === 'string' && typeof s.host?.label === 'string' && Number.isFinite(s.observedAt) && Array.isArray(s.panes) && s.panes.length <= 1000 && s.panes.every(p => typeof p.terminalId === 'string' && typeof p.paneId === 'string' && typeof p.title === 'string' && typeof p.space === 'string' && typeof p.tab === 'string' && Object.hasOwn(STATUS_LABELS, p.status));
}
