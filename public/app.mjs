import { STATUS_LABELS, isFresh, isSnapshot } from '/shared/model.mjs';
import { openTerminal } from './terminal.mjs';
import { setupFocus } from './focus.mjs';
import { DraftStore } from './drafts.mjs';
new DraftStore(); // Prune drafts left by the former composer on each app load.
const $=id=>document.getElementById(id);
const focusUI=setupFocus(document,window);
let snapshot=null,active=null,outputGeneration=0,outputAbort=null,terminalView=null,loadingSnapshot=false,overviewPosition=0,lastLandingSignature='',lastInteraction=0,treeInitialized=false;
const openSpaces=new Set(),openTabs=new Set();
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const targetFor=(s,p)=>({hostId:s.host.id,epoch:s.epoch,terminalId:p.terminalId,paneId:p.paneId,sessionId:p.sessionId||''});
function currentMatches(){try{if(!snapshot || !active)return false;const t=active.target;if(t.epoch!==snapshot.epoch||t.hostId!==snapshot.host.id)return false;const p=snapshot.panes.find(p=>p.terminalId===t.terminalId&&p.paneId===t.paneId&&(p.sessionId||'')===(t.sessionId||''));return !!p&&isFresh(snapshot);}catch{return false;}}
function message(text){$('message').textContent=text;}
function renderFocusStatus(status,label=STATUS_LABELS[status]){
  $('focus-dot').className=`status-dot ${status}`;
  $('focus-status').textContent=label;
}
function renderConnection(error=''){
  const box=$('connection');
  if(error || (snapshot && !isFresh(snapshot))){box.className='connection error';box.textContent=error || 'Connection stale. Input is disconnected.';}
  else if(snapshot){box.className='connection';box.hidden=snapshot.mode!=='demo';box.textContent=snapshot.mode==='demo'?'Demo · example sessions':'';}
  if(error || (snapshot && !isFresh(snapshot)))box.hidden=false;
}
function renderHosts(){
  const select=$('host');const sig=JSON.stringify([snapshot.host,snapshot.hosts]);
  if(select.dataset.signature===sig)return;
  select.dataset.signature=sig;select.replaceChildren();
  const current=el('option','',snapshot.host.label);current.value='';select.append(current);
  for(const host of snapshot.hosts||[]){if(host.id===snapshot.host.id)continue;const option=el('option','',host.label);option.value=host.url;select.append(option);}
}
function threadButton(pane,subtitle=''){
  const freshness=isFresh(snapshot)?'Current':'Stale';
  const button=el('button','thread-row');button.type='button';button.setAttribute('aria-label',`Open ${pane.title} in ${pane.space} / ${pane.tab} · ${pane.agent||'Shell'} · ${STATUS_LABELS[pane.status]} · ${freshness}${pane.summary?` · ${pane.summary}`:''}`);
  button.append(el('span',`status-dot ${pane.status}`));
  const labels=el('span','thread-labels');labels.append(el('span','thread-title',pane.title));
  labels.append(el('span','thread-subtitle',[subtitle,pane.agent||'Shell',STATUS_LABELS[pane.status],freshness].filter(Boolean).join(' · ')));
  if(pane.summary){const summary=el('span','thread-summary',pane.summary);summary.title=pane.summarySource||'';labels.append(summary);}
  button.append(labels);button.addEventListener('click',()=>showPane(pane));return button;
}
function renderLanding(force=false){
  if(!snapshot)return;
  const signature=JSON.stringify([isFresh(snapshot),snapshot.panes.map(({observedAt,...pane})=>pane)]);
  if(!force && (signature===lastLandingSignature || Date.now()-lastInteraction<800))return;
  lastLandingSignature=signature;
  const priority=document.createDocumentFragment();
  for(const [status,label] of [['blocked','Needs input'],['working','Working'],['done','Finished'],['idle','Idle'],['unknown','Other']]){
    const panes=snapshot.panes.filter(p=>p.agent && p.status===status);if(!panes.length)continue;
    if(status!=='working')panes.sort((a,b)=>(b.completionSeq||b.stateChangeSeq||0)-(a.completionSeq||a.stateChangeSeq||0));
    const section=el('section','priority-group');section.append(el('h2','group-label',label));
    for(const pane of panes){
      const space=pane.spaceLabel||pane.repo||(!('spaceLabel' in pane)&&pane.space!=='Space'?pane.space:'');
      const same=panes.filter(other=>other.title===pane.title&&(other.spaceLabel||other.repo||other.space)===(pane.spaceLabel||pane.repo||pane.space));
      const subtitle=same.length>1?[space,pane.tab,same.some(other=>other!==pane&&other.tab===pane.tab)?`Pane ${same.indexOf(pane)+1}`:''].filter(Boolean).join(' · '):space;
      section.append(threadButton(pane,subtitle));
    }
    priority.append(section);
  }
  if(!snapshot.panes.some(p=>p.agent))priority.append(el('p','empty','No agents yet. Browse Spaces for other panes.'));
  $('priority-list').replaceChildren(priority);
  const spaces=new Map();
  for(const pane of snapshot.panes){
    const spaceId=pane.spaceId||pane.space,tabId=pane.tabId||pane.tab;
    if(!spaces.has(spaceId))spaces.set(spaceId,{label:pane.space,tabs:new Map()});
    const tabs=spaces.get(spaceId).tabs;if(!tabs.has(tabId))tabs.set(tabId,{label:pane.tab,panes:[]});tabs.get(tabId).panes.push(pane);
  }
  const tree=document.createDocumentFragment();let spaceIndex=0;
  for(const [spaceId,space] of spaces){
    const spaceGroup=el('details','tree-space');spaceGroup.open=openSpaces.has(spaceId)||(!treeInitialized&&spaceIndex===0);
    spaceGroup.append(el('summary','tree-heading',space.label));
    spaceGroup.addEventListener('toggle',()=>{if(spaceGroup.open)openSpaces.add(spaceId);else openSpaces.delete(spaceId);});
    let tabIndex=0;
    for(const [tabId,tab] of space.tabs){
      const tabGroup=el('details','tree-tab');tabGroup.open=openTabs.has(tabId)||(!treeInitialized&&spaceIndex===0&&tabIndex===0);
      tabGroup.append(el('summary','tree-heading',tab.label));
      tabGroup.addEventListener('toggle',()=>{if(tabGroup.open)openTabs.add(tabId);else openTabs.delete(tabId);});
      for(const pane of tab.panes)tabGroup.append(threadButton(pane));
      spaceGroup.append(tabGroup);tabIndex++;
    }
    tree.append(spaceGroup);spaceIndex++;
  }
  treeInitialized=true;
  if(!spaces.size)tree.append(el('p','empty','No spaces are open.'));
  $('spaces-tree').replaceChildren(tree);
}
function showLandingTab(which){
  for(const name of ['priority','spaces']){
    const selected=name===which,tab=$(name+'-tab');tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
    $(name+'-panel').hidden=!selected;
  }
}
async function refresh(){
  if(loadingSnapshot||document.hidden)return;loadingSnapshot=true;
  try{
    const response=await fetch('/api/snapshot',{cache:'no-store',signal:AbortSignal.timeout(7000)});const data=await response.json();
    if(!response.ok)throw new Error(data.message||'Companion unavailable');if(!isSnapshot(data))throw new Error('Unsupported companion snapshot.');
    snapshot=data;renderConnection();renderHosts();if(!active)renderLanding();else if(!currentMatches()){active.needsReopen=true;closeOutput();renderFocusStatus('unknown','Unavailable');message('This agent identity or companion changed. Return to Agents and reopen it.');}else{const p=snapshot.panes.find(p=>p.terminalId===active.target.terminalId);renderFocusStatus(p.status);}
    if(active&&!active.needsReopen&&currentMatches()&&!document.hidden&&snapshot.mode!=='demo'&&!terminalView)loadOutput();
    updateInput();
  }catch(error){if(snapshot)snapshot={...snapshot,connected:false};renderConnection(error.message);if(!active)renderLanding();else active.needsReopen=true;closeOutput();renderFocusStatus('unknown','Disconnected');$('output-status').textContent='Return to Agents and reopen; check what arrived.';updateInput();}
  finally{loadingSnapshot=false;}
}
function closeOutput(){outputGeneration++;outputAbort?.abort();outputAbort=null;terminalView?.close();terminalView=null;}
async function loadOutput(){
  closeOutput();const gen=outputGeneration;if(!active||!snapshot)return;
  const {pane}=active;const box=$('terminal');box.replaceChildren();$('output-status').textContent=snapshot.mode==='demo'?'':'Connecting…';
  try{
    if(snapshot.mode==='demo'){
      outputAbort=new AbortController();const response=await fetch('/api/output?terminal='+encodeURIComponent(pane.terminalId),{signal:outputAbort.signal});const data=await response.json();if(!response.ok)throw new Error(data.message||'Output unavailable');if(gen!==outputGeneration)return;box.append(el('pre','',data.text));
    }else{
      const view=await openTerminal(box,snapshot,pane,status=>{if(gen===outputGeneration){if(status)active.needsReopen=true;$('output-status').textContent=status;updateInput();}});
      if(gen!==outputGeneration){view.close();return;}terminalView=view;await view.ready;
    }
  }catch(error){if(gen!==outputGeneration||error.name==='AbortError')return;if(active)active.needsReopen=true;closeOutput();box.replaceChildren(el('pre','',error.message));}
}
function showPane(pane){
  focusUI.enter();
  setKeyboard(false);
  overviewPosition=window.scrollY;
  active={pane,target:targetFor(snapshot,pane)};
  $('overview').hidden=true;$('focus').hidden=false;$('focus-host').textContent=snapshot.host.label;
  $('breadcrumb').textContent=`${pane.space} / ${pane.tab}`;$('focus-title').textContent=pane.title;renderFocusStatus(pane.status);
  message(snapshot.mode==='demo'?'Demo · example terminal output.':'');
  updateInput();window.scrollTo(0,0);history.pushState({pane:true},'',`#pane=${encodeURIComponent(pane.terminalId)}`);loadOutput();
}
function back(){focusUI.leave();closeOutput();active=null;$('overview').hidden=false;$('focus').hidden=true;history.replaceState(null,'',location.pathname);renderLanding(true);window.scrollTo(0,overviewPosition);}
function updateInput(){
  const ready=currentMatches()&&!!terminalView?.viewportId;
  $('input-toggle').disabled=!ready;
  for(const key of ['Escape','Tab','Shift','ArrowUp','ArrowDown','Enter'])$('key-'+key).disabled=!ready;
}
let shifted=false;
function setShift(value){shifted=value;$('key-Shift').setAttribute('aria-pressed',String(value));}
function setKeyboard(open){
  $('terminal-keys').hidden=!open;
  $('input-toggle').setAttribute('aria-expanded',String(open));
  $('input-toggle').setAttribute('aria-label',open?'Hide keyboard':'Open keyboard');
  if(open)terminalView?.focus();else{terminalView?.blur();setShift(false);}
}
$('input-toggle').addEventListener('pointerdown',event=>event.preventDefault());
$('input-toggle').addEventListener('click',()=>setKeyboard($('terminal-keys').hidden));
$('key-Shift').addEventListener('pointerdown',event=>event.preventDefault());
$('key-Shift').addEventListener('click',()=>setShift(!shifted));
for(const [key,keys] of Object.entries({Escape:['\x1b','\x1b'],Tab:['\t','\x1b[Z'],ArrowUp:['\x1b[A','\x1b[1;2A'],ArrowDown:['\x1b[B','\x1b[1;2B'],Enter:['\r','\x1b[13;2u']})){
  $('key-'+key).addEventListener('pointerdown',event=>event.preventDefault());
  $('key-'+key).addEventListener('click',()=>{if(terminalView?.key(keys[shifted?1:0])===false)message('Finish composing text, then tap the key again.');else{message('');setShift(false);}});
}
$('keys-close').addEventListener('click',()=>setKeyboard(false));
$('back').addEventListener('click',back);window.addEventListener('popstate',()=>{if(active)back();});
$('latest').addEventListener('click',()=>{terminalView?.latest();$('terminal').scrollTop=$('terminal').scrollHeight;});
for(const name of ['priority','spaces'])$(name+'-tab').addEventListener('click',()=>showLandingTab(name));
for(const name of ['priority','spaces'])$(name+'-tab').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=name==='priority'?'spaces':'priority';showLandingTab(next);$(next+'-tab').focus();});
$('host').addEventListener('change',()=>{const host=snapshot?.hosts?.find(h=>h.url===$('host').value);if(host)location.assign(host.url);});
$('settings-button').addEventListener('click',()=>{$('settings-mode').textContent=snapshot?.mode==='demo'?'Demo preview':'Connected to '+(snapshot?.host.label||'host');$('settings').showModal();});
$('close-settings').addEventListener('click',()=>$('settings').close());
window.addEventListener('pointerdown',()=>{lastInteraction=Date.now();},{passive:true});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(active&&snapshot?.mode!=='demo'){active.needsReopen=true;$('output-status').textContent='Return to Agents and reopen; check what arrived.';}closeOutput();updateInput();}
  else refresh();
});
window.addEventListener('pagehide',closeOutput);
window.addEventListener('online',refresh);window.addEventListener('offline',()=>{if(snapshot)snapshot.connected=false;if(active)active.needsReopen=true;renderConnection('Offline. Input is disconnected.');closeOutput();renderFocusStatus('unknown','Disconnected');updateInput();});
setInterval(()=>{refresh();if(snapshot&&!isFresh(snapshot)){renderConnection();if(!active)renderLanding();updateInput();}},5000);
refresh();
