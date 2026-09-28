import test from'node:test';import assert from'node:assert/strict';
import{normalizeSnapshot,frameFromLine}from'../server/herdr.mjs';import{readConfig}from'../server/security.mjs';
const raw={result:{snapshot:{version:'fixture-1',protocol:22,workspaces:[{id:'w1',label:'Nextide'}],tabs:[{id:'w1:t1',label:'Work'}],panes:[],agents:[{terminal_id:'term_1',pane_id:'w1:p1',workspace_id:'w1',tab_id:'w1:t1',name:'My label',title:'Generated title',agent:'codex',agent_status:'working',tokens:{summary:'Existing summary'},agent_session:{value:'thread1'}}]}}};
test('normalizes verified metadata without creating a downstream conversation',()=>{const s=normalizeSnapshot(raw,readConfig({}),'epoch');assert.equal(s.panes[0].title,'My label');assert.equal(s.panes[0].space,'Nextide');assert.equal(s.panes[0].summary,'Existing summary');assert.equal(s.panes[0].sessionId,'thread1');assert.equal(s.capabilities.liveWrites,false);});
test('missing metadata is optional, unknown schema is not silently accepted',()=>{const s=structuredClone(raw);delete s.result.snapshot.agents[0].tokens;assert.equal(normalizeSnapshot(s,readConfig({}),'e').panes[0].summary,'');assert.throws(()=>normalizeSnapshot({panes:[]},readConfig({}),'e'),/unsupported_snapshot/);});
test('agent rows retain explicit pane labels while agent identity and names win',()=>{
  const fixture=structuredClone(raw);const agent=fixture.result.snapshot.agents[0];delete agent.name;
  fixture.result.snapshot.panes=[{pane_id:agent.pane_id,terminal_id:agent.terminal_id,label:'My explicit pane label',agent_session:{value:'old-session'}}];
  let pane=normalizeSnapshot(fixture,readConfig({}),'e').panes[0];
  assert.equal(pane.title,'My explicit pane label');assert.equal(pane.sessionId,'thread1');
  agent.name='Named agent';pane=normalizeSnapshot(fixture,readConfig({}),'e').panes[0];assert.equal(pane.title,'Named agent');
});
test('landing identity keeps equal labels separate and uses repo only when a space has no name',()=>{
  const fixture=structuredClone(raw),s=fixture.result.snapshot;
  s.workspaces=[{workspace_id:'w1',label:'Same'},{workspace_id:'w2',label:'Same',worktree:{repo_name:'other-repo'}},{workspace_id:'w3',label:'',worktree:{repo_name:'herdr-mobile'}}];
  s.tabs=[{tab_id:'t1',label:'Main'},{tab_id:'t2',label:'Main'},{tab_id:'t3',label:'Main'}];
  s.agents=[1,2,3].map((number)=>({...s.agents[0],terminal_id:`term_${number}`,pane_id:`pane_${number}`,workspace_id:`w${number}`,tab_id:`t${number}`}));
  const panes=normalizeSnapshot(fixture,readConfig({}),'e').panes;
  assert.deepEqual(panes.map(p=>[p.spaceId,p.tabId,p.spaceLabel,p.repo,p.space]),[
    ['w1','t1','Same','','Same'],['w2','t2','Same','other-repo','Same'],['w3','t3','','herdr-mobile','herdr-mobile']
  ]);
  s.workspaces=[];s.tabs=[];
  const missing=normalizeSnapshot(fixture,readConfig({}),'e').panes;
  assert.deepEqual(missing.map(p=>[p.space,p.tab]),[['w1','t1'],['w2','t2'],['w3','t3']]);
});
test('terminal frames must use bounded ANSI/base64 payloads',()=>{const f={type:'terminal.frame',seq:1,encoding:'ansi',width:100,height:32,full:true,bytes:Buffer.from('hello').toString('base64')};assert.equal(frameFromLine(JSON.stringify(f)).seq,1);for(const patch of [{encoding:'binary'},{seq:-1},{width:10001},{height:0},{bytes:'invalid!!!'},{full:'yes'}])assert.throws(()=>frameFromLine(JSON.stringify({...f,...patch})));});
test('malformed terminal JSON is rejected',()=>assert.throws(()=>frameFromLine('not json'),/invalid_terminal_json/));
