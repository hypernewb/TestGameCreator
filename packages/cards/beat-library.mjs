// M2 beat library: genre-neutral templates for one love interest's route. Code owns ids, gates, triggers and numbers; a world spec
// (drafted by a model, reviewed in Studio) fills only names, reasons and prose. Four temperaments x three paces cover campus's cast.
export const slug=x=>String(x).toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9@:_-]/g,'').slice(0,40);
export const idOf=x=>String(x).normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);

// Arc: `second` is her other trait; gates are [stage 2, stage 3] as {trust, second}. Drift/acts rows: [act, target, trait|points, delta|extra].
// Targets: '{topic}' her loved subject, '{looks}' the compliment that misses, '{quirk}' the one that lands, '{invite}', '{gift}', '{buy}'.
export const TEMPERAMENTS={
 torn:{about:'Pulled between a life someone planned for her and her own; needs room to decide.',second:'resolve',initial:{trust:25,second:20},gates:[{trust:6,second:45},{trust:15,second:75}],chemistry:10,wantsHerCall:15,
  drift:[['listen','{topic}','second',12],['listen',null,'trust',1],['invite',null,'second',5],['tease',null,'trust',1],['pushy',null,'trust',-3],['pushy','{topic}','second',-3],['compliment','{looks}','second',-3]],
  acts:[['listen','listen','*',3,{memory:true}],['topic','listen','{topic}',3,{memory:true}],['sore','pushy','{topic}',-3],['tease','tease','*',2],['invite','invite','{invite}',3],['looks','compliment','{looks}',-2],['pushy','pushy','*',-3],['touch','touch','*',-2,{when:{private:false}}]]},
 guarded:{about:'Keeps people at arm\'s length until they prove they take her seriously.',second:'ease',initial:{trust:10,second:10},gates:[{trust:6,second:30},{trust:15,second:55}],chemistry:3,
  drift:[['compliment','{topic}','trust',2],['listen',null,'trust',1],['tease',null,'second',5],['invite',null,'second',4],['boast',null,'trust',-3],['pushy',null,'trust',-3]],
  acts:[['topic','compliment','{topic}',3],['looks','compliment','{looks}',-1],['sore','boast','*',-3],['listen','listen','*',2],['tease','tease','*',1,{when:{private:true}}],['tease-public','tease','*',-3,{when:{private:false}}],['pushy','pushy','*',-3],['invite','invite','{invite}',1]]},
 prickly:{about:'Sharp-tongued and fast; banter is affection, sincerity about her passion is the way in.',second:'softness',initial:{trust:15,second:10},gates:[{trust:6,second:30},{trust:15,second:60}],chemistry:8,
  drift:[['tease',null,'trust',1],['compliment','{topic}','second',8],['listen',null,'second',6],['insult','{topic}','trust',-3],['pushy',null,'trust',-3],['insult',null,'trust',1],['listen',null,'trust',1]],
  acts:[['tease','tease','*',2],['topic','compliment','{topic}',3,{memory:true}],['listen','listen','*',2,{memory:true}],['pushy','pushy','*',-3],['banter','insult','*',1,{when:{private:true}}],['sore','insult','{topic}',-3],['invite','invite','{invite}',2],['looks','compliment','{looks}',-2]]},
 practical:{about:'Busy, direct and project-minded; show up for the thing she cares about and she lights up.',second:'playfulness',initial:{trust:15,second:10},gates:[{trust:6,second:30},{trust:15,second:55}],chemistry:6,
  drift:[['listen','{topic}','trust',3],['listen',null,'trust',1],['invite',null,'second',6],['tease',null,'second',4],['compliment','{quirk}','second',4],['boast',null,'trust',-3],['pushy',null,'trust',-3]],
  acts:[['topic','listen','{topic}',3,{memory:true}],['listen','listen','*',1],['invite','invite','{invite}',3],['quirk','compliment','{quirk}',3],['sore','boast','*',-3],['tease','tease','*',1],['pushy','pushy','*',-3]]},
};
// Gate trust is an offset over her starting Trust (the shared relationship edge). Every temperament also prices her gifts and the round she likes; harping on a dislike is a small exact minus (Risky, owner call 2026-09-29).
export const SHARED_ACTS=[['gift','gift','{gift}',6],['buy','buy','{buy}',2],['bad-gift','gift','{badGift}',-3]];

