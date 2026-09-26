import {parseAction} from '/vendor/venus/sceneActions.mjs';

const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};

// A draft-only composition preview. No campaign state or AI call is involved.
export function mountScenePreview(card,scene,pack){
 const root=el('div');root.className='scene-preview';
 const heading=el('div');heading.className='scene-preview-heading';heading.append(el('strong','Scene preview'),el('span','Draft composition · choices are illustrative'));
 const controls=el('div');controls.className='scene-preview-controls';
 const moment=el('select'),location=el('select');moment.setAttribute('aria-label','Preview moment');location.setAttribute('aria-label','Preview location');
 const add=(select,value,label)=>{const option=el('option',label);option.value=value;select.append(option);};
 add(moment,'opening','Opening');for(const [index] of (scene.pages||[]).entries())add(moment,`page:${index}`,`Opening · page ${index+1}`);
 for(const [index,beat] of (scene.beats||[]).entries()){add(moment,`beat:${index}`,`${beat.id||`Beat ${index+1}`} · opening`);for(const [pageIndex] of (beat.pages||[]).entries())add(moment,`beat:${index}:page:${pageIndex}`,`${beat.id||`Beat ${index+1}`} · page ${pageIndex+1}`);}
 for(const place of pack.locations)add(location,place.id,place.name);
 location.value=scene.when?.location||scene.trigger?.match?.to||scene.trigger?.match?.location||pack.locations[0]?.id||'';
 controls.append(moment,location);const stage=el('div');stage.className='scene-preview-stage';const background=el('img');background.className='scene-preview-background';background.alt='';const cast=el('div');cast.className='scene-preview-cast';const dialogue=el('div');dialogue.className='scene-preview-dialogue';const speaker=el('strong'),text=el('p');dialogue.append(speaker,text);stage.append(background,cast,dialogue);const choices=el('div');choices.className='scene-preview-choices';root.append(heading,controls,stage,choices);card.append(root);
 function update(){
  const parts=moment.value.split(':'),beat=parts[0]==='beat'?scene.beats?.[Number(parts[1])]:null,page=parts[0]==='page'?scene.pages?.[Number(parts[1])]:beat&&parts[2]==='page'?beat.pages?.[Number(parts[3])]:null;
  const place=pack.locations.find(x=>x.id===location.value)||pack.locations[0],segment=beat||scene;
  const earlier=page?beat?beat.pages.slice(0,Number(parts[3])+1):scene.pages.slice(0,Number(parts[1])+1):[];
  const bg=[...earlier].reverse().find(x=>x.background)?.background||segment.background||place?.background;
  background.hidden=!bg;if(bg)background.src=bg;
  stage.classList.toggle('no-art',!bg);
  const visible=new Set(Object.entries(scene.when?.charactersAt||{}).filter(([,at])=>at===place?.id).map(([id])=>id));
  const poses={};const instructions=[...(segment.stage||[]),...earlier.flatMap(x=>x.stage||[])];
  for(const raw of instructions){const action=parseAction(raw,(id,ref)=>Boolean(pack.actors.find(a=>a.id===id)?.poses?.some(p=>p.id===ref)));if(!action)continue;if(action.kind==='show')visible.add(action.charKey);if(action.kind==='hide')visible.delete(action.charKey);if(action.kind==='sprite'){visible.add(action.charKey);poses[action.charKey]=action.ref;}}
  if(page?.speaker)visible.add(page.speaker);
  const characters=[...visible].map(id=>pack.actors.find(a=>a.id===id)).filter(Boolean).slice(0,4);
  cast.replaceChildren(...characters.map(actor=>{const image=actor.poses?.find(p=>p.id===poses[actor.id])?.image||actor.portrait;const slot=el('div');slot.className='scene-preview-character';if(image){const img=el('img');img.src=image;img.alt=actor.name;slot.append(img);}else slot.append(el('span',actor.name));return slot;}));
  speaker.textContent=pack.actors.find(a=>a.id===page?.speaker)?.name||'Narration';text.textContent=page?.text||segment.opening||'Add narration to this scene.';
  choices.replaceChildren(...(segment.choices||[]).map(choice=>el('span',choice.label||'Untitled choice')));
 }
 moment.onchange=update;location.onchange=update;card.addEventListener('input',update);card.addEventListener('change',update);update();return root;
}
