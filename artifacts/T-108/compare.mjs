// Offline comparison: the baseline source is the worktree's starting main, never a model endpoint.
import {readFileSync,writeFileSync} from 'node:fs';
import {scenePromptMessages} from '../../vendor/venus/scenePrompt.mjs';
import {questionEnding} from '../../packages/ai/narration-lint.mjs';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),original=new URL('vendor/venus/scenePrompt.mjs',root);
const source=read('artifacts/T-108/scenePrompt.before.txt').replace(/from (['"])(\.[^'"]+)\1/g,(_,q,path)=>'from '+q+new URL(path,original).href+q);
const beforePrompt=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).scenePromptMessages;
const pack=JSON.parse(read('packs/neutral.json'));pack.narratorPersona='lush';pack.characterSheets=[{actorId:'ada',speech:{tics:['Precisely'],fillers:[],rhythm:'measured clauses',petPhrases:[],avoid:[],sample:'Precisely. There is a better way.'}}];
const promptSizes=[];for(const conversationStyle of ['authored','continuous'])for(const first of [null,{title:'A moment',checkpoint:'reading',cue:'She pauses.'}]){
 const context={gameProject:{conversationStyle},stagedCast:['ada'],scenePhase:'continuation',playerAction:'Tell me about the project.',sceneHistory:[{input:'Hello.',text:'Ada: I have the plans.'}],first};
 const a=beforePrompt(context,pack),b=scenePromptMessages(context,pack),tokens=x=>Math.ceil(x.reduce((n,m)=>n+m.content.length,0)/4);
 promptSizes.push({conversationStyle,first:!!first,beforeEstimatedTokens:tokens(a),afterEstimatedTokens:tokens(b),delta:tokens(b)-tokens(a)});
}
const runs=Object.fromEntries(['before','after'].map(name=>{const data=JSON.parse(read('artifacts/T-108/'+name+'.json')),spoken=data.steps.filter(s=>s.lines?.some(l=>l.speaker));return [name,{turns:data.metrics.turns,refusals:data.metrics.refusals,npcReplies:spoken.length,questionEndings:spoken.filter(s=>questionEnding(s.lines)).length,questionEndingRate:spoken.length?spoken.filter(s=>questionEnding(s.lines)).length/spoken.length:null,distinctVoice:null,distinctVoiceReason:'The fixed stock MockProvider does not render authored speech profiles; no model voice-quality metric can be inferred.',excerpt:spoken[0]?.text||data.steps[0]?.text,dialogue:data.metrics.dialogue}];}));
const result={provider:'mock',seed:42,script:'stranger-to-close',limits:'No live calls. Fixed mock replies test plumbing; identical output is not evidence of improved prose or fun. Token counts are characters/4 estimates, not tokenizer measurements.',promptSizes,runs};
writeFileSync(new URL('comparison.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
