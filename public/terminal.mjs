let loading;
async function loadXterm(){
  if(globalThis.Terminal)return;
  if(!loading)loading=new Promise((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/xterm.css';document.head.append(css);
    const script=document.createElement('script');script.src='/vendor/xterm.js';script.onload=resolve;script.onerror=()=>{loading=null;reject(new Error('Terminal could not load. Check the connection and reopen the pane.'));};document.head.append(script);
  });
  await loading;
}
/** Match the actual content box, keeping terminal cell size readable. */
export function terminalSize(element, terminal){
  const screen=element.querySelector('.xterm-screen');
  const rect=screen?.getBoundingClientRect();
  const style=getComputedStyle(element);
  const cellWidth=rect?.width/terminal.cols,cellHeight=rect?.height/terminal.rows;
  if(!(cellWidth>0&&cellHeight>0))throw new Error('Terminal dimensions are not ready. Reopen the pane.');
  const width=element.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0)-14;
  const height=element.clientHeight-parseFloat(style.paddingTop||0)-parseFloat(style.paddingBottom||0);
  return {cols:Math.max(1,Math.min(1000,Math.floor(width/cellWidth))),rows:Math.max(1,Math.min(500,Math.floor(height/cellHeight)))};
}
/** Standard Herdr control owns sizing only. No keystrokes are sent. */
export async function openTerminal(element,snapshot,pane,onStatus){
  let terminal,observer,resizeTimer,viewportId,lastSize;
  let cancelled=false,sequence=-1,pending=0,resizing=false;
  const abort=new AbortController(),disposables=[];
  const close=()=>{if(cancelled)return;cancelled=true;abort.abort();clearTimeout(resizeTimer);observer?.disconnect();for(const d of disposables)d.dispose();terminal?.dispose();};
  const fail=error=>{if(cancelled)return;onStatus(error.message||'Disconnected. Reopen the pane.');close();};
  const headers={'Content-Type':'application/json','X-Herdr-Mobile':'1'};
  async function resize(){
    if(cancelled||!viewportId||resizing)return;
    const size=terminalSize(element,terminal);
    if(size.cols===lastSize.cols&&size.rows===lastSize.rows)return;
    resizing=true;
    try{
      const response=await fetch('/api/viewport',{method:'POST',headers,body:JSON.stringify({id:viewportId,...size}),signal:abort.signal});
      if(!response.ok)throw new Error('Terminal resize failed. Reopen the pane.');
      lastSize=size;
    }catch(error){fail(error);}
    finally{resizing=false;if(!cancelled)queueResize();}
  }
  function queueResize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>resize().catch(fail),120);}
  function receive(event,data){
    if(event==='viewport'){viewportId=JSON.parse(data).id;queueResize();return;}
    if(event==='closed')throw new Error(JSON.parse(data).reason||'Terminal disconnected.');
    const f=JSON.parse(data);
    if(f.type!=='terminal.frame'||!Number.isSafeInteger(f.seq)||f.seq<=sequence||typeof f.bytes!=='string'||f.bytes.length>1400000||!Number.isInteger(f.width)||f.width<1||f.width>1000||!Number.isInteger(f.height)||f.height<1||f.height>500||(sequence===-1&&!f.full))throw new Error('Terminal frame cannot be applied. Reopen for a fresh view.');
    sequence=f.seq;
    const bytes=Uint8Array.from(atob(f.bytes),c=>c.charCodeAt(0));pending+=bytes.length;
    if(pending>2*1024*1024)throw new Error('Output exceeded the mobile render buffer. Reopen the pane.');
    if(f.full)terminal.reset();
    if(terminal.cols!==f.width||terminal.rows!==f.height)terminal.resize(f.width,f.height);
    terminal.write(bytes,()=>{pending-=bytes.length;});onStatus('Live · phone size');
  }
  async function readFrames(body){
    const reader=body.getReader(),decoder=new TextDecoder();let buffer='';
    try{
      while(!cancelled){
        const {value,done}=await reader.read();if(done)throw new Error('Terminal disconnected. Reopen the pane.');
        buffer+=decoder.decode(value,{stream:true});
        let end;
        while((end=buffer.indexOf('\n\n'))>=0){
          const block=buffer.slice(0,end);buffer=buffer.slice(end+2);
          const lines=block.split('\n');const data=lines.filter(line=>line.startsWith('data: ')).map(line=>line.slice(6)).join('\n');
          if(data)receive(lines.find(line=>line.startsWith('event: '))?.slice(7)||'message',data);
        }
        if(buffer.length>2*1024*1024)throw new Error('Terminal frame exceeded the render buffer.');
      }
    }finally{reader.releaseLock();}
  }
  const ready=(async()=>{
    await loadXterm();if(cancelled)return;
    terminal=new globalThis.Terminal({disableStdin:true,cursorBlink:false,fontSize:14,fontFamily:'ui-monospace, Consolas, monospace',scrollback:1500,allowProposedApi:false,convertEol:false,theme:{background:'#11191f',foreground:'#e9eef0'}});
    terminal.open(element);
    for(const code of [0,1,2,7,8,9,52,1337])disposables.push(terminal.parser.registerOscHandler(code,()=>true));
    lastSize=terminalSize(element,terminal);terminal.resize(lastSize.cols,lastSize.rows);
    const query=new URLSearchParams({terminal:pane.terminalId,pane:pane.paneId,session:pane.sessionId||'',epoch:snapshot.epoch});
    const response=await fetch('/api/terminal?'+query,{method:'POST',headers,body:JSON.stringify(lastSize),signal:abort.signal});
    if(!response.ok){const data=await response.json();throw new Error(data.message||'Terminal unavailable.');}
    if(cancelled)return;
    observer=new ResizeObserver(queueResize);observer.observe(element);
    readFrames(response.body).catch(fail);
  })();
  return {ready,close,get closed(){return cancelled;},latest:()=>terminal?.scrollToBottom()};
}
