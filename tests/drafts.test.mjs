import test from 'node:test';
import assert from 'node:assert/strict';
import {DraftStore} from '../public/drafts.mjs';

class MemoryStorage {
  map=new Map();
  get length(){return this.map.size;}
  key(i){return [...this.map.keys()][i]??null;}
  getItem(k){return this.map.get(k)??null;}
  setItem(k,v){this.map.set(k,v);}
  removeItem(k){this.map.delete(k);}
}

test('legacy draft cleanup keeps the newest 50, removes expired data, and leaves unrelated storage alone',()=>{
  const storage=new MemoryStorage(),now=Date.now();
  storage.setItem('unrelated','keep');
  for(let i=0;i<52;i++)storage.setItem(`herdr-mobile:draft:${i}`,JSON.stringify({savedAt:now-i}));
  storage.setItem('herdr-mobile:draft:expired',JSON.stringify({savedAt:now-8*86400000}));
  new DraftStore(storage);
  assert.equal(storage.length,51);
  assert.equal(storage.getItem('herdr-mobile:draft:0')!==null,true);
  assert.equal(storage.getItem('herdr-mobile:draft:50'),null);
  assert.equal(storage.getItem('herdr-mobile:draft:expired'),null);
  assert.equal(storage.getItem('unrelated'),'keep');
});

test('unavailable browser storage does not prevent the app from loading',()=>{
  assert.doesNotThrow(()=>new DraftStore({get length(){throw new Error('SecurityError');}}));
});
