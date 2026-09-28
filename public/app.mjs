import { STATUS_LABELS, MAX_DRAFT, draftKey, appendTranscript, isFresh, isSnapshot, guardTarget } from '/shared/model.mjs';
import { DraftStore } from './drafts.mjs';
import { VoiceRecorder } from './voice.mjs';
import { openTerminal } from './terminal.mjs';
import { setupFocus } from './focus.mjs';
const $=id=>document.getElementById(id);
const focusUI=setupFocus(document,window,()=>{
  if(['recording','permission'].includes(voiceState.phase))voice.cancel();
});
const drafts=new DraftStore();
let snapshot=null, active=null, landingTab='priority', composing=false, outputGeneration=0, outputAbort=null, terminalView=null, loadingSnapshot=false, overviewPosition=0, lastLandingSignature='', lastInteraction=0, treeInitialized=false;
const openSpaces=new Set(),openTabs=new Set(),sending=new Set();
let voiceState={phase:'idle',message:'',elapsed:0};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const targetFor=(s,p)=>({hostId:s.host.id,epoch:s.epoch,terminalId:p.terminalId,paneId:p.paneId,sessionId:p.sessionId||''});
function currentMatches(){try{if(!snapshot || !active)return false;const t=active.target;if(t.epoch!==snapshot.epoch||t.hostId!==snapshot.host.id)return false;const p=snapshot.panes.find(p=>p.terminalId===t.terminalId&&p.paneId===t.paneId&&(p.sessionId||'')===(t.sessionId||''));return !!p&&isFresh(snapshot);}catch{return false;}}
function message(text){$('message').textContent=text;}
const voice=new VoiceRecorder({onState:state=>{voiceState=state;renderVoice();updateComposer();},onText:(binding,text)=>{
  const old=drafts.get(binding.key);const result=appendTranscript(old,binding.revision,text);
  if(result.kind==='applied')drafts.set(binding.key,result.draft);
  else if(result.kind==='conflict'||result.kind==='too-long')drafts.set(binding.key,{pending:result.transcript});
  if(active?.key===binding.key){syncDraft();message(result.kind==='applied'?'Transcript added. Review it before sending.':'You edited the draft while transcribing. Review the separate transcript below.');}
}});
function renderConnection(error=''){
  const box=$('connection');
  if(error || (snapshot && !isFresh(snapshot))){box.className='connection error';box.textContent=error || 'Connection stale. Drafts are kept; sending is disabled.';}
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
  const button=el('button','thread-row');button.type='button';button.setAttribute('aria-label',`Open ${pane.title} in ${pane.space} / ${pane.tab} · ${STATUS_LABELS[pane.status]}`);
  button.append(el('span',`status-dot ${pane.status}`));
  const labels=el('span','thread-labels');labels.append(el('span','thread-title',pane.title));
  labels.append(el('span','thread-subtitle',subtitle||STATUS_LABELS[pane.status]));
  button.append(labels);button.addEventListener('click',()=>showPane(pane));return button;
}
function renderLanding(force=false){
  if(!snapshot)return;
  const signature=JSON.stringify(snapshot.panes.map(({observedAt,...pane})=>pane));
  if(!force && (signature===lastLandingSignature || Date.now()-lastInteraction<800))return;
  lastLandingSignature=signature;
  const priority=document.createDocumentFragment();
  for(const [status,label] of [['blocked','Needs input'],['done','Finished'],['working','Working'],['idle','Idle'],['unknown','Other']]){
    const panes=snapshot.panes.filter(p=>p.agent && p.status===status);if(!panes.length)continue;
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
  landingTab=which;
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
    snapshot=data;renderConnection();renderHosts();if(!active)renderLanding();else if(!currentMatches()){closeOutput();message('This agent identity or companion changed. Return to Agents and reopen it. Your draft is preserved.');}else{const p=snapshot.panes.find(p=>p.terminalId===active.target.terminalId);$('focus-status').textContent=`${p.agent||'Shell'} · ${STATUS_LABELS[p.status]}`;}
    if(active&&currentMatches()&&!document.hidden&&snapshot.mode!=='demo'&&(!terminalView||terminalView.closed))loadOutput();
    updateComposer();
  }catch(error){if(snapshot)snapshot={...snapshot,connected:false};renderConnection(error.message);closeOutput();$('output-status').textContent='Reconnecting…';updateComposer();}
  finally{loadingSnapshot=false;}
}
function closeOutput(){outputGeneration++;outputAbort?.abort();outputAbort=null;terminalView?.close();terminalView=null;}
async function loadOutput(){
  closeOutput();const gen=outputGeneration;if(!active||!snapshot)return;
  const {pane}=active;const box=$('terminal');box.replaceChildren();$('output-status').textContent=snapshot.mode==='demo'?'ILLUSTRATIVE OUTPUT':'READ-ONLY TERMINAL';
  try{
    if(snapshot.mode==='demo'){
      outputAbort=new AbortController();const response=await fetch('/api/output?terminal='+encodeURIComponent(pane.terminalId),{signal:outputAbort.signal});const data=await response.json();if(!response.ok)throw new Error(data.message||'Output unavailable');if(gen!==outputGeneration)return;box.append(el('pre','',data.text));
    }else{
      const view=await openTerminal(box,snapshot,pane,status=>{if(gen===outputGeneration)$('output-status').textContent=status;});
      if(gen!==outputGeneration){view.close();return;}terminalView=view;await view.ready;
    }
  }catch(error){if(gen!==outputGeneration||error.name==='AbortError')return;closeOutput();box.replaceChildren(el('pre','',error.message));}
}
function showPane(pane){
  focusUI.enter();
  overviewPosition=window.scrollY;const key=draftKey(snapshot.host.id,snapshot.epoch,pane);
  active={pane,key,target:targetFor(snapshot,pane)};
  $('overview').hidden=true;$('focus').hidden=false;$('focus-host').textContent=snapshot.host.label;
  $('breadcrumb').textContent=`${pane.space} / ${pane.tab}`;$('focus-title').textContent=pane.title;$('focus-status').textContent=`${pane.agent||'Shell'} · ${STATUS_LABELS[pane.status]}`;
  message(snapshot.mode==='demo'?'Demo · messages are simulated.':'');
  syncDraft();window.scrollTo(0,0);history.pushState({pane:true},'',`#pane=${encodeURIComponent(pane.terminalId)}`);loadOutput();
}
function back(){focusUI.leave();closeOutput();active=null;$('overview').hidden=false;$('focus').hidden=true;history.replaceState(null,'',location.pathname);renderLanding(true);window.scrollTo(0,overviewPosition);}
function syncDraft(){
  if(!active)return;let d=drafts.get(active.key);
  if(d.delivery?.status==='pending' && !sending.has(active.key))d=drafts.set(active.key,{delivery:{...d.delivery,status:'outcome_unknown'}});
  $('draft').value=d.text;$('pending-transcript').hidden=!d.pending;$('pending-text').textContent=d.pending||'';
  $('restore-sent').hidden=!d.lastSent;
  updateComposer();renderVoice();
}
function updateComposer(){
  if(!active)return;
  const d=drafts.get(active.key);const uncertain=['pending','outcome_unknown'].includes(d.delivery?.status);
  $('draft-count').textContent=`${d.text.length} / ${MAX_DRAFT}`;
  const enabled=currentMatches()&&snapshot.mode==='demo'&&!!active.pane.agent&&!sending.has(active.key)&&!composing&&d.text.trim().length>0&&!uncertain&&!['recording','permission','transcribing'].includes(voiceState.phase);
  $('send').disabled=!enabled;$('send').textContent=snapshot.mode==='demo'?(sending.has(active.key)?'Sending…':'Send demo ↗'):'Read-only';
  $('ack-delivery').hidden=!uncertain||sending.has(active.key);
  if(uncertain)message('Delivery outcome is unknown. Check the target before enabling a new send. This draft will not be replayed.');
  if(!drafts.available)$('composer-hint').textContent='Browser storage unavailable. This draft is kept only in this tab.';
}
function renderVoice(){
  if(!$('voice-status'))return;
  const phase=voiceState.phase;const elsewhere=voice.binding&&active&&voice.binding.key!==active.key&&phase!=='idle';
  $('voice-status').textContent=(elsewhere?'Recording belongs to another agent. ':'')+(phase==='recording'?`Recording · ${voiceState.elapsed}s / 180s`:voiceState.message||'');
  const pending=active&&drafts.get(active.key).pending;
  $('record').setAttribute('aria-label',phase==='recording'?'Stop recording':'Record voice');$('record').classList.toggle('recording',phase==='recording');
  $('stop-voice').hidden=phase!=='recording';
  $('record').disabled=!active||!snapshot?.capabilities.voice||['permission','transcribing','recorded'].includes(phase)||!!pending||!!voice.blob;
  $('transcribe').hidden=!voice.blob||phase==='transcribing';$('transcribe').textContent=phase==='error'?'Retry transcription':'Transcribe';
  $('cancel-voice').hidden=phase==='idle'&&!voice.blob;
  if(snapshot&&!snapshot.capabilities.voice&&phase==='idle')$('voice-status').textContent='Voice API not configured. Your keyboard microphone still works here.';
}
$('composer').addEventListener('submit',async event=>{
  event.preventDefault();if($('send').disabled||!active||composing)return;
  const binding={...active};try{guardTarget(snapshot,binding.target);}catch{message('Target is no longer an agent. Reopen it from the overview.');return;}const d=drafts.get(binding.key);if(sending.has(binding.key))return;
  const op={id:Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),target:binding.target,text:d.text};const revision=d.revision;
  drafts.set(binding.key,{delivery:{id:op.id,status:'pending'}});sending.add(binding.key);updateComposer();
  try{
    const response=await fetch('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json','X-Herdr-Mobile':'1'},body:JSON.stringify(op),signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok){drafts.set(binding.key,{delivery:{id:op.id,status:response.status>=500?'outcome_unknown':'rejected'}});throw new Error(data.message||'Submission rejected');}
    if(data.id!==op.id||data.status!=='simulated'||data.submittedToAgent!==false)throw new Error('Unexpected submission acknowledgment; inspect the target.');
    const current=drafts.get(binding.key);drafts.set(binding.key,{text:current.revision===revision?'':current.text,revision:current.revision===revision?current.revision+1:current.revision,lastSent:op.text,delivery:{id:op.id,status:'simulated'}});
    if(active?.key===binding.key){message(data.message);if(current.revision===revision)focusUI.sent();}
  }catch(error){
    const saved=drafts.get(binding.key);if(saved.delivery?.status==='pending')drafts.set(binding.key,{delivery:{id:op.id,status:'outcome_unknown'}});
    if(active?.key===binding.key)message(error.message);
  }finally{sending.delete(binding.key);if(active?.key===binding.key)syncDraft();}
});
$('draft').addEventListener('input',()=>{if(!active)return;const d=drafts.get(active.key);drafts.set(active.key,{text:$('draft').value,revision:d.revision+1});updateComposer();});
$('draft').addEventListener('compositionstart',()=>{composing=true;updateComposer();});$('draft').addEventListener('compositionend',()=>{composing=false;updateComposer();});
$('record').addEventListener('click',()=>{
  if(voiceState.phase==='recording'){voice.stop();return;}if(!active)return;
  if(!confirm('Record on this phone? You will review the recording before sending its audio to OpenAI for transcription. Transcription may incur API charges. Nothing is sent to the agent automatically.'))return;
  const d=drafts.get(active.key);voice.record({key:active.key,revision:d.revision,title:active.pane.title});
});
$('transcribe').addEventListener('click',()=>voice.transcribe());$('cancel-voice').addEventListener('click',()=>voice.cancel());
$('stop-voice').addEventListener('click',()=>voice.stop());
$('insert-transcript').addEventListener('click',()=>{if(!active)return;const d=drafts.get(active.key);const result=appendTranscript(d,d.revision,d.pending);if(result.kind==='applied'){drafts.set(active.key,{...result.draft,pending:''});syncDraft();}else message('The combined draft exceeds the limit. Shorten it before appending.');});
$('discard-transcript').addEventListener('click',()=>{if(active){drafts.set(active.key,{pending:''});syncDraft();}});
$('restore-sent').addEventListener('click',()=>{if(!active)return;const d=drafts.get(active.key);if(d.text&&!confirm('Replace the current draft with your last sent draft?'))return;drafts.set(active.key,{text:d.lastSent,revision:d.revision+1});syncDraft();});
$('ack-delivery').addEventListener('click',()=>{if(active&&confirm('Have you checked whether the previous instruction arrived? This enables a NEW explicit send; it does not replay the old request.')){drafts.set(active.key,{delivery:null});message('New sends enabled. Review the draft carefully.');updateComposer();}});
$('back').addEventListener('click',back);window.addEventListener('popstate',()=>{if(active)back();});
$('latest').addEventListener('click',()=>{terminalView?.latest();$('terminal').scrollTop=$('terminal').scrollHeight;});
for(const name of ['priority','spaces'])$(name+'-tab').addEventListener('click',()=>showLandingTab(name));
for(const name of ['priority','spaces'])$(name+'-tab').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=name==='priority'?'spaces':'priority';showLandingTab(next);$(next+'-tab').focus();});
$('host').addEventListener('change',()=>{const host=snapshot?.hosts?.find(h=>h.url===$('host').value);if(!host)return;if(voiceState.phase!=='idle'&&!confirm('Switching machines discards the current recording. Continue?')){$('host').value='';return;}voice.cancel();location.assign(host.url);});
$('settings-button').addEventListener('click',()=>{$('settings-mode').textContent=`Companion: ${snapshot?.mode||'disconnected'} · v0.1.0-draft.1`;$('voice-settings').textContent=snapshot?.voiceProvider?`${snapshot.voiceProvider} · ${snapshot.voiceModel}. Record, transcribe, review, then explicitly send. Credentials stay on the host.`:'No transcription provider configured. Android keyboard dictation works in the normal text box.';$('settings').showModal();});
$('close-settings').addEventListener('click',()=>$('settings').close());
$('clear-drafts').addEventListener('click',()=>{if(confirm('Delete all local drafts, pending transcripts and last-sent copies from this browser?')){voice.cancel();drafts.clear();if(active)syncDraft();}});
window.addEventListener('pointerdown',()=>{lastInteraction=Date.now();},{passive:true});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){closeOutput();if(['recording','permission'].includes(voiceState.phase)){voice.cancel();voice.state('idle','Recording cancelled when the app went into the background.');}}
  else refresh();
});
window.addEventListener('pagehide',()=>{closeOutput();voice.cancel();});
window.addEventListener('online',refresh);window.addEventListener('offline',()=>{if(snapshot)snapshot.connected=false;renderConnection('Offline. Drafts are preserved; sending is disabled.');closeOutput();updateComposer();});
setInterval(()=>{refresh();if(snapshot&&!isFresh(snapshot)){renderConnection();updateComposer();}},5000);
refresh();
