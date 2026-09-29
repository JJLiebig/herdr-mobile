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
  children=[];
  addEventListener(name,fn){this.listeners[name]=fn;}replaceChildren(...nodes){this.children=nodes;}append(...nodes){this.children.push(...nodes);}setAttribute(){}
}
async function app(saved=[]){
  const nodes=new Map(),handlers={},streams=[],memory=new Map(saved);let failed=false;
  const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const snapshot={schemaVersion:1,epoch:'epoch',host:{id:'host',label:'Host'},mode:'herdr-readonly',connected:true,observedAt:Date.now(),capabilities:{voice:false},panes:[{terminalId:'terminal',paneId:'pane',sessionId:'session',title:'Agent',space:'Space',tab:'Tab',agent:'codex',status:'idle'}]};
  const context=vm.createContext({...model,AbortSignal,URLSearchParams,crypto,setupFocus,
    DraftStore:class extends DraftStore{constructor(){super(storage);}},
    openTerminal:async(element,snapshot,pane,onStatus)=>{const view={pane:{...pane},viewportId:'attached-lease',closed:false,ready:Promise.resolve(),status:onStatus,focus(){this.focused=true;},blur(){this.focused=false;},input(text){this.lastInput=text;},close(){this.closed=true;this.viewportId=null;}};streams.push(view);return view;},
    document:{hidden:false,body:new Element(),getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:()=>new Element(),createDocumentFragment:()=>new Element(),querySelectorAll:()=>[],addEventListener(name,fn){handlers[name]=fn;}},
    window:{innerHeight:800,scrollY:0,scrollTo(){},addEventListener(name,fn){handlers[name]=fn;}},history:{pushState(){},replaceState(){}},location:{pathname:'/'},setInterval(){},
    fetch:async(url,options)=>{if(failed)throw new Error('network lost');
      if(url.startsWith('/api/output'))return{ok:true,json:async()=>({text:'Demo output'})};
      return{ok:true,json:async()=>({...snapshot,observedAt:Date.now()})};}
  });
  vm.runInContext(source,context);await new Promise(setImmediate);
  const run=async code=>{await vm.runInContext(code,context);await new Promise(setImmediate);};
  await run('showPane(snapshot.panes[0])');
  return{run,streams,snapshot,nodes,handlers,context,memory,fail(value){failed=value;}};
}
test('a closed controller stays closed until the user explicitly reopens the pane',async()=>{
  const a=await app();
  assert.equal(a.streams.length,1);a.fail(true);await a.run('refresh()');assert.equal(a.streams[0].closed,true);
  a.fail(false);await a.run('refresh()');assert.equal(a.streams.length,1);
  await a.run('back(); showPane(snapshot.panes[0])');assert.equal(a.streams.length,2);
  a.streams[1].close();a.streams[1].status('Input interrupted. Check what arrived.');
  await a.run('refresh()');assert.equal(a.streams.length,2);
  assert.equal(a.streams[1].pane.sessionId,'session');
});
test('reconnect never follows a replaced session or opens output while backgrounded',async()=>{
  const a=await app();a.context.document.hidden=true;a.handlers.visibilitychange();assert.equal(a.streams[0].closed,true);
  await a.run('refresh()');assert.equal(a.streams.length,1);
  a.snapshot.panes[0]={...a.snapshot.panes[0],sessionId:'replacement'};a.context.document.hidden=false;
  await a.run('refresh()');assert.equal(a.streams.length,1);assert.match(a.nodes.get('message').textContent,/identity/);
  a.snapshot.panes[0]={...a.snapshot.panes[0],sessionId:'session'};
  await a.run('refresh()');assert.equal(a.streams.length,1);
});
test('non-working groups put newest completions first, using state changes when completion is missing',async()=>{
  const a=await app(),base=a.snapshot.panes[0];
  a.snapshot.panes=[
    {...base,title:'Older finish',status:'idle',completionSeq:10,stateChangeSeq:90},
    {...base,title:'Missing history',status:'idle'},
    {...base,title:'Newest finish',status:'idle',completionSeq:30,stateChangeSeq:30},
    {...base,title:'State fallback',status:'idle',stateChangeSeq:20},
    {...base,title:'Working first',status:'working',stateChangeSeq:1},
    {...base,title:'Working second',status:'working',stateChangeSeq:99}
  ];
  await a.run('back(); refresh(); renderLanding(true)');
  const sections=a.nodes.get('priority-list').children[0].children;
  const titles=section=>section.children.slice(1).map(row=>row.children[1].children[0].textContent);
  assert.deepEqual(titles(sections.find(section=>section.children[0].textContent==='Idle')),['Newest finish','State fallback','Older finish','Missing history']);
  assert.deepEqual(titles(sections.find(section=>section.children[0].textContent==='Working')),['Working first','Working second']);
});

