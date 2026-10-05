import {validateSkinExport,resolveSkinLayout} from './vn-skin.mjs';
const check=(ok,message)=>{if(!ok)throw Error('gameProject.ui: '+message);};
function shape(raw,keys,path){check(raw&&typeof raw==='object'&&!Array.isArray(raw)&&(Object.getPrototypeOf(raw)===Object.prototype||Object.getPrototypeOf(raw)===null),path+' must be an object');check(Object.getOwnPropertySymbols(raw).length===0&&Object.keys(raw).every(k=>keys.includes(k)),path+' has unknown fields');}
export function defaultProjectUi(){return {version:1,selected:'default',options:[]};}
export function validateProjectUi(raw){
 if(raw===undefined)return undefined;
 shape(raw,['version','selected','options','screen'],'metadata');check(!Object.hasOwn(raw,'screen')||['classic','wizard'].includes(raw.screen),'screen must be classic or wizard');check(Object.hasOwn(raw,'version')&&raw.version===1,'unsupported metadata version');check(Object.hasOwn(raw,'selected')&&typeof raw.selected==='string','selected option required');check(Object.hasOwn(raw,'options')&&Array.isArray(raw.options),'options must be an array');
 const ids=new Set(['legacy','default']);
 for(const [i,option] of raw.options.entries()){
  const at='options['+i+']';shape(option,['id','label','skin'],at);check(Object.hasOwn(option,'id')&&typeof option.id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(option.id)&&!['__proto__','constructor','prototype'].includes(option.id)&&!ids.has(option.id),at+' has invalid, duplicate or reserved ID');ids.add(option.id);
  check(Object.hasOwn(option,'label')&&typeof option.label==='string'&&option.label.trim()&&option.label.length<=64&&!/[<>\x00-\x1f]/.test(option.label),at+' label must be plain text, 1-64 characters');check(Object.hasOwn(option,'skin'),at+' skin required');const skin=option.skin;shape(skin,['version','mode','export'],at+'.skin');check(Object.hasOwn(skin,'version')&&skin.version===1,at+' unsupported skin selection version');check(Object.hasOwn(skin,'mode')&&['legacy','wizard'].includes(skin.mode),at+' unsupported skin mode');
  if(skin.mode==='legacy')check(!Object.hasOwn(skin,'export'),at+' legacy skin cannot contain an export');
  else {check(Object.hasOwn(skin,'export')&&skin.export&&typeof skin.export==='object'&&!Array.isArray(skin.export),at+' requires an inline export');const result=validateSkinExport(skin.export);check(result.ok,at+' invalid export: '+result.error);}
 }
 check(ids.has(raw.selected),'selected option is missing');
 if(raw.screen==='wizard'){check(raw.selected!=='legacy','a Wizard screen needs a Wizard layout, not the legacy interface');const option=raw.options.find(x=>x.id===raw.selected);if(option){const gaps=screenGaps(validateSkinExport(option.skin.export).skin);check(!gaps.length,'Wizard screen is missing required controls: '+gaps.join(', '));}}
 return structuredClone(raw);
}
export function selectProjectSkin(raw){const ui=validateProjectUi(raw);return !ui||ui.selected==='legacy'?{version:1,mode:'legacy'}:ui.selected==='default'?{version:1,mode:'wizard',source:'/ui/default-layout.json'}:ui.options.find(x=>x.id===ui.selected).skin;}
// A complete Wizard screen replaces the classic chrome, so every device must place the controls play depends on: dialogue, choices/input and the menu (save/load/quit).
export const screenControls={dialogue:'Dialogue',choices:'Choices and input',tool_settings:'Settings (menu) button'};
const devices={desktop:[1440,810],tablet:[1024,768],phone:[390,693]};
export function screenGaps(skin){const gaps=[];for(const [device,[width,height]] of Object.entries(devices)){const l=resolveSkinLayout(skin,{width,height,device});if(!l.ok){gaps.push(device+': '+l.error);continue;}for(const [id,label] of Object.entries(screenControls))if(!l.widgets[id])gaps.push(device+' '+label);}return gaps;}
export function screenMode(raw){const ui=validateProjectUi(raw);return ui?.screen==='wizard'&&ui.selected!=='legacy'?'wizard':'classic';}
