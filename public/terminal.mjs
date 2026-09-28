let loading;
async function loadXterm(){
  if(globalThis.Terminal)return;
  if(!loading)loading=new Promise((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/xterm.css';document.head.append(css);
    const script=document.createElement('script');script.src='/vendor/xterm.js';script.onload=resolve;script.onerror=()=>{loading=null;reject(new Error('Live rendering requires the optional xterm dependency. Run: npm install --no-save --ignore-scripts @xterm/xterm@5.5.0'));};document.head.append(script);
  });
  await loading;
}
/** Read-only. No terminal keystrokes or resize commands ever leave this renderer. */
export async function openTerminal(element,snapshot,pane,onStatus){
  let terminal;let source;let cancelled=false;let sequence=-1;let pending=0;const disposables=[];
  const close=()=>{cancelled=true;source?.close();for(const d of disposables)d.dispose();terminal?.dispose();};
  const ready=(async()=>{
    await loadXterm();if(cancelled)return;
    terminal=new globalThis.Terminal({disableStdin:true,cursorBlink:false,fontSize:14,fontFamily:'ui-monospace, Consolas, monospace',scrollback:1500,allowProposedApi:false,convertEol:false,theme:{background:'#11191f',foreground:'#e9eef0'}});
    terminal.open(element);
    // No OSC clipboard access, URLs, title changes, or terminal-driven browser actions.
    for(const code of [0,1,2,7,8,9,52,1337])disposables.push(terminal.parser.registerOscHandler(code,()=>true));
    const query=new URLSearchParams({terminal:pane.terminalId,pane:pane.paneId,session:pane.sessionId||'',epoch:snapshot.epoch});
    source=new EventSource('/api/terminal?'+query);
    source.onmessage=event=>{
      if(cancelled)return;
      try{
        const f=JSON.parse(event.data);
        if(f.type!=='terminal.frame' || !Number.isSafeInteger(f.seq) || f.seq<=sequence || typeof f.bytes!=='string' || f.bytes.length>1400000 || !Number.isInteger(f.width) || f.width<1 || f.width>1000 || !Number.isInteger(f.height) || f.height<1 || f.height>500 || (sequence===-1 && !f.full))throw new Error('Terminal frame cannot be applied. Reconnect for a fresh view.');
        sequence=f.seq;
        const bytes=Uint8Array.from(atob(f.bytes),c=>c.charCodeAt(0));pending+=bytes.length;
        if(pending>2*1024*1024)throw new Error('Output exceeded the mobile render buffer. Reconnect for a fresh view.');
        if(f.full)terminal.reset();if(terminal.cols!==f.width || terminal.rows!==f.height)terminal.resize(f.width,f.height);
        terminal.write(bytes,()=>{pending-=bytes.length;});onStatus('Read-only observer · desktop dimensions');
      }catch(error){onStatus(error.message);close();}
    };
    source.addEventListener('closed',()=>{onStatus('Observer ended. Reopen the pane to reconnect.');close();});
    source.onerror=()=>{onStatus('Connection lost. Reopen the pane for a fresh full frame.');close();};
  })();
  return {ready,close,latest:()=>terminal?.scrollToBottom()};
}