test('keyboard button focuses the TUI directly and keys use that same connection',async()=>{
  const a=await app();await a.run('refresh()');
  assert.equal(a.nodes.get('input-toggle').disabled,false);
  a.nodes.get('input-toggle').listeners.click();assert.equal(a.streams[0].focused,true);
  assert.equal(a.nodes.get('terminal-keys').hidden,false);
  a.nodes.get('input-toggle').listeners.click();assert.equal(a.streams[0].focused,false);
  assert.equal(a.nodes.get('terminal-keys').hidden,true);
  a.nodes.get('input-toggle').listeners.click();
  a.nodes.get('key-Tab').listeners.click();assert.equal(a.streams[0].lastInput,'\t');
  a.nodes.get('key-Shift').listeners.click();a.nodes.get('key-Tab').listeners.click();assert.equal(a.streams[0].lastInput,'\x1b[Z');
  a.nodes.get('key-Tab').listeners.click();assert.equal(a.streams[0].lastInput,'\t');
  a.nodes.get('key-Shift').listeners.click();a.nodes.get('key-Enter').listeners.click();assert.equal(a.streams[0].lastInput,'\x1b[13;2u');
  a.nodes.get('key-Enter').listeners.click();assert.equal(a.streams[0].lastInput,'\r');
  a.nodes.get('keys-close').listeners.click();assert.equal(a.streams[0].focused,false);
  a.streams[0].inputFailed=true;a.streams[0].close();await a.run('refresh()');
  assert.equal(a.streams.length,1);assert.equal(a.nodes.get('input-toggle').disabled,true);
});
test('overview retains available agent metadata and marks disconnected snapshots stale',async()=>{
  const a=await app();a.snapshot.panes[0].summary='Existing summary';a.snapshot.panes[0].summarySource='Herdr display metadata';
  await a.run('back(); refresh(); renderLanding(true)');
  const row=()=>a.nodes.get('priority-list').children[0].children[0].children[1];
  assert.match(row().children[1].children[1].textContent,/codex · Idle · Current/);
  assert.equal(row().children[1].children[2].textContent,'Existing summary');
  a.fail(true);await a.run('refresh()');
  assert.match(row().children[1].children[1].textContent,/Stale/);
});

test('focused status follows completion, new work, and disconnection',async()=>{
  const a=await app();
  for(const [status,label] of [['working','Working'],['done','Finished'],['blocked','Needs input']]){
    a.snapshot.panes[0].status=status;await a.run('refresh()');
    assert.equal(a.nodes.get('focus-status').textContent,label);
    assert.equal(a.nodes.get('focus-dot').className,`status-dot ${status}`);
  }
  a.fail(true);await a.run('refresh()');
  assert.equal(a.nodes.get('focus-status').textContent,'Disconnected');
  assert.equal(a.nodes.get('focus-dot').className,'status-dot unknown');
});
test('loading the app prunes expired drafts from the removed composer',async()=>{
  const old='herdr-mobile:draft:old',recent='herdr-mobile:draft:recent';
  const a=await app([[old,JSON.stringify({savedAt:Date.now()-8*86400000})],[recent,JSON.stringify({savedAt:Date.now()})]]);
  assert.equal(a.memory.has(old),false);assert.equal(a.memory.has(recent),true);
});
