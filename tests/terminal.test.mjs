import test from 'node:test';
import assert from 'node:assert/strict';
import {openTerminal,bindTerminalScroll} from '../public/terminal.mjs';

test('swipes and wheel gestures scroll host history with normal touch direction and detach cleanly',()=>{
  const listeners=new Map(),moves=[];
  const element={clientHeight:400,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const unbind=bindTerminalScroll(element,lines=>moves.push(lines),()=>16);
  const touch=y=>({touches:[{clientY:y}],preventDefault(){},stopPropagation(){}});
  listeners.get('touchstart')(touch(200));listeners.get('touchmove')(touch(248));listeners.get('touchmove')(touch(216));
  assert.deepEqual(moves,[-3,2]);
  listeners.get('touchcancel')();listeners.get('touchmove')(touch(400));assert.equal(moves.length,2);
  listeners.get('wheel')({deltaY:3,deltaMode:1,preventDefault(){},stopPropagation(){}});assert.equal(moves.at(-1),3);
  unbind();assert.equal(listeners.size,0);
});

test('viewport streams fit the content box, resize the same lease, and reject a delta after reconnect',async t=>{
  const terminals=[],streams=[],requests=[],observers=[],listeners=new Map();
  let inputGate,delayFrame=false,finishFrame;
  const saved=Object.fromEntries(['Terminal','fetch','ResizeObserver','getComputedStyle'].map(k=>[k,globalThis[k]]));
  class Terminal {
    cols=80;rows=24;writes=[];options={};onData(callback){this.data=callback;return {dispose(){}};}focus(){}blur(){}parser={registerOscHandler:()=>({dispose(){}})};
    constructor(){this.textarea={listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},removeEventListener(name){this.listeners.delete(name);}};terminals.push(this);}open(){}reset(){this.resets=(this.resets||0)+1;}resize(c,r){this.cols=c;this.rows=r;}dispose(){this.disposed=true;}
    write(bytes,done){const text=Buffer.from(bytes).toString();this.writes.push(text);if(text==='frame'&&delayFrame)finishFrame=done;else done?.();}
  }
  globalThis.Terminal=Terminal;
  globalThis.getComputedStyle=()=>({paddingLeft:'8',paddingRight:'8',paddingTop:'8',paddingBottom:'8'});
  globalThis.ResizeObserver=class {constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.closed=true;}};
  globalThis.fetch=async(url,options)=>{
    requests.push({url,body:JSON.parse(options.body)});
    if(url==='/api/input')return inputGate?.promise||{ok:true};
    if(url==='/api/viewport'||url==='/api/scroll')return {ok:true};
    return {ok:true,body:new ReadableStream({start(controller){streams.push(controller);options.signal.addEventListener('abort',()=>controller.error(new Error('aborted')));}})};
  };
  t.after(()=>{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  const element={clientWidth:390,clientHeight:816,addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);},querySelector(){const terminal=terminals.at(-1);return{getBoundingClientRect:()=>({left:10,top:20,width:terminal.cols*8,height:terminal.rows*16})};}};
  const pane={terminalId:'t',paneId:'p',sessionId:'s'},snapshot={epoch:'e'};
  const emit=(index,event,data)=>streams[index].enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  const frame=(seq,full)=>({type:'terminal.frame',seq,full,width:45,height:50,bytes:Buffer.from('frame').toString('base64')});
  const tick=()=>new Promise(setImmediate);
  const first=await openTerminal(element,snapshot,pane,()=>{});await first.ready;
  assert.deepEqual(requests[0].body,{cols:45,rows:50});
  assert.equal(terminals[0].writes[0],'\x1b[?2004h','xterm must mark clipboard input as a single paste for Herdr');
  delayFrame=true;
  emit(0,'viewport',{id:'lease-one'});emit(0,'message',frame(10,true));await tick();
  assert.equal(first.viewportId,null,'input must wait until the first frame is rendered');
  terminals[0].data('early');await tick();assert.equal(requests.filter(r=>r.url==='/api/input').length,0);
  finishFrame();delayFrame=false;
  assert.equal(first.viewportId,'lease-one');
  assert.deepEqual(terminals[0].writes,['\x1b[?2004h','frame']);
  emit(0,'message',frame(11,true));await tick();
  assert.deepEqual(terminals[0].writes,['\x1b[?2004h','frame','frame']);
  assert.equal(terminals[0].resets||0,0,'a full repaint must not blank the active terminal');
  const touch=y=>({touches:[{clientX:82,clientY:y}],preventDefault(){},stopPropagation(){}});
  listeners.get('touchstart')(touch(244));listeners.get('touchmove')(touch(292));await tick();
  assert.deepEqual(requests.at(-1).body,{id:'lease-one',direction:'up',lines:3,column:9,row:14});
  element.clientHeight=416;observers[0].callback();await new Promise(r=>setTimeout(r,160));
  assert.deepEqual(requests.at(-1).body,{id:'lease-one',cols:45,rows:25});
  inputGate=Promise.withResolvers();
  terminals[0].data('Grüße 🦊');terminals[0].data('\r');await tick();
  assert.deepEqual(requests.filter(r=>r.url==='/api/input').map(r=>r.body),[{id:'lease-one',text:'Grüße 🦊'}]);
  inputGate.resolve({ok:true});await tick();
  assert.deepEqual(requests.filter(r=>r.url==='/api/input').map(r=>r.body.text),['Grüße 🦊','\r']);
  terminals[0].textarea.listeners.get('compositionstart')();
  assert.equal(first.key('\r'),false);
  assert.deepEqual(requests.filter(r=>r.url==='/api/input').map(r=>r.body.text),['Grüße 🦊','\r']);
  setTimeout(()=>terminals[0].data('composed'),0); // xterm forwards composition text after the compositionend event.
  terminals[0].textarea.listeners.get('compositionend')();
  await new Promise(resolve=>setTimeout(resolve,10));await tick();
  assert.deepEqual(requests.filter(r=>r.url==='/api/input').map(r=>r.body.text).slice(-1),['composed']);
  assert.equal(first.key('\r'),true);await tick();
  assert.deepEqual(requests.filter(r=>r.url==='/api/input').map(r=>r.body.text).slice(-2),['composed','\r']);
  inputGate=Promise.withResolvers();terminals[0].data('uncertain');terminals[0].data('queued');await tick();
  inputGate.reject(new Error('lost response'));await tick();
  assert.equal(first.inputFailed,true);assert.equal(first.closed,true);
  assert.deepEqual(requests.filter(r=>r.url==='/api/input').map(r=>r.body.text),['Grüße 🦊','\r','composed','\r','uncertain']);
  first.close();await tick();assert.equal(terminals[0].disposed,true);assert.equal(observers[0].closed,true);
  const second=await openTerminal(element,snapshot,pane,()=>{});await second.ready;
  emit(1,'message',frame(1,false));await tick();
  assert.equal(second.closed,true);assert.deepEqual(terminals[1].writes,['\x1b[?2004h']);
});
