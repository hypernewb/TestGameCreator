// GC1.3 live evidence: typed speech through the real service against LM Studio (not mock providers).
// Usage: node artifacts/gc1-3-live/run.mjs   (writes results.json next to this file; uses :memory: storage)
import {readFileSync,writeFileSync} from 'node:fs';
import {createWorld} from '../../packages/core/engine.mjs';
import {registry} from '../../packages/modules/index.mjs';
import {Store} from '../../packages/persistence/store.mjs';
import {GameService} from '../../packages/ai/service.mjs';
import {CompatibleProvider} from '../../packages/ai/providers.mjs';
import {playerLines} from '../../public/turn-presentation.mjs';

const p=JSON.parse(readFileSync(new URL('../../packs/neutral.json',import.meta.url)));delete p.modules['world.schedule'];
const store=new Store();store.insert(createWorld(p,registry,'live',42));
const provider=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'qwen/qwen3.8-27b',timeout:180000,maxTokens:1200});
const service=new GameService(store,{[p.id]:p},registry,provider);
const inputs=[
 'I say "Don\'t go yet, Ada — are you okay? 🙂"',
 'I tell her quietly: "I missed you, you know."',
 'I ask, "Do you want to get coffee after class?"',
];
const rows=[];let rev=0;
for(const [i,input] of inputs.entries()){
 const id=`live-${i+1}`,t0=Date.now();
 const before=store.load('live').revision;
 const r=await service.act('live',{id,expectedRevision:before,input,command:{type:'core.scene',args:{text:input,location:'hub',characters:['ada'],activity:'talk'}}});
 const t=r.state.turns[id];
 const typedLine=t.sceneLines?.find(l=>l.type==='playerSpeech');
 const lines=playerLines({state:r.state,pack:p});
 const idx=lines.findIndex(l=>l.type==='playerSpeech');
 rows.push({turn:id,input,ms:Date.now()-t0,fallback:t.fallback,failureReason:t.failureReason??null,failureCode:t.failureDiagnostic?.code??null,
  typedLineText:typedLine?.text??null,typedLineExact:typedLine?.text===input.match(/"(.*)"/)?.[1]||null,
  typedLineSpeaker:typedLine?.speaker??null,playerPageIndex:idx,
  npcLines:(t.sceneLines||[]).filter(l=>l.type!=='playerSpeech').map(l=>l.text).slice(0,4)});
}
const out={model:'qwen/qwen3.8-27b',endpoint:'localhost:1234',date:new Date().toISOString().slice(0,10),requests:provider.requests,rows};
writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({turn:r.turn,fallback:r.fallback,code:r.failureCode,exact:r.typedLineExact,speaker:r.typedLineSpeaker,idx:r.playerPageIndex,ms:r.ms})),null,1));
store.close();