// Pace = how intimacy opens up. Slow waits for exclusive; casual also allows a fling.
export const PACES={
 slow:{openness:45,casual:false,attraction:40,phases:['exclusive'],categories:['first-night']},
 steady:{openness:55,casual:false,attraction:40,phases:['dating','exclusive'],categories:['first-night']},
 easy:{openness:60,casual:false,attraction:35,phases:['dating','exclusive'],categories:['first-night']},
 casual:{openness:75,casual:true,attraction:30,phases:['dating','exclusive'],categories:['first-night','fling']},
};
export const RANK_POINTS=[[0,10],[6,24],[20,36],[32,50]],THRESHOLDS={crush:15,date:35,exclusive:65},WANT_WEIGHTS=[10,8,6];
export const INTIMACY_CATEGORIES=[{id:'first-night',name:'Take it to bed',privacy:'private',casual:false,resolution:'scene',style:'first-night',discretion:'discreet'},{id:'fling',name:'Fling',privacy:'private',casual:true,resolution:'scene',style:'fling',discretion:'discreet'}];

// Firsts: the engine's own milestones fire them. A choice picks a tone; the tone owns the numbers.
export const RUNGS={
 talk:{event:'social.romanceRankChanged',match:c=>({character:c,to:null}),flag:'talked'},
 date:{event:'social.dateAccepted',match:c=>({character:c}),flag:'dated'},
 kiss:{event:'social.datingPhaseChanged',match:c=>({character:c,to:'exclusive'}),flag:'kissed'},
 night:{event:'social.intimacyStarted',match:c=>({character:c,category:'first-night'}),flag:'first-night'},
};
export const TONES={best:[3,3],good:[3,2],fond:[3,0],careful:[2,2],light:[2,1],spark:[2,0],flat:[1,0],miss:[-1,0]};
// Night: lead/rush -> check-in (honest/yes) -> peak (close/more), with a stop on every beat that withdraws consent and costs nothing.
export const NIGHT={lead:[4],rush:[-2],honest:[3,2],yes:[1],close:[4],more:[3]},STOP_LABEL='Say you want to stop here',STOP_TRUST=3;
export const ENDING_PRIORITY={route:20,together:10,fallback:-10};
// Model-facing guidance is part of the engine contract, not world prose: every world starts from these and may override per key.
export const AI_GUIDANCE={intent:'Interpret the player\'s words as one grounded action or spoken response without inventing results.',scene:'Continue the conversation naturally. Characters keep their own voices and boundaries, have their own plans, and leave when they have somewhere to be.',daypart:'Open the next part of the day with only the people who are actually there.'};
export const DEFAULT_CHOICE_TONES=['best','light','miss']; // a rung with no authored choices: one that lands, one that half-lands, one that misses
// O1 free-typed firsts: the checkpoints each rung holds and the act kinds that read her right there (docs/FIRSTS-PLAN.md).
// A creator writes only her cue per checkpoint. strict: after an earlier miss only best counts. required: no light by stalling.
// Night pays NIGHT per checkpoint (pay: verdict -> NIGHT key, like the authored night's three choices); the rest pay TONES once.
// open: the physical beat, where a wanted act she doesn't dislike is best (profiles rarely list touch/flirt as liked; the likes puzzle lives elsewhere).
export const FIRST_CHECKPOINTS={
 talk:[{id:'opening-up',want:['listen','compliment']},{id:'your-turn',want:['tease','flirt','listen']}],
 date:[{id:'arrival',want:['compliment','gift']},{id:'noticing',want:['listen','compliment']},{id:'moment',want:['invite','touch','flirt'],open:true}],
 kiss:[{id:'reading',want:['listen','compliment']},{id:'leaning-in',want:['touch','flirt'],strict:true,open:true},{id:'after',want:['tease','listen']}],
 night:[{id:'lead',want:['touch','flirt'],open:true,pay:{best:'lead',light:'yes',miss:'rush'}},{id:'check-in',want:['ask'],required:true,pay:{best:'honest',light:'yes'}},{id:'peak',want:['touch','flirt','listen'],pay:{best:'close',light:'more',miss:'rush'}}],
};
export const FIRST_INPUTS=2; // a checkpoint with no best or miss resolves light after this many typed turns: no stalling, no fishing
// One TONES tone for a whole talk/date/kiss first, from its checkpoint verdicts: the same scale the authored single choice pays.
export const firstTone=vs=>{const n=k=>vs.filter(v=>v===k).length,best=n('best'),miss=n('miss');return !miss?best===vs.length?'best':best?'good':'light':best>miss?'spark':best?'flat':'miss';};
