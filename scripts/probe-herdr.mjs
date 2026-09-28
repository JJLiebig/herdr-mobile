import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
const run=promisify(execFile);const binary=process.env.HERDR_BIN_PATH;
if(!binary||!isAbsolute(binary)){console.error('Set HERDR_BIN_PATH to the absolute path of the exact Windows executable.');process.exit(1);}
if(process.platform!=='win32'){console.error('This evidence gate must run on native Windows, not WSL or Linux.');process.exit(1);}
await stat(binary);
const directory=resolve('artifacts','windows-probe');await mkdir(directory,{recursive:true});
const evidence={createdAt:new Date().toISOString(),platform:process.platform,executable:binary,steps:[],note:'Read-only discovery only. Control, identity races and Android behavior still require manual validation.'};
for(const [name,args] of [['version',['--version']],['schema',['api','schema','--json']],['snapshot',['api','snapshot']],['observer-help',['terminal','session','observe','--help']],['controller-help',['terminal','session','control','--help']]]){
 try{const {stdout}=await run(binary,args,{windowsHide:true,shell:false,timeout:15000,maxBuffer:8*1024*1024,encoding:'utf8'});await writeFile(resolve(directory,`${name}.txt`),stdout);evidence.steps.push({name,status:'passed',sha256:createHash('sha256').update(stdout).digest('hex')});}
 catch(error){evidence.steps.push({name,status:'failed',code:error.code||'unknown'});}
}
await writeFile(resolve(directory,'evidence.json'),JSON.stringify(evidence,null,2));
console.log('Saved local-only evidence under artifacts/windows-probe. Review it before sharing; snapshots can contain sensitive paths and metadata.');
if(evidence.steps.some(s=>s.status==='failed'))process.exitCode=1;
