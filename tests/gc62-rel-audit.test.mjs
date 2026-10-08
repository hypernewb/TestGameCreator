import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

// Backs GC6.2 audit rows: the Studio/advanced control writes the key, the runtime reads it, and a named test (or file) exercises it. Source checks are presence only; see docs/research/gc62-rel-audit-2026-10-08.md.
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const dir=(d)=>readdirSync(new URL('../'+d,import.meta.url),{recursive:true}).filter(f=>f.endsWith('.mjs')).map(f=>read(d+'/'+f)).join('\n');
const ui=readdirSync(new URL('../public/',import.meta.url)).filter(f=>/^(studio|creator-|sheet-editor)/.test(f)&&f.endsWith('.mjs')).map(f=>read('public/'+f)).join('\n');
const rt=dir('packages');
const cited=(file,title)=>title?read('tests/'+file).includes(title):read('tests/'+file);

// [row, control regex in ui, runtime regex in packages, test file, test title (null = file-level)]
const rows=[
 ['1 starting relationships', /'initialRelationships'/, /initialRelationships/, 'flirt-cap.test.mjs', 'exhausted conversation gives no fresh-talk Trust gain and preserves authored negative reactions'],
 ['2 relationship dimensions', /'relationshipDimensions'/, /relationshipDimensions/, 'dialogue-reactions.test.mjs', 'authored dialogue reactions change visible relationship values with repeat decay'],
 ['4 initial NPC relationships', /'initialNpcRelationships'/, /initialNpcRelationships/, 'npc-life.test.mjs', null],
 ['5 relationship stage settings', /relationshipStageSettings/, /relationshipStageSettings/, 'relationship-stages.test.mjs', 'ladder requires asks and adjacency, including authored gates'],
 ['6 authored stage transitions', /'datingPhase'/, /datingPhase/, 'relationship-stages.test.mjs', 'authored and rivalry paths coordinate genuine breakups'],
 ['7 attraction and eligibility', /Attraction and dating/, /eligibility/, 'stat-gates.test.mjs', 'dating: a gated character is not eligible and says why until the stat is reached'],
 ['8 rank gates and romance ranks', /'ranks'/, /advanceRomanceRank/, 'creator-advanced-controls.test.mjs', 'nested romance controls author ranks, gift tastes and repeating signals; runtime advances and replays'],
 ['9 dialogue reactions', /'Dialogue reactions'/, /dialogueReactions/, 'creator-mechanics-controls.test.mjs', 'dialogueReactions: form authors a rule; runtime pays Trust on a spoken match'],
 ['10 gifts (repeat decay, period)', /repeatDecayPercent/, /repeatDecayPercent/, 'gift-repeats.test.mjs', 'lifetime repeats persist across windows, reload and over fifty other gifts; recipients and items are independent'],
 ['11 daily gain caps', /dailyGain/, /dailyGain/, 'romance-stats.test.mjs', 'Like gains cap at 6 per heroine per day; losses are never capped; the cap resets next day'],
 ['12 cooldowns (signals, dialogue)', /cooldownTicks/, /cooldownTicks/, 'romance-tempo.test.mjs', 'signal cooldowns block repeats until enough time passes'],
 ['13 firsts', /'firsts'|firsts/, /firsts/, 'firsts.test.mjs', 'firsts validate: the checkpoint shape is fixed by code and the night keeps its check-in'],
 ['14 hard boundary limits', /hardLimit/, /hardLimit/, 'body-limits.test.mjs', 'hard requires scene agreement, Trust and relationship stage, with default and custom bars'],
 ['15 region limits and rules', /effect\.type==='limit'/, /regionLimitReason/, 'body-limits.test.mjs', 'every region enforces never/ask_first/ok/null independently'],
 ['16 intimacy settings and sensitivity', /intimacySettings/, /sensitivityScaleOf/, 'body-limits.test.mjs', 'sensitivity scales applied Lust, honors pack scale and clamps'],
 ['17 stat and bond gates', /gateSelect/, /statDefinitions/, 'stat-gates.test.mjs', 'interest gate: closed below the stat, open at it; plain-language reason and narrator cue'],
 ['18 character sheets', /sheet-editor/, /createSheet|characterSheets/, 'character-sheet.test.mjs', 'studio tabs edit one record in basic/advanced views, preserve null, and validate before applying'],
];

for(const [row,ctl,run,file,title] of rows){
 test(`GC6.2 row ${row}: control writes key, runtime reads it, cited test exists`, ()=>{
  assert.match(ui, ctl);
  assert.match(rt, run);
  assert.ok(cited(file, title), `${file} missing ${title ? 'title' : 'file'}`);
 });
}

// Gap rows: control missing, JSON-only, or no shared selector. Kept as todo until an owner-approved control exists.
// No studio control writes initialBonds; runtime reads it in packages/modules/bonds.mjs:6 (row 3).
test.todo('GC6.2 row 3 initial bonds: no visual control; only runtime and framework.test.mjs:47 touch it');
// Ranks and hard limits are typed in advanced/contract paths but also JSON textareas in studio.mjs (rows 8, 14).
test.todo('GC6.2 row 8 romance ranks: studio.mjs romanceTempoEditor still edits ranks as JSON');
test.todo('GC6.2 row 14 hard limits: studio.mjs intimacyEditor edits hardLimit as Trust/stage JSON');
// Signal cooldowns are set only inside the signals JSON (studio.mjs jsonField); dialogue cooldown is typed.
test.todo('GC6.2 row 12 signal cooldowns: only authorable through the signals JSON field');
// Events are free-text names in signals and dialogue reactions; the plan asks for shared actor/stage/event selectors.
test.todo('GC6.2 shared selectors: events and stages are free text, not picked from project data');
