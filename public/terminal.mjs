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
/** Forward scrolling to the host, since streamed frames contain no local history. */
export function bindTerminalScroll(element,scroll,lineHeight){
  let touchY=null,touchPoint=null,remainder=0;
  const start=event=>{touchPoint=event.touches.length===1?event.touches[0]:null;touchY=touchPoint?.clientY??null;remainder=0;};
  const move=event=>{
    if(touchY===null||event.touches.length!==1)return;
    event.preventDefault();event.stopPropagation();
    const y=event.touches[0].clientY;remainder+=touchY-y;touchY=y;
    const lines=Math.trunc(remainder/lineHeight());
    if(lines){remainder-=lines*lineHeight();scroll(lines,touchPoint);}
  };
  const end=()=>{touchY=null;touchPoint=null;remainder=0;};
  const wheel=event=>{
    if(event.ctrlKey||!event.deltaY)return;
    event.preventDefault();event.stopPropagation();
    const pixels=event.deltaY*(event.deltaMode===1?lineHeight():event.deltaMode===2?element.clientHeight:1);
    scroll(Math.sign(pixels)*Math.max(1,Math.round(Math.abs(pixels)/lineHeight())),event);
  };
  const events=[['touchstart',start],['touchmove',move],['touchend',end],['touchcancel',end],['wheel',wheel]];
  for(const [name,handler]of events)element.addEventListener(name,handler,{capture:true,passive:false});
  return ()=>{for(const [name,handler]of events)element.removeEventListener(name,handler,true);};
}
/** One native controller owns this view's dimensions, scrolling, and keyboard input. */
export async function openTerminal(element,snapshot,pane,onStatus){
  let terminal,observer,resizeTimer,viewportId,lastSize,unbindScroll;
  let pendingScroll=0,pendingPosition=null,scrolling=false;
  let cancelled=false,sequence=-1,firstFrameReady=false,pending=0,resizing=false;
  let composing=false,compositionEpoch=0;
  const abort=new AbortController(),disposables=[];
  const close=()=>{if(cancelled)return;cancelled=true;abort.abort();clearTimeout(resizeTimer);unbindScroll?.();observer?.disconnect();for(const d of disposables)d.dispose();terminal?.dispose();};
  const fail=error=>{if(cancelled)return;close();onStatus(error.message||'Disconnected. Reopen the pane.');};
  const headers={'Content-Type':'application/json','X-Herdr-Mobile':'1'};
  let inputQueue=Promise.resolve(),queuedInput=0,inputFailed=false;
  function input(text){
    if(cancelled||!viewportId||!firstFrameReady||!text)return;
    if(queuedInput+text.length>16000){inputFailed=true;fail(new Error('Too much pending input. Reopen the thread and check the terminal.'));return;}
    const id=viewportId;queuedInput+=text.length;
    inputQueue=inputQueue.then(async()=>{
      if(cancelled)return;
      const response=await fetch('/api/input',{method:'POST',headers,body:JSON.stringify({id,text}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(10000)])});
      if(!response.ok)throw new Error('Input failed. Check the terminal before continuing.');
    }).catch(()=>{inputFailed=true;fail(new Error('Input interrupted. Reopen the thread and check what arrived. Nothing was retried.'));}).finally(()=>{queuedInput-=text.length;});
  }
  function key(text){if(composing)return false;input(text);return true;}
  async function scroll(lines,point){
    if(cancelled||!viewportId)return;
    const rect=element.querySelector('.xterm-screen').getBoundingClientRect();
    const column=Math.max(0,Math.min(terminal.cols-1,Math.floor(((point?.clientX??rect.left+rect.width/2)-rect.left)*terminal.cols/rect.width)));
    const row=Math.max(0,Math.min(terminal.rows-1,Math.floor(((point?.clientY??rect.top+rect.height/3)-rect.top)*terminal.rows/rect.height)));
    pendingPosition={column,row};
    pendingScroll=Math.max(-65535,Math.min(65535,pendingScroll+lines));
    if(scrolling)return;scrolling=true;
    try{
      while(pendingScroll&&!cancelled){
        const amount=pendingScroll,position=pendingPosition;pendingScroll=0;
        const response=await fetch('/api/scroll',{method:'POST',headers,body:JSON.stringify({id:viewportId,direction:amount<0?'up':'down',lines:Math.abs(amount),...position}),signal:abort.signal});
        if(!response.ok)throw new Error('Scroll failed. Reopen the pane.');
      }
    }catch(error){pendingScroll=0;fail(error);}
    finally{scrolling=false;}
  }
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
    if(terminal.cols!==f.width||terminal.rows!==f.height)terminal.resize(f.width,f.height);
    terminal.write(bytes,()=>{pending-=bytes.length;if(!cancelled){firstFrameReady=true;terminal.options.disableStdin=false;onStatus('');}});
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
    terminal=new globalThis.Terminal({disableStdin:true,cursorBlink:false,fontSize:12,fontFamily:'ui-monospace, Consolas, monospace',scrollback:0,allowProposedApi:false,convertEol:false,theme:{background:'#11191f',foreground:'#e9eef0'}});
    terminal.open(element);
    // Herdr paints frames without forwarding the PTY's paste mode; xterm must bracket clipboard paste for Herdr to deliver it as one paste.
    terminal.write('\x1b[?2004h');
    const textarea=terminal.textarea;
    if(!textarea)throw new Error('Terminal input is unavailable. Reopen the pane.');
    const compositionStart=()=>{compositionEpoch++;composing=true;};
    const compositionEnd=()=>{const epoch=compositionEpoch;setTimeout(()=>{if(!cancelled&&epoch===compositionEpoch)composing=false;},0);};
    textarea.addEventListener('compositionstart',compositionStart);
    textarea.addEventListener('compositionend',compositionEnd);
    disposables.push({dispose(){textarea.removeEventListener('compositionstart',compositionStart);textarea.removeEventListener('compositionend',compositionEnd);}});
    disposables.push(terminal.onData(input));
    for(const code of [0,1,2,7,8,9,52,1337])disposables.push(terminal.parser.registerOscHandler(code,()=>true));
    lastSize=terminalSize(element,terminal);terminal.resize(lastSize.cols,lastSize.rows);
    const query=new URLSearchParams({terminal:pane.terminalId,pane:pane.paneId,session:pane.sessionId||'',epoch:snapshot.epoch});
    const response=await fetch('/api/terminal?'+query,{method:'POST',headers,body:JSON.stringify(lastSize),signal:abort.signal});
    if(!response.ok){const data=await response.json();throw new Error(data.message||'Terminal unavailable.');}
    if(cancelled)return;
    unbindScroll=bindTerminalScroll(element,scroll,()=>element.querySelector('.xterm-screen').getBoundingClientRect().height/terminal.rows);
    observer=new ResizeObserver(queueResize);observer.observe(element);
    readFrames(response.body).catch(fail);
  })();
  return {ready,close,input,key,focus:()=>{if(!cancelled&&firstFrameReady)terminal.focus();},blur:()=>terminal?.blur(),get inputFailed(){return inputFailed;},get closed(){return cancelled;},get viewportId(){return !cancelled&&firstFrameReady?viewportId:null;},latest:()=>scroll(65535)};
}
