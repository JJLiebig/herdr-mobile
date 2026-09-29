const PREFIX='herdr-mobile:draft:';
const MAX_AGE=7*86400000;
/** Remove drafts left by the former composer when the app opens. */
export class DraftStore {
  constructor(storage){
    try{this.storage=storage ?? globalThis.localStorage;this.prune();}catch{}
  }
  prune(){
    const entries=[];
    for(let i=0;i<this.storage.length;i++){
      const key=this.storage.key(i);if(!key?.startsWith(PREFIX))continue;
      let savedAt=0;try{savedAt=Number(JSON.parse(this.storage.getItem(key))?.savedAt)||0;}catch{}
      entries.push({key,savedAt});
    }
    entries.sort((a,b)=>b.savedAt-a.savedAt);
    for(const [i,{key,savedAt}] of entries.entries())if(i>=50 || Date.now()-savedAt>=MAX_AGE)this.storage.removeItem(key);
  }
}
