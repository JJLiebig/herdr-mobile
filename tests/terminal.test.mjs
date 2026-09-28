import test from 'node:test';
import assert from 'node:assert/strict';
import {openTerminal} from '../public/terminal.mjs';

test('viewport streams fit the content box, resize the same lease, and reject a delta after reconnect',async t=>{
  const terminals=[],streams=[],requests=[],observers=[];
  const saved=Object.fromEntries(['Terminal','fetch','ResizeObserver','getComputedStyle'].map(k=>[k,globalThis[k]]));
  class Terminal {
    cols=80;rows=24;writes=[];parser={registerOscHandler:()=>({dispose(){}})};
    constructor(){terminals.push(this);}open(){}reset(){}resize(c,r){this.cols=c;this.rows=r;}dispose(){this.disposed=true;}
    write(bytes,done){this.writes.push(Buffer.from(bytes).toString());done();}
  }
  globalThis.Terminal=Terminal;
  globalThis.getComputedStyle=()=>({paddingLeft:'8',paddingRight:'8',paddingTop:'8',paddingBottom:'8'});
  globalThis.ResizeObserver=class {constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.closed=true;}};
  globalThis.fetch=async(url,options)=>{
    requests.push({url,body:JSON.parse(options.body)});
    if(url==='/api/viewport')return {ok:true};
    return {ok:true,body:new ReadableStream({start(controller){streams.push(controller);options.signal.addEventListener('abort',()=>controller.error(new Error('aborted')));}})};
  };
  t.after(()=>{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  const element={clientWidth:390,clientHeight:816,querySelector(){const terminal=terminals.at(-1);return{getBoundingClientRect:()=>({width:terminal.cols*8,height:terminal.rows*16})};}};
  const pane={terminalId:'t',paneId:'p',sessionId:'s'},snapshot={epoch:'e'};
  const emit=(index,event,data)=>streams[index].enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  const frame=(seq,full)=>({type:'terminal.frame',seq,full,width:45,height:50,bytes:Buffer.from('frame').toString('base64')});
  const tick=()=>new Promise(setImmediate);
  const first=await openTerminal(element,snapshot,pane,()=>{});await first.ready;
  assert.deepEqual(requests[0].body,{cols:45,rows:50});
  emit(0,'viewport',{id:'lease-one'});emit(0,'message',frame(10,true));await tick();
  assert.deepEqual(terminals[0].writes,['frame']);
  element.clientHeight=416;observers[0].callback();await new Promise(r=>setTimeout(r,160));
  assert.deepEqual(requests.at(-1).body,{id:'lease-one',cols:45,rows:25});
  first.close();await tick();assert.equal(terminals[0].disposed,true);assert.equal(observers[0].closed,true);
  const second=await openTerminal(element,snapshot,pane,()=>{});await second.ready;
  emit(1,'message',frame(1,false));await tick();
  assert.equal(second.closed,true);assert.deepEqual(terminals[1].writes,[]);
});
