import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { StringDecoder } from 'node:string_decoder';
import { titleFor, cleanText } from '../shared/model.mjs';
import { HttpError } from './security.mjs';
const execute=promisify(execFile);
const statuses=new Set(['working','blocked','idle','done','unknown']);
export function normalizeSnapshot(raw, cfg, epoch) {
  const s=raw?.result?.snapshot ?? raw?.snapshot ?? raw;
  if(!s || typeof s.version!=='string' || !Number.isInteger(s.protocol) || !Array.isArray(s.workspaces) || !Array.isArray(s.tabs) || !Array.isArray(s.agents) || !Array.isArray(s.panes) || s.panes.length>1000 || s.agents.length>1000) throw new Error('unsupported_snapshot');
  const workspace=new Map(s.workspaces.map(w=>[w.id ?? w.workspace_id,w]));
  const tabs=new Map(s.tabs.map(t=>[t.id ?? t.tab_id,t]));
  const agentPanes=new Set(s.agents.map(a=>a.pane_id));
  const paneMetadata=new Map(s.panes.map(p=>[p.id ?? p.pane_id,p]));
  const rows=[...s.agents.map(a=>({...paneMetadata.get(a.pane_id),...a})),...s.panes.filter(p=>!agentPanes.has(p.id ?? p.pane_id)).map(p=>({...p,pane_id:p.id ?? p.pane_id,agent:undefined,agent_status:'unknown'}))];
  const panes=rows.map(a=>{
    if(typeof a.terminal_id!=='string' || typeof a.pane_id!=='string') throw new Error('unsupported_pane_identity');
    const space=workspace.get(a.workspace_id),tab=tabs.get(a.tab_id);
    const spaceLabel=cleanText(space?.label)||cleanText(space?.name);
    const repo=cleanText(space?.worktree?.repo_name);
    return {terminalId:a.terminal_id,paneId:a.pane_id,sessionId:typeof a.agent_session?.value==='string'?a.agent_session.value:'',agent:cleanText(a.agent,60),title:titleFor(a),spaceId:a.workspace_id,tabId:a.tab_id,spaceLabel,repo,space:spaceLabel||repo||cleanText(a.workspace_id)||'Space',tab:cleanText(tab?.label)||cleanText(tab?.name)||cleanText(a.tab_id)||'Tab',status:statuses.has(a.agent_status)?a.agent_status:'unknown',summary:cleanText(a.tokens?.summary),summarySource:a.tokens?.summary?'Herdr display metadata':'',observedAt:Date.now()};
  });
  return {schemaVersion:1,host:{id:cfg.hostId,label:cfg.hostLabel},epoch,mode:'herdr-readonly',connected:true,observedAt:Date.now(),capabilities:{liveWrites:false,terminalObserve:true,voice:!!cfg.apiKey},herdrVersion:s.version,herdrProtocol:s.protocol,panes};
}
export function frameFromLine(line) {
  let frame; try { frame=JSON.parse(line); } catch { throw new Error('invalid_terminal_json'); }
  if(frame.type==='terminal.closed') return {type:'terminal.closed',reason:cleanText(frame.reason) || 'Herdr observer closed'};
  if(frame.type!=='terminal.frame' || frame.encoding!=='ansi' || !Number.isSafeInteger(frame.seq) || frame.seq<0 || !Number.isInteger(frame.width) || frame.width<1 || frame.width>1000 || !Number.isInteger(frame.height) || frame.height<1 || frame.height>500 || typeof frame.full!=='boolean' || typeof frame.bytes!=='string' || frame.bytes.length>1400000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame.bytes)) throw new Error('invalid_terminal_frame');
  return {type:'terminal.frame',seq:frame.seq,encoding:'ansi',width:frame.width,height:frame.height,full:frame.full,bytes:frame.bytes};
}
export class HerdrReadonly {
  constructor(cfg,epoch) {this.cfg=cfg;this.epoch=epoch;this.inflight=null;this.last=null;this.cacheUntil=0;this.children=new Set();}
  async snapshot() {
    if(this.last && Date.now()<this.cacheUntil) return this.last;
    if(this.inflight) return this.inflight;
    this.inflight=(async()=>{
      try {
        const {stdout}=await execute(this.cfg.herdrBin,['api','snapshot'],{windowsHide:true,shell:false,timeout:4000,maxBuffer:4*1024*1024,encoding:'utf8'});
        const value=normalizeSnapshot(JSON.parse(stdout.replace(/^\uFEFF/,'')),this.cfg,this.epoch);
        this.last=value;this.cacheUntil=Date.now()+1500;return value;
      } catch {throw new HttpError(503,'herdr_unavailable','Herdr snapshot failed. Check the configured executable and session; no fallback process was launched.');}
      finally {this.inflight=null;}
    })();
    return this.inflight;
  }
  observe(pane,onFrame,onClose,geometry=null) {
    if(this.children.size>=4) throw new HttpError(429,'observer_limit');
    // Only explicit terminal IDs returned by the current snapshot reach this argv.
    const child=spawn(this.cfg.herdrBin,['terminal','session',geometry?'control':'observe',pane.terminalId,'--cols',String(geometry?.cols||100),'--rows',String(geometry?.rows||32)],{windowsHide:true,shell:false,stdio:[geometry?'pipe':'ignore','pipe','ignore']});
    child.stdin?.on('error',()=>stop('terminal_disconnected'));
    this.children.add(child);
    const decoder=new StringDecoder('utf8'); let buffer='';let ended=false;let sawFull=false;let lastSeq=-1;
    const stop=(reason='closed')=>{if(ended)return;ended=true;clearTimeout(startup);this.children.delete(child);child.kill();onClose(reason);};
    const startup=setTimeout(()=>stop('observer_start_timeout'),10000);
    child.stdout.on('data',chunk=>{
      if(ended)return;
      buffer+=decoder.write(chunk);
      if(buffer.length>2*1024*1024){stop('observer_frame_too_large');return;}
      let nl;
      while((nl=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,nl).trim();buffer=buffer.slice(nl+1);if(!line)continue;
        try {
          const frame=frameFromLine(line);
          if(frame.type==='terminal.closed'){stop(frame.reason);return;}
          if(!sawFull && !frame.full){stop('missing_initial_full_frame');return;}
          if(frame.seq<=lastSeq){stop('nonmonotonic_terminal_sequence');return;}
          sawFull ||= frame.full;lastSeq=frame.seq;clearTimeout(startup);onFrame(frame);
        }catch{stop('invalid_observer_frame');return;}
      }
    });
    child.on('error',()=>stop('observer_start_failed'));
    child.on('exit',()=>stop('observer_exited'));
    const release=()=>stop('released');
    release.resize=({cols,rows})=>{if(ended||!geometry)throw new HttpError(409,'viewport_closed');child.stdin.write(JSON.stringify({type:'terminal.resize',cols,rows})+'\n');};
    return release;
  }
  close(){for(const child of this.children)child.kill();this.children.clear();}
}
