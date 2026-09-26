import {createWorld,actions,resolveModules} from './packages/core/engine.mjs';
import {registry} from './packages/modules/index.mjs';
import {GameService} from './packages/ai/service.mjs';
import {SillyTavernProvider} from './adapter.mjs';
// Independent campaign saves; chat edits/regeneration do not mutate this campaign.
const key='story-framework-st-v1';
class BrowserStore {
 load(id){const s=JSON.parse(localStorage.getItem(key)||'null');if(!s||s.campaignId!==id)throw new Error('Campaign unavailable');return s;}
 insert(s){localStorage.setItem(key,JSON.stringify(s));}
 commit(s,revision){if(this.load(s.campaignId).revision!==revision)throw new Error('Campaign changed in another tab');this.insert(s);}
 narrative(id,turnId,text,trace){const s=this.load(id),t=s.turns[turnId];if(t.status!=='complete'){Object.assign(t,{narrative:text,status:'complete'},trace);this.insert(s);}return s;}
}
const packs={};for(const name of ['living-world','other-world','neutral','threshold']){const p=await fetch(new URL(`packs/${name}.json`,import.meta.url)).then(r=>r.json());packs[p.id]=p;}
const store=new BrowserStore(),service=new GameService(store,packs,registry,new SillyTavernProvider());
const button=document.createElement('button');button.textContent='Story Framework';button.style.cssText='position:fixed;right:16px;bottom:16px;z-index:20000;padding:10px';document.body.append(button);
const dialog=document.createElement('dialog');dialog.style.cssText='width:min(850px,90vw);max-height:85vh;overflow:auto;background:#172019;color:#edf0e8;border:1px solid #9aac91;padding:24px';document.body.append(dialog);
const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};let s=null,busy=false;
function render(message=''){dialog.replaceChildren();const close=add('button','Close');close.onclick=()=>dialog.close();dialog.append(close,add('h2','Story Framework'),add('p',message));
 for(const p of Object.values(packs)){const b=add('button','New: '+p.title);b.disabled=busy;b.onclick=()=>{if(s&&!confirm('Replace this extension campaign? Export it first if you want to keep it.'))return;s=createWorld(p,registry,crypto.randomUUID());store.insert(s);render();};dialog.append(b);}
 if(!s)return;const p=packs[s.packId];dialog.append(add('h3',p.locations.find(l=>l.id===s.actors[p.playerId].location).name+` · ${p.calendar} ${s.tick}`));
 for(const panel of resolveModules(p,registry).flatMap(m=>m.panel?[m.panel(s,p)]:[]))dialog.append(add('p',panel.title+': '+panel.lines.join(' / ')));
 for(const a of actions(s,p,registry)){const b=add('button',a.label);b.disabled=busy||!a.enabled;b.title=a.reason||'';b.onclick=()=>run({command:{type:a.type,args:a.args}});dialog.append(b);}
 const input=add('input','');input.placeholder='Say something or describe an action';input.style.width='75%';const send=add('button','Send');send.disabled=busy;send.onclick=()=>input.value.trim()&&run({input:input.value.trim()});dialog.append(add('hr',''),input,send);
 const exportButton=add('button','Export campaign');exportButton.onclick=()=>{const a=document.createElement('a');const u=URL.createObjectURL(new Blob([JSON.stringify({format:'story-framework',version:1,state:s})],{type:'application/json'}));a.href=u;a.download='campaign.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};dialog.append(exportButton);
 for(const t of Object.values(s.turns).slice(-6).reverse())dialog.append(add('p',t.narrative||'Pending…'));
}
async function run(request){if(busy)return;busy=true;render('Working…');try{const task=async()=>{s=store.load(s.campaignId);return service.act(s.campaignId,{...request,id:crypto.randomUUID(),expectedRevision:s.revision});};const r=navigator.locks?await navigator.locks.request(key,task):await task();s=r.state;busy=false;render(r.clarification||'');}catch(e){busy=false;render(e.message);}}
button.onclick=async()=>{try{const raw=localStorage.getItem(key);if(raw){s=JSON.parse(raw);s=await service.recover(s.campaignId);}render();dialog.showModal();}catch(e){render(e.message);dialog.showModal();}};
