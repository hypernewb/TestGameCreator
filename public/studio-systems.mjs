import {systemSpecs,systemTarget,systemFingerprint,initialSystemValue,editSystem,SYSTEM_CHECKPOINTS} from './creator-systems-contract.mjs';
const sessions=new Map(),generations=new Map(),expansions=new Map(),session=id=>{if(!sessions.has(id))sessions.set(id,new Map());return sessions.get(id);};
export const systemBufferSignature=id=>JSON.stringify([...session(id)]);
export const captureSystemBuffers=id=>structuredClone([...session(id)]);
export function restoreSystemBuffers(id,entries=[]){if(!Array.isArray(entries)||entries.some(x=>!Array.isArray(x)||x.length!==2||typeof x[0]!=='string'||!x[1]||typeof x[1]!=='object'))throw Error('Invalid system recovery buffers.');sessions.set(id,new Map(structuredClone(entries)));for(const key of generations.keys())if(key.startsWith(id+'/'))generations.delete(key);}
export function assertSystemsReady(id){if(session(id).size)throw Error('Apply or cancel the pending system forms before Check, Save, Play, export or replacing the project.');}
const blank=f=>f.type==='object'?Object.fromEntries(Object.entries(f.fields).filter(([,x])=>x.required).map(([k,x])=>[k,blank(x)])):f.type==='array'?Array.from({length:f.min},()=>blank(f.item)):f.type==='map'?{}:f.type==='generation'?false:f.type==='boolean'?false:'';
export function mountSystems(parent,{getPack,getId,getOwner=getPack,onChange,onStatus,onEnable,skipKeys=[],validate=async()=>{},document:doc=globalThis.document,specs=systemSpecs,targetOf=systemTarget,initial=initialSystemValue,edit=editSystem,scope='systems'}){
 const p=getPack(),sid=getId(),owner=getOwner(),pending=session(sid),generation=Symbol(),mount=sid+'/'+scope;generations.set(mount,generation);if(!expansions.has(sid))expansions.set(sid,new Set());const expanded=expansions.get(sid);
 const active=()=>getId()===sid&&getOwner()===owner&&generations.get(mount)===generation,make=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;},button=(box,label,fn)=>{const b=make('button',label);b.type='button';b.onclick=fn;box.append(b);return b;},retired=()=>onStatus('This system form is no longer active. Reopen the current control.');
 for(const [key,s] of Object.entries(specs(p))){
  if(skipKeys.includes(key))continue;
  const section=make('details');section.className='studio-section';section.dataset.system=key;section.open=expanded.has(key);section.ontoggle=()=>{if(active()){if(section.open)expanded.add(key);else expanded.delete(key);}};section.append(make('summary',s.label));parent.append(section);section.append(make('p',s.help||'Edit the rules, then Apply. Existing extension fields are retained.'));
  if(s.module)section.append(make('p',p.modules?.[s.module]?'Enabled':'Disabled — settings are retained until this module is enabled.'));
  if(onEnable&&s.module)button(section,(p.modules?.[s.module]?'Disable ':'Enable ')+s.label,()=>{if(!active())return retired();try{assertSystemsReady(sid);onEnable(s.module,!getPack().modules?.[s.module]);}catch(e){onStatus(e.message);}});
  function form(index){
   const target={key,index},token=key+'/'+(s.singleton?'settings':index===null?'new':index),old=targetOf(p,target),cached=pending.get(token);let values=cached?.value??structuredClone(s.singleton?old||initial(p,key):index===null?initial(p,key):old),keys=cached?.keys||{},base=cached?.base??systemFingerprint(old),live=true,fieldGeneration=0,busy=false;
   const card=make('article');card.className='studio-card';card.dataset.systemForm=token;card.append(make('h3',s.singleton?s.label:index===null?'New '+s.label:(old.name||old.title||old.id||old.character||s.label)+' · '+(index+1)));section.append(card);const fields=make('div');card.append(fields);const error=make('p',cached?.error||'');error.setAttribute('role','status');card.append(error);
   const ready=()=>live&&active(),changed=()=>{pending.set(token,{value:structuredClone(values),keys:{...keys},base,error:''});error.textContent='';onStatus('Pending system changes. Apply or cancel before continuing.');},write=(row,k,x)=>{if(x===undefined)delete row[k];else row[k]=x;changed();},dropKeys=path=>{for(const k of Object.keys(keys))if(k===path||k.startsWith(path+'.'))delete keys[k];};
   function draw(){
    fieldGeneration++;const version=fieldGeneration;fields.replaceChildren();const schema=specs(getPack(),values,key)[key],isLive=()=>ready()&&version===fieldGeneration;
    function field(box,row,k,f,path){
     const x=row[k],wrap=make('div');wrap.dataset.systemPath=path;wrap.className=['object','array','map'].includes(f.type)?'studio-card':'studio-field';box.append(wrap);
     if(f.type==='pool'){
      const mode=make('select');for(const [v,name] of [['','All NPCs (engine default)'],['cast','All NPCs'],['dating','Dating profiles'],['custom','Selected NPCs']]){const o=make('option',name);o.value=v;mode.append(o);}mode.value=x===undefined?'':Array.isArray(x)?'custom':x;mode.dataset.systemField=path+'.$pool';mode.oninput=mode.onchange=()=>{if(!isLive())return;write(row,k,mode.value==='custom'?[]:mode.value||undefined);draw();};wrap.append(make('strong',f.label),mode);if(Array.isArray(x))field(wrap,row,k,{...f,type:'array'},path);return;
     }
     if(['object','array','map'].includes(f.type)){
      wrap.append(make('strong',f.label));
      if(x===undefined){button(wrap,'Add '+f.label,()=>{if(!isLive())return;write(row,k,blank(f));draw();});return;}
      if(f.type==='object'){
       for(const [name,sub] of Object.entries(f.fields))field(wrap,x,name,sub,path+'.'+name);
       const unknown=Object.keys(x).filter(name=>!Object.hasOwn(f.fields,name));if(unknown.length)wrap.append(make('small','Additional fields retained: '+unknown.join(', ')));
      }else if(f.type==='array'){
       const entries=Array.isArray(x)?x:[x];if(!Array.isArray(x))wrap.append(make('small','Single location retained; adding a row converts it to a location list.'));
       entries.forEach((v,i)=>{const sub=make('div');wrap.append(sub);const adapter={};Object.defineProperty(adapter,i,{enumerable:true,configurable:true,get:()=>Array.isArray(row[k])?row[k][i]:row[k],set:y=>{if(!isLive())return;if(Array.isArray(row[k]))row[k][i]=y;else row[k]=y;}});field(sub,adapter,i,f.item,path+'.'+i);
        if(!f.item.readonly)button(sub,'Remove '+f.label+' row '+(i+1),()=>{if(!isLive())return;const a=Array.isArray(row[k])?row[k]:[row[k]];a.splice(i,1);const rest={};for(const [name,value] of Object.entries(keys)){if(!name.startsWith(path+'.')){rest[name]=value;continue;}const suffix=name.slice(path.length+1),n=Number(suffix.split('.')[0]);if(n<i)rest[name]=value;else if(n>i)rest[path+'.'+(n-1)+suffix.slice(String(n).length)]=value;}keys=rest;write(row,k,a);draw();});
       });
       if(entries.length<f.max&&!f.item.fields?.id?.readonly)button(wrap,'Add '+f.label+' row',()=>{if(!isLive())return;write(row,k,[...entries,blank(f.item)]);draw();});
      }else{
       for(const name of Object.keys(x)){const sub=make('div');wrap.append(sub);field(sub,x,name,{...f.item,label:name},path+'.'+name);button(sub,'Remove '+f.label+' '+name,()=>{if(!isLive())return;delete x[name];dropKeys(path+'.'+name);changed();draw();});}
       const label=make('label');label.className='studio-field';label.append(make('span','New '+f.label+' key'));const input=make(f.keys?'select':'input');input.dataset.systemField=path+'.$key';if(f.keys){const option=make('option','Choose…');option.value='';input.append(option);for(const [id,name] of f.keys){const option=make('option',name);option.value=id;input.append(option);}}input.value=keys[path]||'';input.oninput=input.onchange=()=>{if(!isLive())return;if(input.value)keys[path]=input.value;else delete keys[path];changed();};label.append(input);wrap.append(label);button(wrap,'Add '+f.label+' entry',()=>{if(!isLive())return;const name=input.value;if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(name)||['__proto__','constructor','prototype'].includes(name)||Object.hasOwn(x,name)){keys[path]=name;changed();error.textContent='Choose a unique safe key.';return;}x[name]=blank(f.item);delete keys[path];changed();draw();});
      }
      if(!f.required)button(wrap,'Omit '+f.label,()=>{if(!isLive())return;dropKeys(path);write(row,k,undefined);draw();});return;
     }
     const label=make('label');label.append(make('span',f.label+(f.required?' *':'')));wrap.append(label);let input;
     if(f.type==='generation'){
      input=make('select');for(const [v,label] of [['','Engine default (all kinds)'],['all','All kinds'],['none','None'],['custom','Selected kinds']]){const o=make('option',label);o.value=v;input.append(o);}input.value=x===undefined?'':x===true?'all':x===false?'none':'custom';input.oninput=()=>{if(!isLive())return;write(row,k,input.value===''?undefined:input.value==='all'?true:input.value==='none'?false:[]);draw();};label.append(input);
      if(Array.isArray(x))for(const kind of ['find','encounter','scene']){const check=make('input');check.type='checkbox';check.checked=x.includes(kind);check.dataset.systemField=path+'.'+kind;check.oninput=()=>{if(!isLive())return;write(row,k,check.checked?[...new Set([...row[k],kind])]:row[k].filter(y=>y!==kind));};check.onchange=check.oninput;const l=make('label');l.append(check,make('span',kind));wrap.append(l);}
     }else if(f.type==='primitive'){
      if(x!==null&&typeof x==='object'||x===null&&!f.nullable){wrap.append(make('small','Existing structured match retained. Remove its entry to replace it with a scalar.'));return;}
      const type=make('select');for(const t of ['string','number','boolean',...(f.nullable?['null']:[])]){const o=make('option',t==='string'?'Text':t==='number'?'Number':t==='null'?'Empty value':'Yes/no');o.value=t;type.append(o);}type.value=x===null?'null':typeof x==='number'?'number':typeof x==='boolean'?'boolean':'string';type.dataset.systemField=path+'.$type';type.oninput=()=>{if(!isLive())return;write(row,k,type.value==='null'?null:type.value==='number'?0:type.value==='boolean'?false:'');draw();};type.onchange=type.oninput;label.append(type);if(type.value!=='null')field(wrap,row,k,{type:type.value==='string'?'text':type.value,label:'Expected value',max:2000,min:-Number.MAX_SAFE_INTEGER,maxValue:Number.MAX_SAFE_INTEGER,integer:false,required:true,primitive:true},path);return;
     }else{
      input=make(f.type==='choice'||f.type==='boolean'?'select':f.type==='text'&&f.max>300?'textarea':'input');
      if(f.type==='choice'||f.type==='boolean'){for(const [id,name] of [['',f.required?'Choose…':'Omit (engine default)'],...(f.type==='boolean'?[['true','Yes'],['false','No']]:f.values)]){const o=make('option',name);o.value=id;input.append(o);}if(x!==undefined&&x!==''&&f.type==='choice'&&!f.values.some(([id])=>id===x)){const o=make('option','Current: '+x);o.value=x;input.append(o);}}
      if(f.type==='number'){input.type='number';input.step=f.integer===false?'any':'1';input.min=f.min;input.max=f.maxValue??f.max;}
      input.value=x===undefined||typeof x==='number'&&!Number.isFinite(x)?'':String(x);input.readOnly=Boolean(f.readonly);input.oninput=()=>{if(!isLive()||f.readonly)return;const str=input.value,v=str===''&&!f.required?undefined:f.type==='number'?(str.trim()===''?(f.primitive?NaN:''):Number(str)):f.type==='boolean'?(str==='true'?true:str==='false'?false:undefined):f.type==='choice'?f.values.find(([id])=>String(id)===str)?.[0]??str:str;write(row,k,v);};
     }
     input.dataset.systemField=path;input.onchange=()=>{input.oninput();if(isLive()&&['choice','boolean'].includes(f.type))draw();};if(input.parentNode!==label)label.append(input);
    }
    for(const [name,f] of Object.entries(schema.fields))field(fields,values,name,f,name);
    if(key==='firsts')button(fields,'Use checkpoints for selected experience',()=>{if(!isLive())return;const ids=SYSTEM_CHECKPOINTS[values.rung];if(!ids){error.textContent='Choose an experience first.';return;}const old=values.checkpoints||[];values.checkpoints=ids.map(id=>({...old.find(c=>c.id===id),id,cue:old.find(c=>c.id===id)?.cue||''}));changed();draw();});
    const unknown=Object.keys(values).filter(name=>!Object.hasOwn(schema.fields,name));if(unknown.length)fields.append(make('small','Additional fields retained: '+unknown.join(', ')));
   }
   draw();button(card,'Refresh field references',()=>{if(ready())draw();});
   button(card,'Apply '+s.label,async()=>{if(!ready())return retired();if(busy)return;busy=true;try{if(Object.keys(keys).length)throw Error('Add or clear the pending map keys before Apply.');const signature=systemFingerprint([values,keys]),bytes=systemFingerprint(getPack()),next=edit(getPack(),{target,expectedBase:base,value:values});await validate(next);if(!ready())return retired();if(signature!==systemFingerprint([values,keys])||bytes!==systemFingerprint(getPack()))throw Error('Project or form changed during validation. Newer edits are retained; Apply again.');pending.delete(token);live=false;onChange(next);onStatus('System changes applied. Save the draft.');}catch(e){if(ready()){pending.set(token,{value:structuredClone(values),keys:{...keys},base,error:e.message});error.textContent=e.message;}onStatus(e.message);}finally{busy=false;}});
   button(card,'Cancel '+s.label,()=>{if(!ready())return retired();pending.delete(token);live=false;onChange(getPack());onStatus('System form cancelled.');});
   if(s.removable!==false&&(s.singleton?old!==undefined:index!==null))button(card,'Remove '+s.label,async()=>{if(!ready())return retired();try{assertSystemsReady(sid);const bytes=systemFingerprint(getPack()),next=edit(getPack(),{target,expectedBase:base,remove:true});await validate(next);if(!ready())return retired();assertSystemsReady(sid);if(bytes!==systemFingerprint(getPack()))throw Error('Project changed during validation. Remove again.');live=false;onChange(next);onStatus('System removed. Save the draft.');}catch(e){if(ready())error.textContent=e.message;onStatus(e.message);}});
  }
  if(s.singleton)form(null);else{for(const [i] of (p[key]||[]).entries())form(i);form(null);}
 }
 return {pending:()=>pending.size};
}
