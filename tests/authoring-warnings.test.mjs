import test from 'node:test';
import assert from 'node:assert/strict';
import {blockedControls,blockedMessage,parseColor,contrast,textContrast,readabilityIssues,readabilityMessage,interactiveIds} from '../vn_ui_studio/authoring-warnings.mjs';

const box=(id,x,y,w,h,z=1,order=0)=>({id,x,y,w,h,z,order});
const fill=(n,rgba)=>Uint8ClampedArray.from({length:n*4},(_,i)=>rgba[i%4]);

test('a control painted over by another widget is unusable, not merely overlapping', () => {
  const issues=blockedControls([box('choices',0,0,100,100,1,0),box('panel',0,0,100,60,2,1)]);
  assert.equal(issues.length,1);assert.equal(issues[0].id,'choices');assert.deepEqual(issues[0].by,['panel']);assert.equal(issues[0].unusable,true);assert.equal(issues[0].steals,false);
  assert.match(blockedMessage(issues[0],{choices:'Choices',panel:'Panel'}),/Choices is unusable: Panel is drawn over 58% of it/);
});

test('the control on top is fine; the one underneath is blocked and loses clicks', () => {
  const issues=blockedControls([box('map',0,0,40,40,1,0),box('shop',30,30,40,40,1,1)]);
  assert.deepEqual(issues.map(i=>[i.id,i.unusable,i.steals]),[['map',false,true]]);
  assert.match(blockedMessage(issues[0]),/partly blocked.*Clicks there go to the control on top/);
  assert.deepEqual(blockedControls([box('map',0,0,40,40,3,0),box('shop',30,30,40,40,1,1)]).map(i=>i.id),['shop']);
});

test('display-only overlaps, edge touches, the utility bar and player-resolved dialogue/choices stay quiet', () => {
  assert.deepEqual(blockedControls([box('date',0,0,50,50,1,0),box('dialogue',10,10,50,50,2,1)]),[]);
  assert.deepEqual(blockedControls([box('map',0,0,40,40,1,0),box('panel',40,0,40,40,2,1)]),[]);
  assert.deepEqual(blockedControls([box('tool_save',0,0,20,20,1,0),box('utilities',0,0,200,30,2,1)]),[]);
  assert.deepEqual(blockedControls([box('choices',0,0,100,100,1,0),box('dialogue',0,0,100,100,1,1)]),[]);
  assert.ok(interactiveIds.has('tool_location')&&interactiveIds.has('calendar')&&!interactiveIds.has('dialogue'));
});

test('covering only the centre still makes a control unusable', () => {
  const [i]=blockedControls([box('board',0,0,100,100,1,0),box('feedback',40,40,20,20,2,1)]);
  assert.equal(i.unusable,true);assert.ok(i.share<.5);assert.match(blockedMessage(i),/including its centre/);
});

test('colours parse from hex, short hex and computed rgb()', () => {
  assert.deepEqual(parseColor('#fff'),[255,255,255,1]);assert.deepEqual(parseColor('#00000080'),[0,0,0,128/255]);assert.deepEqual(parseColor('rgb(10, 20, 30)'),[10,20,30,1]);assert.deepEqual(parseColor('rgba(10, 20, 30, 0.5)'),[10,20,30,.5]);assert.equal(parseColor('var(--x)'),null);
  assert.equal(Math.round(contrast([0,0,0],[255,255,255])),21);
});

test('text over similar art is poor; over contrasting art it passes', () => {
  assert.equal(textContrast(fill(64,[40,40,40,255]),'#303030',null).poor,true);
  const ok=textContrast(fill(64,[245,240,230,255]),'#263a31',null);assert.equal(ok.poor,false);assert.ok(ok.median>8);
  assert.equal(textContrast(fill(64,[0,0,0,0]),'#000',null),null,'fully transparent art without a backdrop is not judged');
  assert.equal(textContrast(fill(64,[0,0,0,0]),'#000','#ffffff').poor,false,'transparent art shows the backdrop');
});

test('busy art warns even when the median passes', () => {
  const px=new Uint8ClampedArray(100*4);for(let i=0;i<100;i++)px.set(i<40?[20,20,20,255]:[250,250,250,255],i*4);
  const r=textContrast(px,'#111',null);assert.equal(r.median>4.5,true);assert.equal(r.poor,true);assert.match(readabilityMessage({id:'dialogue',...r},{dialogue:'Dialogue'}),/Dialogue: 40% of the frame art/);
});

test('readability issues sample each art source with its slice and use the 3:1 icon threshold when given', async () => {
  const seen=[],sample=async(src,o)=>{seen.push([src,o.slice]);return fill(16,src==='dark'?[30,30,30,255]:[128,128,128,255]);};
  const issues=await readabilityIssues([{id:'dialogue',src:'dark',slice:20,ink:'#222'},{id:'map',src:'mid',ink:'#000',min:3,art:'button'},{id:'date',src:''}],sample);
  assert.deepEqual(seen,[['dark',20],['mid',0]]);assert.deepEqual(issues.map(i=>i.id),['dialogue']);assert.match(readabilityMessage(issues[0]),/unreadable over its frame art/);
});

test('Studio review flags a control covered on every device and lists frame/button art to check', async () => {
  const {readFileSync}=await import('node:fs'),{authoringReview}=await import('../public/ui-project.mjs'),raw=JSON.parse(readFileSync(new URL('../public/ui/default-layout.json',import.meta.url),'utf8'));
  assert.deepEqual(authoringReview(raw).blocked,[]);
  for(const d of ['desktop','tablet','phone']){const l=raw.config.layouts[d];l.map={...l.calendar,z:l.calendar.z};l.calendar={...l.calendar,z:l.calendar.z+1};}
  raw.config.widgets.map=raw.config.layouts.desktop.map;raw.config.widgets.calendar=raw.config.layouts.desktop.calendar;
  raw.config.appearance.dialogue.frame='scenario-media/11111111-1111-1111-1111-111111111111.png';raw.config.buttons.map.states.normal.art='scenario-media/22222222-2222-2222-2222-222222222222.png';
  const r=authoringReview(raw);
  assert.equal(r.blocked.length,1);assert.match(r.blocked[0].message,/^Map is unusable: Calendar is drawn over 100% of it\. Clicks there go to the control on top/);assert.deepEqual(r.blocked[0].devices,['desktop','tablet','phone']);assert.ok(r.ids.phone.has('map'));
  assert.deepEqual(r.targets.map(t=>[t.id,t.src,t.art||'frame']),[['dialogue','/scenario-media/11111111-1111-1111-1111-111111111111.png','frame'],['map','/scenario-media/22222222-2222-2222-2222-222222222222.png','button']]);
  assert.equal(r.targets[0].ink,'#211c18');
});
