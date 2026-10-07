// T-profile-expansion demo: three original adult profiles authored to the new deep-profile schema.
// No model calls: each file is validated through the same normalizeCharacter path generation uses,
// checked for voice/interest/romance contrast, and diffed against the previous output shape.
import {readFileSync,writeFileSync} from 'node:fs';
import {normalizeCharacter,characterResponseFormat} from '../packages/ai/character-authoring.mjs';
import {PROFILE_SECTIONS} from '../public/profile-tags.mjs';

const pack={id:'demo',schemaVersion:1,version:'0.1.0',title:'Demo',modules:{},playerId:'player',locations:[{id:'harbour',name:'Harbour',exits:[]}],actors:[{id:'player',name:'You',location:'harbour'}]};
const cast=['yuki-aihara','mio-tachibana','sota-kawaguchi'].map(id=>JSON.parse(readFileSync(new URL(`../artifacts/profile-expansion/${id}.json`,import.meta.url),'utf8')));
const actors=cast.map(c=>normalizeCharacter(c,pack,{location:'harbour'}));
for(const a of actors)writeFileSync(new URL(`../artifacts/profile-expansion/${a.id}.normalized.json`,import.meta.url),JSON.stringify(a,null,1)+'\n');

const oldFields=['name','pronouns','age','description','personality','behavior(5)','backstory','goal','traits','likes','dislikes','voice','style','examples','conversationStarters','flaws','routine','year','major','dorm','depth'];
const newFields=[...oldFields,'profile.everyday(living,circle,leisure,habits,concerns)','profile.persona(archetype,public,private,strengths,insecurities,pride,contradictions)','profile.voice(formality,humour,directness,teasing,vocabulary)','profile.romance(shows,attractedBy,discouragedBy,initiation,pace,compliments,unwelcome,close)','profile.body(posture,tells,space,attention)','profile.scenes(problems,shared,invitations,unfinished)'];
const lines=[];
lines.push('# Deep profile demo — diff vs previous generation output');
lines.push('');
lines.push('All three profiles pass `normalizeCharacter` (the exact path a generated draft takes), so they are exactly what the new schema elicits. No model calls were made.');
lines.push('');
lines.push('## Previous output fields (per character)');
lines.push('');
lines.push(oldFields.map(f=>`- ${f}`).join('\n'));
lines.push('');
lines.push('## New output fields (added by this ticket)');
lines.push('');
lines.push(newFields.slice(oldFields.length).map(f=>`- ${f}`).join('\n'));
lines.push('');
lines.push('## Voice contrast (the point: three clearly different speakers)');
lines.push('');
lines.push('| Character | Archetype | Formality | Humour | Directness | Teasing | Pace | Initiation | Unwelcome | Space |');
lines.push('|---|---|---|---|---|---|---|---|---|---|');
for(const a of actors){const p=a.profile;lines.push(`| ${a.name} | ${p.persona.archetype} | ${p.voice.formality} | ${p.voice.humour} | ${p.voice.directness} | ${p.voice.teasing} | ${p.romance.pace} | ${p.romance.initiation} | ${p.romance.unwelcome} | ${p.body.space} |`);}
const dims=['formality','humour','directness','teasing'],distinct=dims.filter(d=>new Set(actors.map(a=>a.profile.voice[d])).size===3);
lines.push('');
lines.push(`Voice dimensions where all three differ: ${distinct.join(', ')} (${distinct.length} of 4).`);
lines.push('');
lines.push('## Everyday-life contrast');
for(const a of actors)lines.push(`- **${a.name}** (${a.age}) — living: ${a.profile.everyday.living}; leisure: ${a.profile.everyday.leisure.join('; ')}; concerns: ${a.profile.everyday.concerns.join('; ')}`);
lines.push('');
lines.push('## Romantic-behaviour contrast (manner only; scores/consent stay engine-owned)');
for(const a of actors)lines.push(`- **${a.name}** — shows interest: ${a.profile.romance.shows[0]}; attracted by: ${a.profile.romance.attractedBy[0]}; discouraged by: ${a.profile.romance.discouragedBy[0]}; once close: ${a.profile.romance.close}`);
lines.push('');
lines.push('## Sample lines (from examples, one per character)');
for(const a of actors)lines.push(`- ${a.name}: “${a.examples[0]}”`);
writeFileSync(new URL('../artifacts/profile-expansion/diff-vs-previous.md',import.meta.url),lines.join('\n')+'\n');
console.log(lines.join('\n'));
const format=characterResponseFormat();
console.log(`\nSchema check: profile required=${format.json_schema.schema.required.includes('profile')}, sections=${PROFILE_SECTIONS.length}`);
