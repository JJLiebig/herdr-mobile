import { readConfig } from './security.mjs';
import { createApp } from './app.mjs';
import { listeningAddresses } from './listening.mjs';
try {
  const cfg=readConfig();const {server}=await createApp(cfg);
  server.listen(cfg.port,cfg.bind,()=>{
    console.log(`Herdr Mobile\nListening on port ${cfg.port}:\n  ${listeningAddresses(cfg.bind).join('\n  ')}\nOpen:\n  ${[cfg.origin,...cfg.extraOrigins].join('\n  ')}${cfg.mode==='demo'?'\nDemo preview':''}`);
  });
  server.on('error',()=>{console.error('Could not start companion. Check the configured port.');process.exitCode=1;});
  let shuttingDown=false;
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{
    if(shuttingDown)return;shuttingDown=true;
    server.closeAllConnections();server.close(()=>process.exit(0));
  });
} catch(error){console.error(error.message);process.exitCode=1;}
