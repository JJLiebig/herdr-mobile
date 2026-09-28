import { readConfig } from './security.mjs';
import { createApp } from './app.mjs';
try {
  const cfg=readConfig();const {server}=await createApp(cfg);
  server.listen(cfg.port,'127.0.0.1',()=>{
    console.log(`Herdr Mobile draft · ${cfg.mode}\nOpen ${cfg.origin}\nLive control is not implemented. ${cfg.apiKey?'Voice uses the configured OpenAI API key.':'Voice provider not configured; keyboard dictation still works.'}`);
  });
  server.on('error',()=>{console.error('Could not start companion. Check the configured port.');process.exitCode=1;});
  let shuttingDown=false;
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{
    if(shuttingDown)return;shuttingDown=true;
    server.closeAllConnections();server.close(()=>process.exit(0));
  });
} catch(error){console.error(error.message);process.exitCode=1;}
