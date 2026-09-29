import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { authorize, commonHeaders, readBody, HttpError, validateHosts } from './security.mjs';
import { MAX_AUDIO } from '../shared/model.mjs';
import { HerdrReadonly } from './herdr.mjs';
import { demoSnapshot, demoOutput } from './demo.mjs';
import { TranscriptionService } from './transcription.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const staticFiles=new Map([
 ['/', ['public/index.html','text/html; charset=utf-8']],['/index.html',['public/index.html','text/html; charset=utf-8']],
 ['/focus.mjs',['public/focus.mjs','text/javascript; charset=utf-8']],['/focus.css',['public/focus.css','text/css; charset=utf-8']],
 ['/app.mjs',['public/app.mjs','text/javascript; charset=utf-8']],['/voice.mjs',['public/voice.mjs','text/javascript; charset=utf-8']],['/terminal.mjs',['public/terminal.mjs','text/javascript; charset=utf-8']],['/drafts.mjs',['public/drafts.mjs','text/javascript; charset=utf-8']],['/style.css',['public/style.css','text/css; charset=utf-8']],['/manifest.webmanifest',['public/manifest.webmanifest','application/manifest+json']],['/icon.svg',['public/icon.svg','image/svg+xml']],['/shared/model.mjs',['shared/model.mjs','text/javascript; charset=utf-8']],
 ['/vendor/xterm.js',['node_modules/@xterm/xterm/lib/xterm.js','text/javascript; charset=utf-8']],['/vendor/xterm.css',['node_modules/@xterm/xterm/css/xterm.css','text/css; charset=utf-8']]
]);
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
export async function createApp(cfg, options={}) {
  const epoch=options.epoch || randomUUID();
  const viewports=new Map();
  const validSize=({cols,rows})=>Number.isInteger(cols)&&cols>=1&&cols<=1000&&Number.isInteger(rows)&&rows>=1&&rows<=500;
  const herdr=options.herdr || (cfg.mode==='herdr-readonly'?new HerdrReadonly(cfg,epoch):null);
  const transcription=options.transcription || new TranscriptionService(cfg);
  let hosts=[];
  if(cfg.configPath)hosts=validateHosts(JSON.parse(await readFile(cfg.configPath,'utf8')).hosts);
  const snapshot=()=>cfg.mode==='demo'?Promise.resolve(demoSnapshot(cfg,epoch)):herdr.snapshot();
  const server=createServer({maxHeaderSize:16384},async(req,res)=>{
    commonHeaders(res);
    try{
      authorize(req,cfg);
      const url=new URL(req.url,cfg.origin);const path=url.pathname;
      if(req.method==='GET' && path==='/api/snapshot'){
        const s=await snapshot();json(res,200,{...s,hosts,voiceProvider:cfg.apiKey?'OpenAI':'',voiceModel:cfg.apiKey?cfg.transcriptionModel:''});return;
      }
      if(req.method==='GET' && path==='/api/output'){
        if(cfg.mode!=='demo')throw new HttpError(404,'demo_only');
        const s=await snapshot();const pane=s.panes.find(p=>p.terminalId===url.searchParams.get('terminal'));
        if(!pane)throw new HttpError(404,'pane_not_found');json(res,200,{text:demoOutput(pane)});return;
      }
      if(req.method==='POST' && path==='/api/viewport'){
        let body;try{body=JSON.parse((await readBody(req,4096)).toString('utf8'));}catch{throw new HttpError(400,'invalid_viewport');}
        if(!body||!validSize(body))throw new HttpError(400,'invalid_viewport','Viewport cols must be 1–1000 and rows 1–500.');
        const controller=viewports.get(body.id);if(!controller)throw new HttpError(409,'viewport_closed');
        controller.resize(body);json(res,200,{status:'resized'});return;
      }
      if(req.method==='POST' && path==='/api/scroll'){
        let body;try{body=JSON.parse((await readBody(req,4096)).toString('utf8'));}catch{throw new HttpError(400,'invalid_scroll');}
        if(!body||!['up','down'].includes(body.direction)||!Number.isInteger(body.lines)||body.lines<1||body.lines>65535||!Number.isInteger(body.column)||body.column<0||body.column>999||!Number.isInteger(body.row)||body.row<0||body.row>499)throw new HttpError(400,'invalid_scroll');
        const controller=viewports.get(body.id);if(!controller)throw new HttpError(409,'viewport_closed');
        controller.scroll(body);json(res,200,{status:'scrolled'});return;
      }
      if((req.method==='GET'||req.method==='POST') && path==='/api/terminal'){
        if(cfg.mode!=='herdr-readonly')throw new HttpError(404,'read_only_observer_unavailable');
        let geometry=null;
        if(req.method==='POST'){
          try{geometry=JSON.parse((await readBody(req,4096)).toString('utf8'));}catch{throw new HttpError(400,'invalid_viewport');}
          if(!geometry||!validSize(geometry))throw new HttpError(400,'invalid_viewport','Viewport cols must be 1–1000 and rows 1–500.');
        }
        const s=await snapshot();
        if(url.searchParams.get('epoch')!==s.epoch)throw new HttpError(409,'stale_target');
        const pane=s.panes.find(p=>p.terminalId===url.searchParams.get('terminal') && p.paneId===url.searchParams.get('pane') && (p.sessionId||'')===(url.searchParams.get('session')||''));
        if(!pane)throw new HttpError(409,'stale_target');
        res.writeHead(200,{'Content-Type':'text/event-stream','X-Accel-Buffering':'no','Connection':'keep-alive'});res.flushHeaders();
        let finished=false;let stop=()=>{};let heartbeat;const viewportId=geometry?randomUUID():null;
        const end=reason=>{if(finished)return;finished=true;viewports.delete(viewportId);clearInterval(heartbeat);if(!res.destroyed){res.write(`event: closed\ndata: ${JSON.stringify({reason})}\n\n`);res.end();}};
        stop=herdr.observe(pane,frame=>{if(finished)return;if(res.writableLength>2*1024*1024){end('slow_client_reconnect_required');stop();return;}res.write(`data: ${JSON.stringify(frame)}\n\n`);},end,geometry);
        if(geometry){viewports.set(viewportId,stop);res.write(`event: viewport\ndata: ${JSON.stringify({id:viewportId})}\n\n`);}
        heartbeat=setInterval(()=>{if(!finished)res.write(': heartbeat\n\n');},15000);
        res.on('close',()=>{finished=true;viewports.delete(viewportId);clearInterval(heartbeat);stop();});return;
      }
      if(req.method==='POST' && path==='/api/input'){
        if(req.headers['content-type']!=='application/json')throw new HttpError(415,'json_required');
        let body;try{body=JSON.parse((await readBody(req,100000)).toString('utf8'));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'invalid_json');}
        if(!body||typeof body.text!=='string'||!body.text.length||body.text.length>16000)throw new HttpError(400,'invalid_input');
        const controller=viewports.get(body.id);if(!controller)throw new HttpError(409,'viewport_closed');
        await controller.input(body.text);json(res,200,{status:'forwarded'});return;
      }
      if(req.method==='POST' && path==='/api/transcribe'){
        if(req.headers['x-audio-consent']!=='openai')throw new HttpError(400,'voice_consent_required');
        const bytes=await readBody(req,MAX_AUDIO);const controller=new AbortController();
        const cancel=()=>{if(!res.writableEnded)controller.abort();};res.once('close',cancel);
        try{const result=await transcription.transcribe(bytes,req.headers['content-type']||'',controller.signal);if(!res.destroyed)json(res,200,result);}
        finally{res.off('close',cancel);}return;
      }
      if(['GET','HEAD'].includes(req.method) && staticFiles.has(path)){
        const [file,type]=staticFiles.get(path);let contents;
        try{contents=await readFile(resolve(root,file));}catch{throw new HttpError(404,path.startsWith('/vendor/')?'terminal_renderer_not_installed':'not_found');}
        res.writeHead(200,{'Content-Type':type});res.end(req.method==='HEAD'?undefined:contents);return;
      }
      throw new HttpError(404,'not_found');
    }catch(error){
      if(res.destroyed)return;
      if(res.headersSent){res.end();return;}
      if(error instanceof HttpError)json(res,error.status,{error:error.code,message:error.message});
      else json(res,500,{error:'internal_error',message:'Unexpected companion error. No automatic action was retried.'});
    }
  });
  server.requestTimeout=75000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxConnections=32;
  server.on('close',()=>herdr?.close?.());
  return {server,epoch};
}
