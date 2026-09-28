const $=selector=>document.querySelector(selector);
const lines=[
  ['You','Morning light spills across the floorboards. The room is quiet, but the first day waiting beyond that door feels anything but ordinary.','INNER VOICE'],
  ['Narration','A distant door closes somewhere down the hall. Pipes murmur inside the walls of the old residence.','SCENE'],
  ['Mina',"You're awake. Good. I was starting to think I'd have to attend orientation alone.",'SPEAKING'],
  ['You','Orientation starts soon. I should decide what I need before I leave.','INNER VOICE']
];
const fontStacks={
  source:"'VN Source Sans 3','Segoe UI',sans-serif",
  noto:"'VN Noto Sans','Arial',sans-serif",
  open:"'VN Open Sans','Tahoma',sans-serif",
  lato:"'VN Lato','Trebuchet MS',sans-serif",
  custom:"'Player Uploaded Font','Segoe UI',sans-serif"
};
let cursor=0,customFontReady=false;
const dialogue=$('.dialogue'),choices=$('.choices'),composer=$('#prompt-composer'),fontChoice=$('#font-choice');

function showLine([speaker,text,kind]){
  $('#speaker').textContent=speaker;
  $('#speaker-kind').textContent=kind;
  $('#line').textContent=text;
  const character=$('[data-character=mina]');
  character.dataset.speaking=String(speaker==='Mina');
  dialogue.animate([{opacity:.55,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});
}
function showLoading(title='Writing the next moment…',detail='The story is responding to your action.'){
  const state=$('#scene-status');state.hidden=false;state.classList.remove('error');
  $('#state-title').textContent=title;$('#state-detail').textContent=detail;state.querySelector('button').hidden=true;
}
function showError(){
  const state=$('#scene-status');state.hidden=false;state.classList.add('error');
  $('#state-title').textContent='The response was interrupted';$('#state-detail').textContent='Your action is safe. Try generating this moment again.';state.querySelector('button').hidden=false;
}
function clearState(){$('#scene-status').hidden=true;$('#scene-status').classList.remove('error');}
function next(){
  if(cursor<lines.length-1){cursor++;showLine(lines[cursor]);return;}
  dialogue.hidden=true;composer.hidden=true;choices.hidden=false;
}
function applyFont(key){
  document.documentElement.style.setProperty('--chosen-font',fontStacks[key]||fontStacks.source);
  fontChoice.value=key;
  localStorage.setItem('showcase-font',key);
}
async function loadCustomFont(dataUrl,name='Uploaded font',persist=false){
  const face=new FontFace('Player Uploaded Font',`url(${dataUrl})`);
  await face.load();document.fonts.add(face);customFontReady=true;
  const option=fontChoice.querySelector('[value=custom]');option.disabled=false;option.textContent=name;
  applyFont('custom');
  if(persist){
    try{localStorage.setItem('showcase-custom-font',dataUrl);localStorage.setItem('showcase-custom-font-name',name);$('#font-status').textContent=`${name} is active and saved locally.`;}
    catch{$('#font-status').textContent=`${name} is active for this session; the file was too large to save locally.`;}
  }
}

fontChoice.onchange=()=>{if(fontChoice.value!=='custom'||customFontReady)applyFont(fontChoice.value);};
$('#font-file').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>2_500_000)throw Error('Choose a font smaller than 2.5 MB so it can be saved locally.');
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
    await loadCustomFont(dataUrl,file.name,true);
  }catch(error){$('#font-status').textContent=`Could not load that font: ${error.message}`;}
};

document.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='continue')next();
  if(action==='menu')$('#game-menu').showModal();
  if(action==='history')$('#history').showModal();
  if(action==='preferences'){$('#game-menu').close();$('#preferences').showModal();}
  if(action==='retry'){
    showLoading('Trying that moment again…','Your saved action has not changed.');
    setTimeout(()=>{clearState();showLine(['Mina','There you are. For a second, it felt like the whole morning had frozen.','SPEAKING']);},800);
  }
  if(action==='auto')event.target.closest('button').classList.toggle('active');
  if(event.target.closest('.choices button')){choices.hidden=true;dialogue.hidden=false;composer.hidden=false;showLine(['Narration','You gather yourself as the morning carries on. The hall outside is beginning to stir.','SCENE']);}
});
composer.onsubmit=async event=>{
  event.preventDefault();const input=$('#player-prompt'),text=input.value.trim();if(!text)return;
  choices.hidden=true;dialogue.hidden=false;showLine(['You',text,'PLAYER ACTION']);input.value='';input.disabled=true;
  showLoading();
  await new Promise(resolve=>setTimeout(resolve,850));
  clearState();input.disabled=false;showLine(['Mina','Give me one minute, then we can head out together. I left the orientation map beside your monitor.','SPEAKING']);input.focus();
};
document.addEventListener('click',event=>{
  const preview=event.target.closest('[data-preview]')?.dataset.preview;if(!preview)return;
  $('#preferences').close();clearState();dialogue.hidden=false;composer.hidden=false;choices.hidden=true;
  if(preview==='loading')showLoading();
  if(preview==='error')showError();
  if(preview==='long')showLine(['Mina','Before we go, there is one thing you should know about today. Orientation begins in the old assembly hall, but the east corridor is closed for repairs, so everyone has to cross the courtyard and enter through the library arcade. I wrote the room number on the map beside your monitor in case we get separated along the way.','SPEAKING']);
  if(preview==='normal')showLine(lines[0]);
});
document.addEventListener('keydown',event=>{if(event.key===' '&&!event.target.matches('input,textarea,select')&&!document.querySelector('dialog[open]')){event.preventDefault();next();}});

const savedCustom=localStorage.getItem('showcase-custom-font');
if(savedCustom)loadCustomFont(savedCustom,localStorage.getItem('showcase-custom-font-name')||'Uploaded font').catch(()=>applyFont('source'));
else applyFont(localStorage.getItem('showcase-font')||'source');
