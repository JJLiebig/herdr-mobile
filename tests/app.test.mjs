import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as model from '../shared/model.mjs';
import {DraftStore} from '../public/drafts.mjs';
import {setupFocus} from '../public/focus.mjs';

// Exercise the real app event handlers with a minimal DOM; this is not browser evidence.
const source=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
class Element {
  value='';textContent='';dataset={};hidden=false;classList={toggle(){},add(){},remove(){}};listeners={};style={setProperty(){}};
  focus(){}blur(){}
  addEventListener(name,fn){this.listeners[name]=fn;}replaceChildren(){}append(){}setAttribute(){}
}
async function app(){
  const nodes=new Map(),handlers={},streams=[],memory=new Map();let failed=false,sendFails=false;
  const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const snapshot={schemaVersion:1,epoch:'epoch',host:{id:'host',label:'Host'},mode:'herdr-readonly',connected:true,observedAt:Date.now(),capabilities:{voice:false},panes:[{terminalId:'terminal',paneId:'pane',sessionId:'session',title:'Agent',space:'Space',tab:'Tab',agent:'codex',status:'idle'}]};
  const context=vm.createContext({...model,AbortSignal,URLSearchParams,crypto,setupFocus,
    DraftStore:class extends DraftStore{constructor(){super(storage);}},VoiceRecorder:class{},
    openTerminal:async(element,snapshot,pane)=>{const view={pane:{...pane},closed:false,ready:Promise.resolve(),close(){this.closed=true;}};streams.push(view);return view;},
    document:{hidden:false,body:new Element(),getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:()=>new Element(),createDocumentFragment:()=>new Element(),querySelectorAll:()=>[],addEventListener(name,fn){handlers[name]=fn;}},
    window:{innerHeight:800,scrollY:0,scrollTo(){},addEventListener(name,fn){handlers[name]=fn;}},history:{pushState(){},replaceState(){}},location:{pathname:'/'},setInterval(){},
    fetch:async(url,options)=>{if(failed)throw new Error('network lost');
      if(url==='/api/prompt'){if(sendFails)throw new Error('response lost');return{ok:true,json:async()=>({id:JSON.parse(options.body).id,status:'simulated',submittedToAgent:false,message:'Demo sent'})};}
      if(url.startsWith('/api/output'))return{ok:true,json:async()=>({text:'Demo output'})};
      return{ok:true,json:async()=>({...snapshot,observedAt:Date.now()})};}
  });
  vm.runInContext(source,context);await new Promise(setImmediate);
  const run=async code=>{await vm.runInContext(code,context);await new Promise(setImmediate);};
  await run('showPane(snapshot.panes[0])');
  return{run,streams,snapshot,nodes,handlers,context,fail(value){failed=value;},failSend(value){sendFails=value;}};
}
test('focused output reconnects after network and stream failures without moving or clearing the draft',async()=>{
  const a=await app();a.nodes.get('draft').value='Keep my instruction';a.nodes.get('draft').listeners.input();
  assert.equal(a.streams.length,1);a.fail(true);await a.run('refresh()');assert.equal(a.streams[0].closed,true);
  a.fail(false);await a.run('refresh()');assert.equal(a.streams.length,2);assert.equal(a.streams[1].pane.sessionId,'session');
  a.streams[1].close();await a.run('refresh()');assert.equal(a.streams.length,3);
  assert.equal(a.nodes.get('draft').value,'Keep my instruction');
  await a.run('refresh()');assert.equal(a.streams.length,3);
});
test('reconnect never follows a replaced session or opens output while backgrounded',async()=>{
  const a=await app();a.context.document.hidden=true;a.handlers.visibilitychange();assert.equal(a.streams[0].closed,true);
  await a.run('refresh()');assert.equal(a.streams.length,1);
  a.snapshot.panes[0]={...a.snapshot.panes[0],sessionId:'replacement'};a.context.document.hidden=false;
  await a.run('refresh()');assert.equal(a.streams.length,1);assert.match(a.nodes.get('message').textContent,/identity/);
});
test('composer closes only after acknowledged send and preserves an uncertain draft',async()=>{
  for(const fail of [false,true]){
    const a=await app();a.snapshot.mode='demo';await a.run('refresh()');
    a.nodes.get('input-text').listeners.click();
    const draft=a.nodes.get('draft');draft.value='Keep this if delivery fails';draft.listeners.input();
    a.failSend(fail);await a.nodes.get('composer').listeners.submit({preventDefault(){}});
    assert.equal(a.nodes.get('input-panel').hidden,!fail);
    assert.equal(draft.value,fail?'Keep this if delivery fails':'');
    if(fail){assert.equal(a.nodes.get('send').disabled,true);assert.match(a.nodes.get('message').textContent,/unknown/);}
  }
});
