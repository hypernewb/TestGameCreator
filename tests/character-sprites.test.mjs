import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {characterPrompt,spriteSheet,spriteManifest,expressionRel,renderRel} from '../packages/assets/character-sprites.mjs';
import {buildRequest} from '../packages/assets/novelai.mjs';

const style={model:'nai-diffusion-5-full',size:[832,1216],steps:18,scale:9,cfgRescale:0.7,ucPreset:2,emotions:['neutral','smile'],style:'STYLE',poseTags:['1girl','cowboy shot'],expressionTags:{neutral:['closed mouth'],smile:['smile']},negative:'lowres'};
const ai={id:'ai',name:'Ai',baseAppearance:['adult woman','black bob'],outfit:['red coat'],expressionTags:{smile:['grin']},negativeTags:['hat'],seed:7};

test('character prompts group like Venus: base, then appearance / outfit / expression, character overrides win',()=>{
 const p=characterPrompt(style,ai,'neutral');assert.equal(p.base,'1girl, cowboy shot,\n\nSTYLE');assert.equal(p.caption,'adult woman, black bob,\n\nred coat,\n\nclosed mouth');assert.equal(p.negative,'lowres, hat');
 assert.match(characterPrompt(style,ai,'smile').caption,/grin$/);
 assert.throws(()=>characterPrompt(style,ai,'angry'),/no expression tags/);assert.throws(()=>characterPrompt(style,{...ai,id:'../x'},'neutral'),/Bad character id/);
});

test('sprite sheets render free into {id}/expressions/{emotion}.png on the character seed',()=>{
 const sheet=spriteSheet(style,[ai]);assert.deepEqual(sheet.cgs.map(c=>c.rel),['ai/expressions/neutral.png','ai/expressions/smile.png']);
 const body=buildRequest(sheet,sheet.cgs[1]);assert.equal(body.parameters.seed,7);assert.equal(body.model,'nai-diffusion-5-full');assert.equal(body.parameters.negative_prompt,'lowres, hat');
 assert.match(body.parameters.v4_prompt.caption.char_captions[0].char_caption,/red coat,\n\ngrin/);assert.ok(body.parameters.width*body.parameters.height<=1024*1024);
 assert.equal(spriteManifest(ai,rel=>rel.endsWith('smile.png'),style).poses[0].image,'ai/'+expressionRel('smile'));
});

test('outfit sets and rooms land in outfits/{set}/ and room_{day|night}.png; the manifest lists only what exists',()=>{
 const st={...style,sets:{gym:{emotions:['neutral'],negativeTags:['nsfw']}},room:{size:[1216,832],tags:['no humans'],variants:{day:['sunlight'],night:['lamp']},style:'ROOM',negativeTags:['1girl']}},c={...ai,outfitSets:{gym:['sports bra']},roomTags:['posters']};
 const sheet=spriteSheet(st,[c]),rels=sheet.cgs.map(x=>x.rel);assert.deepEqual(rels,['ai/expressions/neutral.png','ai/expressions/smile.png','ai/outfits/gym/neutral.png','ai/room_day.png','ai/room_night.png']);
 const gym=buildRequest(sheet,sheet.cgs[2]);assert.match(gym.parameters.v4_prompt.caption.char_captions[0].char_caption,/sports bra/);assert.equal(gym.parameters.negative_prompt,'lowres, nsfw, hat');
 const room=buildRequest(sheet,sheet.cgs[4]);assert.equal(room.input,'no humans,\n\nposters,\n\nlamp,\n\nROOM');assert.equal(room.parameters.width,1216);assert.equal(room.parameters.characterPrompts.length,0);assert.equal(room.parameters.negative_prompt,'lowres, 1girl');
 assert.throws(()=>characterPrompt(st,ai,'neutral','gym'),/no outfit/);assert.equal(renderRel('outfits/gym/neutral.png'),'renders/outfits_gym_neutral.json');
 const m=spriteManifest(c,rel=>!rel.includes('night')&&!rel.includes('profile'),st);assert.deepEqual(Object.keys(m.outfits),['gym']);assert.deepEqual(m.rooms,{day:'ai/room_day.png'});assert.equal(m.profile,null);
});

test('shipped character folders all build a free request for every emotion',()=>{
 const root='public/assets/characters',st=JSON.parse(readFileSync(`${root}/_style.json`,'utf8'));
 const chars=readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>JSON.parse(readFileSync(`${root}/${d.name}/character.json`,'utf8')));
 assert.ok(chars.length>=12);for(const c of chars)assert.ok(existsSync(`${root}/${c.id}`));
 for(const cg of spriteSheet(st,chars).cgs)buildRequest(spriteSheet(st,chars),cg);
});

test('extra takes render at seed+n-1 as _v{n}; scenes carry their own negative and land in scenes/; the manifest lists both',()=>{
 const st={...style,takes:2,scenes:{size:[1216,832],takes:2,tags:['pov'],negative:'SCENE UC, child',list:{kiss:{outfit:'lingerie',tags:['kiss'],her:['blush'],negativeTags:['penis']}}}},c={...ai,outfitSets:{lingerie:['black lace bra']}};
 const sheet=spriteSheet(st,[c],{rooms:false}),rels=sheet.cgs.map(x=>x.rel);assert.deepEqual(rels,['ai/expressions/neutral.png','ai/expressions/neutral_v2.png','ai/expressions/smile.png','ai/expressions/smile_v2.png','ai/scenes/kiss.png','ai/scenes/kiss_v2.png']);
 assert.equal(sheet.cgs[1].seed,8);const kiss=buildRequest(sheet,sheet.cgs[5]);assert.equal(kiss.parameters.seed,8);assert.equal(kiss.parameters.negative_prompt,'SCENE UC, child, penis, hat');assert.doesNotMatch(kiss.parameters.negative_prompt,/lowres/);
 assert.match(kiss.input,/^pov,\n\nkiss,\n\nSTYLE/);assert.match(kiss.parameters.v4_prompt.caption.char_captions[0].char_caption,/black lace bra,\n\nblush$/);assert.equal(kiss.parameters.width,1216);
 assert.throws(()=>spriteSheet(st,[ai]),/no outfit for set lingerie/);assert.equal(spriteSheet(st,[c],{sprites:false,rooms:false}).cgs.length,2);
 const m=spriteManifest(c,rel=>!rel.endsWith('smile_v2.png'),st);assert.deepEqual(m.poses,[{id:'neutral',image:'ai/expressions/neutral.png',variants:['ai/expressions/neutral_v2.png']},{id:'smile',image:'ai/expressions/smile.png'}]);assert.deepEqual(m.scenes,{kiss:['ai/scenes/kiss.png','ai/scenes/kiss_v2.png']});
});

test('shipped scenes ban minors in the negative, keep adult tags in the caption, and stay free',()=>{
 const root='public/assets/characters',st=JSON.parse(readFileSync(`${root}/_style.json`,'utf8')),c=JSON.parse(readFileSync(`${root}/haruka/character.json`,'utf8'));
 const sheet=spriteSheet(st,[c],{sprites:false,rooms:false});assert.ok(sheet.cgs.length>=2);
 for(const cg of sheet.cgs){const b=buildRequest(sheet,cg);assert.match(b.parameters.negative_prompt,/\bchild\b.*\bunderage\b/);assert.match(b.parameters.negative_prompt,/\bloli\b/);assert.doesNotMatch(b.parameters.negative_prompt,/(^|, )(nsfw|nude|naked)(,|$)/);assert.match(b.parameters.v4_prompt.caption.char_captions[0].char_caption,/^adult woman/);}
});
