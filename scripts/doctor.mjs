import {existsSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import net from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const MIN_MAJOR=24,DL='https://nodejs.org/en/download',LABEL={ok:'ok  ',warn:'warn',fail:'FAIL'};
const major=v=>{const m=/^v?(\d+)\./.exec(String(v||''));return m?Number(m[1]):0};
const listenFree=port=>new Promise(done=>{const s=net.createServer();s.once('error',e=>done(e.code==='EADDRINUSE'?'busy':e.code||e.message));s.listen(port,'127.0.0.1',()=>s.close(()=>done('free')))});
const probeWrite=dir=>{mkdirSync(dir,{recursive:true});const probe=resolve(dir,'.doctor-write-probe');try{writeFileSync(probe,'ok');rmSync(probe);}catch(e){try{rmSync(probe,{force:true});}catch{}throw e}};

export async function doctor({root=fileURLToPath(new URL('../',import.meta.url)),nodeVersion=process.versions.node,dataDir=resolve(fileURLToPath(new URL('../',import.meta.url)),'data'),port=Number(process.env.PORT||4317),log=console.log,checkPort=listenFree,checkData=probeWrite}={}){
  const lines=['Story Framework install check'],checks=[];
  const add=(status,label,fix='')=>{checks.push({status,label,fix});lines.push(`  ${LABEL[status]}  ${label}`);if(status!=='ok'&&fix)for(const l of fix.split('\n'))lines.push(`        ${l}`)};

  const v=major(nodeVersion);
  add(v>=MIN_MAJOR?'ok':'fail',`Node.js ${nodeVersion} (need ${MIN_MAJOR} or later)`,v>=MIN_MAJOR?'':`This copy of Node.js is too old.
Download Node.js ${MIN_MAJOR} or later from ${DL}
Install it, then run this check again.`);
  const modules=existsSync(resolve(root,'node_modules')),electron=existsSync(resolve(root,'node_modules/electron/cli.js'));
  add(modules&&electron?'ok':'warn',electron?'Dependencies installed':modules?'Electron not downloaded yet':'Dependencies not installed',electron?'':`Run this in the game folder:  npm install
The browser game works without it; Start-Desktop-Windows.cmd downloads Electron on its first run.`);
  let why='';try{checkData(dataDir);}catch(e){why=e.code||e.message}
  add(why?'fail':'ok',why?`Data folder is not writable (${why})`:`Data folder ready: ${dataDir}`,why?`The game has to save into ${dataDir}.
Move the whole game folder to a writable place, such as your Documents folder, and run this again.`:'');
  lines.push(`  note  AI settings: ${existsSync(resolve(dataDir,'ai-settings.json'))?'already saved (left untouched)':'not set yet - the first-run setup will ask'}`);
  const state=await checkPort(port);
  add(state==='free'?'ok':'fail',state==='free'?`Port ${port} is free`:`Port ${port} is not available (${state})`,state==='free'?'':`Another program is using port ${port}.
Close the other Story Framework window, or the program holding the port, then run this check again.`);

  const failed=checks.filter(c=>c.status==='fail').length;
  log(lines.join('\n'));
  log(failed?`\n${failed} problem(s) found. Fix the FAIL lines above, then run this check again.`:`\nAll checks passed. Double-click Start-Windows.cmd to play in your browser.`);
  return {ok:!failed,checks};
}
if(process.argv[1]===fileURLToPath(import.meta.url))doctor().then(({ok})=>{process.exitCode=ok?0:1});
