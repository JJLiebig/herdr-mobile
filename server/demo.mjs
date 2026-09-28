export function demoSnapshot(cfg,epoch) {
  const now=Date.now();
  return {schemaVersion:1,epoch,host:{id:cfg.hostId,label:cfg.hostLabel},mode:'demo',connected:true,observedAt:now,capabilities:{liveWrites:false,terminalObserve:false,voice:!!cfg.apiKey},panes:[
    {terminalId:'demo-scheduler',paneId:'w1:p1',sessionId:'demo-thread-scheduler',agent:'Codex',title:'Fix scheduler pacing',space:'Nextide',tab:'Daedalus · implementation',status:'blocked',summary:'Ready to run the wider integration tests.',summarySource:'Illustrative fixture',observedAt:now},
    {terminalId:'demo-ingestion',paneId:'w1:p2',sessionId:'demo-thread-ingestion',agent:'OpenCode',title:'Make ingestion resilient',space:'Nextide',tab:'Kraken · ingestion',status:'working',summary:'Adding bounded retries and cancellation coverage.',summarySource:'Illustrative fixture',observedAt:now},
    {terminalId:'demo-review',paneId:'w1:p3',sessionId:'demo-thread-review',agent:'Codex',title:'Review campaign readiness',space:'Nextide',tab:'Daedalus · review',status:'done',summary:'Review notes are ready for you.',summarySource:'Illustrative fixture',observedAt:now},
    {terminalId:'demo-mobile',paneId:'w2:p1',sessionId:'demo-thread-mobile',agent:'Codex',title:'Improve mobile input',space:'Tools',tab:'Herdr · main',status:'idle',summary:'Testing multiline prompts and keyboard resizing.',summarySource:'Illustrative fixture',observedAt:now},
    {terminalId:'demo-shell',paneId:'w2:p2',sessionId:'',agent:'',title:'Development server',space:'Tools',tab:'Herdr · logs',status:'unknown',summary:'Shell pane; no agent lifecycle metadata.',summarySource:'Illustrative fixture',observedAt:now}
  ]};
}
export function demoOutput(pane) {
 return `DEMO OUTPUT — not a real agent session\n\n${pane.title}\n${'─'.repeat(32)}\n\nThe focused view shows one agent, not a miniature desktop.\n\nThe normal text box below is where you type, paste or dictate a complete instruction. Enter adds a new line. Send is always explicit.\n\nTry switching to another card and back. Your draft stays with its original agent.\n\n${pane.summary}\n\nNo commands are executed in demo mode.`;
}
