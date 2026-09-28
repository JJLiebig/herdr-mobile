import test from 'node:test';import assert from'node:assert/strict';
import{readConfig,authorize,validateHosts}from'../server/security.mjs';
const cfg=readConfig({});const req=(headers={},method='GET')=>({socket:{remoteAddress:'127.0.0.1'},method,headers:{host:cfg.host,...headers}});
test('live write mode does not exist',()=>assert.throws(()=>readConfig({HERDR_MOBILE_MODE:'live'}),/not available/));
test('foreign Host and Origin are rejected even on loopback',()=>{assert.throws(()=>authorize(req({host:'evil.example'}),cfg),/invalid_host/);assert.throws(()=>authorize(req({origin:'https://evil.example'}),cfg),/invalid_origin/);});
test('all mutations require the exact origin and custom header',()=>{assert.throws(()=>authorize(req({},'POST'),cfg),/csrf/);assert.throws(()=>authorize(req({origin:cfg.origin},'POST'),cfg),/csrf/);authorize(req({origin:cfg.origin,'x-herdr-mobile':'1'},'POST'),cfg);});
test('cross-site browser requests are rejected',()=>assert.throws(()=>authorize(req({'sec-fetch-site':'cross-site'}),cfg),/cross_site/));
test('direct network requests need no proxy identity but still reject foreign origins',()=>{
  const c=readConfig({HERDR_MOBILE_BIND:'0.0.0.0',HERDR_MOBILE_ORIGIN:'http://100.64.0.1:8787'});
  const r={socket:{remoteAddress:'100.64.0.2'},method:'GET',headers:{host:c.host}};authorize(r,c);
  r.headers.origin='https://evil.example';assert.throws(()=>authorize(r,c),/invalid_origin/);
});
test('machine destinations accept HTTP IPs and HTTPS names but reject executable URLs, credentials and paths',()=>{
  for(const url of ['http://100.64.0.1:8787','https://desktop.net.ts.net'])assert.equal(validateHosts([{id:'desktop',label:'Desktop',url}])[0].url,url);
  for(const url of ['javascript:alert(1)','file:///etc/passwd','https://user:pass@host.net.ts.net','https://host.net.ts.net/proxy','https://host.net.ts.net?q=x'])assert.throws(()=>validateHosts([{id:'x',label:'X',url}]));
});
