import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root=new URL('../',import.meta.url),port=Number(process.env.VN_STUDIO_PORT)||4176;
export const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1'),p=url.pathname==='/'?'vn_game_ui_wizard.html':decodeURIComponent(url.pathname.slice(1));
    if(!(p==='vn_game_ui_wizard.html'||/^vn_ui_studio\/[a-z-]+\.(mjs|css|svg)$/.test(p))){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(new URL(p,root));res.writeHead(200,{'Content-Type':({html:'text/html; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'})[p.split('.').pop()],'Cache-Control':'no-store'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(port,'127.0.0.1',()=>console.log(`VN Studio: http://127.0.0.1:${port}`));
