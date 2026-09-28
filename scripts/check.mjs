import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
let count=0;
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','.git','artifacts'].includes(entry.name))continue;const path=resolve(dir,entry.name);if(entry.isDirectory())await check(path);else if(entry.name.endsWith('.mjs')){const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);count++;}}}
await check(root);console.log(`Syntax checked ${count} JavaScript modules.`);
const result=spawnSync(process.execPath,['--test'],{cwd:root,stdio:'inherit'});process.exit(result.status||0);
