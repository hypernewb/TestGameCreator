import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const editor=p=>{
 const fields=[],nodes=[],node=(tag,text)=>{const n={tag,text,children:[],append(...children){this.children.push(...children);}};nodes.push(n);return n;},field=(parent,obj,key,label,kind,choices)=>{const input={value:obj[key]??'',label,choices,oninput(){obj[key]=kind==='number'?Number(input.value):input.value;}};fields.push(input);parent.append(input);return input;};
 const source=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8'),context={p,node,field,section:()=>node('section'),actors:()=>[['player','You'],['heroine','Ada']],csv:(parent,obj,key,label)=>{const input=field(parent,{value:obj[key].join(', ')},'value',label);input.oninput=()=>{obj[key]=input.value.split(',').map(x=>x.trim()).filter(Boolean);};},message(){},render(){}};
 runInNewContext(source.slice(source.indexOf('function likesClueEditor(p){'))+'\nlikesClueEditor(p);',context);return {fields,nodes,find:label=>fields.find(x=>x.label===label)};
};

test('Studio preserves missing fields and edits or removes all clue settings',()=>{
 const p={playerId:'player',modules:{'social.dating':{}},datingProfiles:[{character:'heroine'}]},ui=editor(p);assert.equal(p.likesOpen,undefined);assert.equal(p.likeClueSettings,undefined);assert.equal(p.likeClues,undefined);
 const mode=ui.find('Likes visibility');mode.value='open';mode.onchange();assert.equal(p.likesOpen,true);mode.value='closed';mode.onchange();assert.equal(p.likesOpen,false);mode.value='legacy';mode.onchange();assert.equal(p.likesOpen,undefined);
 const threshold=ui.find('Matching clues to earn a label (default 2)'),cap=ui.find('Friend hints per day (default 1; 0 disables)');threshold.value='3';threshold.oninput();cap.value='0';cap.oninput();assert.equal(p.likeClueSettings.promotionThreshold,3);assert.equal(p.likeClueSettings.gossipDailyCap,0);threshold.value='';threshold.oninput();assert.equal(p.likeClueSettings.promotionThreshold,undefined);cap.value='';cap.oninput();assert.equal(p.likeClueSettings,undefined);
});

test('Studio author table edits lines and soft labels and lets the owner veto a row',()=>{
 const row={id:'shore',character:'heroine',tag:'ocean_tag',liked:true,entries:['sea'],clues:['Salt air.','A distant shore.'],softLabel:'Drawn to the coast'},p={playerId:'player',modules:{'social.dating':{}},actProfiles:[{character:'heroine',entries:[],likeClues:[row]}]},ui=editor(p);assert.ok(ui.nodes.some(x=>x.tag==='table'));const lines=ui.find('Clues');lines.value='Waves beyond the window.\nShe watched the tide.';lines.oninput();assert.equal(row.clues.join('|'),'Waves beyond the window.|She watched the tide.');const label=ui.find('Soft label');label.value='Feels at home by the water';label.oninput();assert.equal(row.softLabel,label.value);const reaction=ui.find('Reaction');reaction.value='dislike';reaction.onchange();assert.equal(row.liked,false);ui.nodes.find(x=>x.text==='Remove').onclick();assert.equal(p.actProfiles[0].likeClues.length,0);
});
