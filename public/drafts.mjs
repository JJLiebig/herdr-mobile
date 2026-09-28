import { MAX_DRAFT } from '../shared/model.mjs';
const PREFIX='herdr-mobile:draft:';
const MAX_AGE=7*86400000;
/** Bounded, browser-local draft storage. Audio and terminal output never enter it. */
export class DraftStore {
  constructor(storage){
    this.memory=new Map();this.available=true;
    try{this.storage=storage ?? globalThis.localStorage;this.prune();}catch{this.available=false;}
  }
  prune(keep){
    const entries=[];
    for(let i=0;i<this.storage.length;i++){
      const key=this.storage.key(i);if(!key?.startsWith(PREFIX))continue;
      let savedAt=0;try{savedAt=Number(JSON.parse(this.storage.getItem(key))?.savedAt)||0;}catch{}
      entries.push({key,savedAt});
    }
    entries.sort((a,b)=>a.key===keep?-1:b.key===keep?1:b.savedAt-a.savedAt);
    for(const [i,{key,savedAt}] of entries.entries())if(i>=50 || Date.now()-savedAt>=MAX_AGE)this.storage.removeItem(key);
  }
  get(key){
    const cached=this.memory.get(key);
    if(cached && (!cached.savedAt || Date.now()-cached.savedAt<MAX_AGE))return cached;
    let d={text:'',revision:0,pending:'',lastSent:'',delivery:null};
    try{const raw=JSON.parse(this.storage.getItem(PREFIX+key)||'null');if(raw && Date.now()-raw.savedAt<MAX_AGE && typeof raw.text==='string' && raw.text.length<=MAX_DRAFT && Number.isSafeInteger(raw.revision) && raw.revision>=0)d={...d,...raw};else if(raw)this.storage.removeItem(PREFIX+key);}
    catch{this.available=false;}
    this.memory.set(key,d);return d;
  }
  set(key,patch){
    const value={...this.get(key),...patch,savedAt:Date.now()};this.memory.set(key,value);
    try{
      this.storage.setItem(PREFIX+key,JSON.stringify(value));
      this.prune(PREFIX+key);
    }catch{this.available=false;}
    return value;
  }
  clear(){this.memory.clear();try{const keys=[];for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(k?.startsWith(PREFIX))keys.push(k);}for(const key of keys)this.storage.removeItem(key);}catch{this.available=false;}}
}
