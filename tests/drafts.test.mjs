import test from'node:test';import assert from'node:assert/strict';import{DraftStore}from'../public/drafts.mjs';
class MemoryStorage{map=new Map();get length(){return this.map.size;}key(i){return[...this.map.keys()][i]??null;}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
test('draft changes never overwrite another agent',()=>{const d=new DraftStore(new MemoryStorage());d.set('one',{text:'One',revision:1});d.set('two',{text:'Two',revision:1});assert.equal(d.get('one').text,'One');assert.equal(d.get('two').text,'Two');});
test('drafts survive reload, including pending transcript and unknown delivery',()=>{const storage=new MemoryStorage();const d=new DraftStore(storage);d.set('one',{text:'Keep',revision:4,pending:'Voice',delivery:{status:'outcome_unknown'}});const restored=new DraftStore(storage).get('one');assert.equal(restored.text,'Keep');assert.equal(restored.pending,'Voice');assert.equal(restored.delivery.status,'outcome_unknown');});
test('unavailable browser storage retains in-memory editing even when its getter throws',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('SecurityError');}});
  try{for(const d of [new DraftStore(),new DraftStore({getItem(){throw new Error();},setItem(){throw new Error();}})]){d.set('one',{text:'Safe in memory'});assert.equal(d.get('one').text,'Safe in memory');assert.equal(d.available,false);}}
  finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
test('clear drafts does not erase unrelated browser storage',()=>{const s=new MemoryStorage();s.setItem('unrelated','keep');const d=new DraftStore(s);d.set('one',{text:'Secret'});d.clear();assert.equal(s.getItem('unrelated'),'keep');assert.equal(d.get('one').text,'');});
test('browser storage retains at most 50 drafts including the newest',()=>{const s=new MemoryStorage();const d=new DraftStore(s);for(let i=0;i<60;i++)d.set(String(i),{text:String(i)});assert.equal(s.length,50);assert.equal(new DraftStore(s).get('59').text,'59');});
test('expired drafts are deleted on startup and expire from an open tab',t=>{
  const s=new MemoryStorage();s.setItem('unrelated','keep');
  s.setItem('herdr-mobile:draft:old',JSON.stringify({text:'Expired',revision:1,savedAt:Date.now()-8*86400000}));
  const d=new DraftStore(s);assert.equal(s.getItem('herdr-mobile:draft:old'),null);assert.equal(s.getItem('unrelated'),'keep');
  d.set('current',{text:'Keep',revision:1});assert.equal(d.get('current').text,'Keep');
  t.mock.timers.enable({apis:['Date'],now:Date.now()+8*86400000});
  assert.equal(d.get('current').text,'');assert.equal(s.getItem('herdr-mobile:draft:current'),null);
});
