// Run `ai-bulk-author generate` across models × runs and summarize how often each model lands a clean proposal.
// Each proposal is then played by persona bots (--play-turns N per bot, default 120; 0 skips).
// node scripts/ai-bulk-robustness.mjs --pack p.json --card c.png --models a,b --runs 3 --dir out/ [--watch Christmas,Halloween] [--play-turns 120] [generate flags: --locations 2 --characters 3 --scenes 6 --events 3 …]
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarizeRun,summarizeRuns,formatRow,formatSummary,playtestProposal} from '../packages/ai/bulk-robustness.mjs';

const argv=process.argv.slice(2),take=(name,fallback)=>{const i=argv.indexOf(`--${name}`);if(i<0)return fallback;const [,v]=argv.splice(i,2);return v;};
const models=(take('models')||process.env.STORY_MODEL||'').split(',').map(s=>s.trim()).filter(Boolean),runs=Number(take('runs','2')),dir=resolve(take('dir','bulk-robustness')),playTurns=Number(take('play-turns','120')),pack=argv.includes('--pack')&&JSON.parse(readFileSync(resolve(argv[argv.indexOf('--pack')+1]),'utf8')),watch=(take('watch')||'').split(',').map(s=>s.trim()).filter(Boolean);
if(!models.length||!Number.isInteger(runs)||runs<1||!Number.isInteger(playTurns)||playTurns<0||argv.includes('--out')||argv.includes('--model')){console.error('Usage: node scripts/ai-bulk-robustness.mjs --pack p.json (--card c.png|--brief b.md) --models a,b --runs N --dir DIR [--watch word,word] [generate count flags]\n--out and --model are set per run.');process.exit(1);}
mkdirSync(dir,{recursive:true});const author=fileURLToPath(new URL('./ai-bulk-author.mjs',import.meta.url)),rows=[],slug=m=>m.replace(/[^\w.-]+/g,'_');
const once=args=>new Promise(done=>{const t=Date.now(),p=spawn(process.execPath,[author,'generate',...args]);let stderr='';p.stderr.on('data',d=>{stderr+=d;process.stderr.write(d);});p.stdout.resume();p.on('close',code=>done({code,stderr,ms:Date.now()-t}));});
for(const model of models)for(let run=1;run<=runs;run++){
 const out=join(dir,`${slug(model)}-${run}.json`);if(existsSync(out))throw Error(`${out} exists; pick a new --dir`);
 console.error(`== ${model} #${run}`);const r=await once([...argv,'--model',model,'--out',out]);
 const proposal=existsSync(out)?JSON.parse(readFileSync(out,'utf8')):null;let play;if(proposal&&pack&&playTurns>0)try{play=playtestProposal(pack,proposal,{turns:playTurns});}catch(e){console.error(`Playtest failed: ${e.message}`);}
 const row=summarizeRun({model,run,...r,proposal,watch,play});rows.push(row);console.log(formatRow(row));
}
console.log(`\n${summarizeRuns(rows).map(formatSummary).join('\n')}`);writeFileSync(join(dir,'summary.json'),JSON.stringify({rows,summary:summarizeRuns(rows)},null,2)+'\n');console.log(`Details: ${join(dir,'summary.json')} (failed replies: *.failed.txt; replay them with ai-bulk-author replay)`);
