import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRun,summarizeRuns,formatRow,formatSummary} from '../packages/ai/bulk-robustness.mjs';

test('robustness rows count repairs, kept entries, drops, warnings and watched words; summaries group by model',()=>{
 const proposal={scenes:[{value:{text:'A Christmas party, then Halloween? Christmas!'}}],events:[{value:{}}],dropped:['x'],warnings:['a','b']};
 const a=summarizeRun({model:'m',run:1,code:0,stderr:'First candidate failed\nRequesting one repair…\nAI request failed (500); retrying once…',proposal,ms:61400,watch:['christmas','Halloween']});
 assert.deepEqual({...a,words:a.words},{model:'m',run:1,ok:true,seconds:61,repairs:1,retries:1,kept:{scenes:1,events:1},dropped:1,warnings:2,words:{christmas:2,Halloween:1},error:''});
 const b=summarizeRun({model:'m',run:2,code:1,stderr:'ERROR: Every entry failed validation',ms:20000});assert.equal(b.ok,false);assert.equal(b.error,'Every entry failed validation');
 const c=summarizeRun({model:'n',run:1,code:0,stderr:'',proposal:{scenes:[{value:{}}]},ms:1000});
 assert.deepEqual(summarizeRuns([a,b,c]),[{model:'m',runs:2,ok:1,firstTry:0,dropped:1,warnings:2,avgSeconds:41},{model:'n',runs:1,ok:1,firstTry:1,dropped:0,warnings:0,avgSeconds:1}]);
 assert.match(formatRow(a),/^ok +m #1 61s repairs:1 .*kept:1 scenes, 1 events .*christmas=2/);assert.match(formatRow(b),/^FAIL .*error: Every entry/);assert.equal(formatSummary(summarizeRuns([c])[0]),'n: 1/1 ok, 1 first try, 0 dropped, 0 warnings, ~1s/run');
});

test('robustness playtest applies a proposal, runs the persona bots and reports dead turns, hand offers per daypart and which new scenes played',async()=>{
 const {readFileSync}=await import('node:fs'),{playtestProposal}=await import('../packages/ai/bulk-robustness.mjs'),pack=JSON.parse(readFileSync(new URL('./fixtures/bulk-replies/huntrix.pack.json',import.meta.url),'utf8'));
 const scene=(id,who,at,hand)=>({status:'approved',value:{id,title:id,opening:`${who} waves.`,...(hand?{offer:'hand',trigger:{event:'story.handOffered',match:{}},when:{location:at}}:{trigger:{event:'core.moved',match:{to:at}}}),pages:[{speaker:who,text:'Hey.'}],choices:[{id:'ok',label:'Wave back',result:'You wave.',effects:[]}]}});
 const proposal={scenes:[scene('party-intro','rumi','main-party-room'),scene('bar-talk','zoey','kitchen-bar',true),scene('party-talk','mira','main-party-room',true),{...scene('nope','zoey','kitchen-bar',true),status:'rejected'}]};
 const p=playtestProposal(pack,proposal,{turns:60,personas:['explorer']}),q=playtestProposal(pack,proposal,{turns:60,personas:['explorer']});
 assert.deepEqual(p,q);assert.equal(p.fresh,3);assert.equal(p.errors,0);assert.equal(p.runs.length,1);assert.ok(p.dead>=0&&p.dead<1);assert.ok(p.hand>0,'hand cards are offered');assert.ok(p.played>=1&&p.played<=3);
 const none=playtestProposal(pack,{},{turns:60,personas:['explorer']});assert.equal(none.fresh,0);assert.equal(none.played,0);assert.equal(none.hand,0);assert.ok(none.dead>p.dead,'new scenes cut dead turns');
 const row=summarizeRun({model:'m',run:1,code:0,stderr:'',proposal:{scenes:proposal.scenes},ms:1000,play:p});assert.match(formatRow(row),/ play: dead \d+% hand [\d.]+\/daypart played \d\/3 payoff /);
 assert.match(formatSummary(summarizeRuns([row])[0]),/; play: dead \d+%, hand [\d.]+\/daypart, played \d\/3, 0 with an ending$/);
});
