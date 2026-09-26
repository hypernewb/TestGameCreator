import {app,BrowserWindow,shell} from 'electron';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import net from 'node:net';

const root=fileURLToPath(new URL('../',import.meta.url));
let serverProcess,window;
async function freePort(){
 const socket=net.createServer();await new Promise((ok,fail)=>socket.once('error',fail).listen(0,'127.0.0.1',ok));
 const port=socket.address().port;await new Promise(ok=>socket.close(ok));return port;
}
async function readyAt(url,process){
 for(let n=0;n<100;n++){
  if(process.exitCode!==null)throw Error('The game server exited before Electron could connect. Install Node.js 24 or later and run npm install.');
  try{const response=await fetch(`${url}/api/bootstrap`,{signal:AbortSignal.timeout(1000)});if(response.ok)return;}catch{}
  await new Promise(ok=>setTimeout(ok,100));
 }
 throw Error('The game server did not start. Check that Node.js 24 or later is installed.');
}
app.whenReady().then(async()=>{
 try{
  const port=await freePort(),url=`http://127.0.0.1:${port}`;
  serverProcess=spawn(process.platform==='win32'?'node.exe':'node',[resolve(root,'server.mjs')],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
  serverProcess.stderr.on('data',chunk=>console.error(String(chunk)));
  serverProcess.stdout.on('data',chunk=>console.log(String(chunk)));
  await readyAt(url,serverProcess);
  window=new BrowserWindow({width:1440,height:900,minWidth:900,minHeight:620,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.webContents.setWindowOpenHandler(({url:target})=>{if(target.startsWith('https://'))shell.openExternal(target);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,target)=>{if(!target.startsWith(url+'/'))event.preventDefault();});
  await window.loadURL(url);
 }catch(error){console.error(error);app.quit();}
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(serverProcess&&!serverProcess.killed)serverProcess.kill();});
