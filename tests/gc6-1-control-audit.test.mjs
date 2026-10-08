import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSystemValue} from '../public/creator-systems-contract.mjs';

// Backs GC6.1 audit claims: blank numbers are rejected by the typed contract, and the legacy JSON/native editors are gone.
const pack={playerId:'player',modules:{'social.daily-need':true},actors:[{id:'player',name:'Player'},{id:'npc',name:'NPC'}],locations:[],items:[],statDefinitions:[{id:'skill',name:'Skill',min:0,max:100}],storyVariables:[]};
const need={id:'hug',hint:'Warm contact',weight:1,traitWeights:{},matches:[{kind:'touch'}],against:[]};
const daily={reward:{like:1,trust:1},againstLike:-1,needs:[need]};

test('typed dailyNeeds rejects a blank reward and accepts a typed one', () => {
  assert.throws(() => validateSystemValue(pack, 'dailyNeeds', {...daily, reward: {like: undefined, trust: 1}}), /required|number/i);
  assert.doesNotThrow(() => validateSystemValue(pack, 'dailyNeeds', daily));
});

test('typed statMilestones rejects a blank or out-of-range threshold', () => {
  const m = {id: 'm1', stat: 'skill', min: undefined, flag: 'earned'};
  assert.throws(() => validateSystemValue(pack, 'statMilestones', m));
  assert.throws(() => validateSystemValue(pack, 'statMilestones', {...m, min: 101}), /range/);
});

test('studio has no legacy dataEditor or native dailyNeeds/statMilestones editors', () => {
  const src = readFileSync(new URL('../public/studio.mjs', import.meta.url), 'utf8');
  assert.equal(/\bdataEditor\(/.test(src), false);
  assert.equal(/function (dailyNeedEditor|statMilestonesEditor)\b/.test(src), false);
});
