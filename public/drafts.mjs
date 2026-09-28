import { MAX_DRAFT } from '../shared/model.mjs';
const PREFIX='herdr-mobile:draft:';
/** Bounded, browser-local draft storage. Audio and terminal output never enter it. */
export class DraftStore {
  constructor(storage=localStorage){this.storage=storage;this.memory=new Map();this.available=true;}
  get(key){
    if(this.memory.has(key))return this.memory.get(key);
    let d={text:'',revision:0,pending:'',lastSent:'',delivery:null};
    try{const raw=JSON.parse(this.storage.getItem(PREFIX+key)||'null');if(raw && Date.now()-raw.savedAt<7*86400000 && typeof raw.text==='string' && raw.text.length<=MAX_DRAFT && Number.isSafeInteger(raw.revision) && raw.revision>=0)d={...d,...raw};}
    catch{this.available=false;}
    this.memory.set(key,d);return d;
  }
  set(key,patch){
    const value={...this.get(key),...patch,savedAt:Date.now()};this.memory.set(key,value);
    try{
      this.storage.setItem(PREFIX+key,JSON.stringify(value));
      const keys=[];for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(k?.startsWith(PREFIX))keys.push(k);}
      if(keys.length>50){const older=keys.filter(k=>k!==PREFIX+key).map(k=>({k,t:JSON.parse(this.storage.getItem(k)||'{}').savedAt||0})).sort((a,b)=>a.t-b.t);for(const {k} of older.slice(0,keys.length-50))this.storage.removeItem(k);}
    }catch{this.available=false;}
    return value;
  }
  clear(){this.memory.clear();try{const keys=[];for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(k?.startsWith(PREFIX))keys.push(k);}for(const key of keys)this.storage.removeItem(key);}catch{this.available=false;}}
}
