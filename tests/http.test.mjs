import test from'node:test';import assert from'node:assert/strict';import{createApp}from'../server/app.mjs';import{readConfig}from'../server/security.mjs';
import {request as httpRequest} from 'node:http';
async function withApp(run,extras={}){const cfg={...readConfig({}),...extras};const{server}=await createApp(cfg,{epoch:'test-epoch',...extras.options});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;cfg.origin=`http://127.0.0.1:${port}`;cfg.host=`127.0.0.1:${port}`;const request=(path,init={})=>fetch(cfg.origin+path,init);try{await run(request,cfg);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}}
test('serves the mobile shell, its modules and normalized demo snapshot',()=>withApp(async request=>{const shell=await request('/');assert.equal(shell.status,200);for(const path of ['/focus.mjs','/focus.css']){const response=await request(path);assert.equal(response.status,200);assert.ok((await response.text()).length>0);}const s=await(await request('/api/snapshot')).json();assert.equal(s.mode,'demo');assert.equal(s.capabilities.liveWrites,false);assert.equal(s.panes.length,5);}));
test('does not expose server source, env files, arbitrary paths, or arbitrary module files',()=>withApp(async request=>{for(const p of ['/.env','/server/security.mjs','/docs/blueprint.md','/../../etc/passwd'])assert.equal((await request(p)).status,404,p);}));

test('viewport sizing stays on its attached terminal and release invalidates the lease',async()=>{
  const sizes=[];let attached=0;const released=Promise.withResolvers();
  const pane={terminalId:'terminal',paneId:'pane',sessionId:'session'};
  const herdr={snapshot:async()=>({epoch:'test-epoch',panes:[pane]}),observe(target,onFrame,onClose,size){
    attached++;assert.deepEqual(target,pane);sizes.push(size);
    const stop=()=>released.resolve();stop.resize=size=>sizes.push({cols:size.cols,rows:size.rows});return stop;
  }};
  await withApp(async(request,cfg)=>{
    const headers={Origin:cfg.origin,'X-Herdr-Mobile':'1','Content-Type':'application/json'};
    const path='/api/terminal?terminal=terminal&pane=pane&session=session&epoch=test-epoch';
    assert.equal((await request(path,{method:'POST',body:'{"cols":40,"rows":30}'})).status,403);
    assert.equal((await request(path,{method:'POST',headers,body:'{"cols":0,"rows":30}'})).status,400);
    assert.equal(attached,0);
    const abort=new AbortController();const stream=await request(path,{method:'POST',headers,body:'{"cols":40,"rows":30}',signal:abort.signal});
    const reader=stream.body.getReader();const chunk=new TextDecoder().decode((await reader.read()).value);
    const id=JSON.parse(chunk.match(/data: (.+)/)[1]).id;
    assert.equal((await request('/api/viewport',{method:'POST',headers,body:JSON.stringify({id,cols:60,rows:18,terminal:'other'})})).status,200);
    assert.deepEqual(sizes,[{cols:40,rows:30},{cols:60,rows:18}]);
    abort.abort();await released.promise;
    assert.equal((await request('/api/viewport',{method:'POST',headers,body:JSON.stringify({id,cols:40,rows:30})})).status,409);
  },{mode:'herdr-readonly',options:{herdr}});
});
test('forbidden Origin cannot read snapshots',()=>withApp(async request=>assert.equal((await request('/api/snapshot',{headers:{Origin:'https://evil.example'}})).status,403)));
test('LAN and primary addresses both work while cross-origin requests between them are rejected',()=>withApp(async(request,cfg)=>{
  assert.equal((await request('/api/snapshot')).status,200);
  const headers={Host:'192.168.178.24:8787',Origin:'http://192.168.178.24:8787'};
  // node:http preserves the explicit Host; fetch uses the connection URL's Host.
  const send=(path,options={})=>new Promise((resolve,reject)=>{
    const req=httpRequest(cfg.origin+path,{...options,headers:{...headers,...options.headers}},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text)}));});
    req.on('error',reject);req.end(options.body);
  });
  const response=await send('/api/snapshot');assert.equal(response.status,200);
  const s=response.data;const p=s.panes[0];
  const body=JSON.stringify({id:'lan-operation-123',target:{hostId:s.host.id,epoch:s.epoch,terminalId:p.terminalId,paneId:p.paneId,sessionId:p.sessionId},text:'LAN demo'});
  assert.equal((await send('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json','X-Herdr-Mobile':'1'},body})).status,200);
  assert.equal((await send('/api/snapshot',{headers:{Origin:cfg.origin}})).status,403);
},{extraOrigins:['http://192.168.178.24:8787']}));
test('missing CSRF protection rejects prompt submissions',()=>withApp(async request=>assert.equal((await request('/api/prompt',{method:'POST',body:'{}'})).status,403)));
test('demo send is explicitly simulated and duplicate-safe',()=>withApp(async(request,cfg)=>{const s=await(await request('/api/snapshot')).json();const p=s.panes[0];const op={id:'http-operation-123',target:{hostId:s.host.id,epoch:s.epoch,terminalId:p.terminalId,paneId:p.paneId,sessionId:p.sessionId},text:'Hallo\n🦊'};const send=()=>request('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json',Origin:cfg.origin,'X-Herdr-Mobile':'1'},body:JSON.stringify(op)});const a=await(await send()).json();const b=await(await send()).json();assert.deepEqual(a,b);assert.equal(a.status,'simulated');assert.equal(a.submittedToAgent,false);}));
test('stale target cannot submit even a demo prompt',()=>withApp(async(request,cfg)=>{const response=await request('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json',Origin:cfg.origin,'X-Herdr-Mobile':'1'},body:JSON.stringify({id:'stale-operation',text:'Do it',target:{epoch:'old'}})});assert.equal(response.status,409);}));
test('real mode always rejects prompt mutation',()=>withApp(async(request,cfg)=>{const response=await request('/api/prompt',{method:'POST',headers:{Origin:cfg.origin,'X-Herdr-Mobile':'1'},body:'{}'});assert.equal(response.status,501);assert.equal((await response.json()).error,'live_control_not_implemented');},{mode:'herdr-readonly',options:{herdr:{snapshot(){throw new Error('must not be called');},close(){}}}}));
test('transcription requires explicit cloud consent',()=>withApp(async(request,cfg)=>{const response=await request('/api/transcribe',{method:'POST',headers:{Origin:cfg.origin,'X-Herdr-Mobile':'1','Content-Type':'audio/webm'},body:'audio'});assert.equal(response.status,400);assert.equal((await response.json()).error,'voice_consent_required');}));
test('security headers prevent caching output and framing',()=>withApp(async request=>{const r=await request('/api/snapshot');assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('X-Frame-Options'),'DENY');assert.match(r.headers.get('Content-Security-Policy'),/connect-src 'self'/);}));
