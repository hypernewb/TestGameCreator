// Deep-profile vocabulary for character authoring: six organised areas beyond the flat actor fields.
// Shared by the Studio forms (browser) and generation/validation (node). Archetypes are fictional
// VN archetypes, not claims about any real group; every list allows custom values in the forms.
// Enum fields are small closed picks ("what kind of thing"); line fields are concrete free text
// ("which things"), so profiles stay specific without becoming adjective soup.

const pick=values=>Object.freeze(values);
const described=entries=>{const values=Object.freeze(entries.map(([v])=>v)),desc=Object.freeze(Object.fromEntries(entries));return {values,desc};};

// Broad VN archetype: the first impression a player frames the character with. Deliberately varied
// across everyday lives; none of them defaults to academic, technical specialist or therapist.
export const ARCHETYPES=described([
 ['devoted-caretaker','puts everyone else first and hides what it costs'],
 ['confident-achiever','used to winning and quietly afraid of what losing would mean'],
 ['guarded-loner','keeps people at arm\'s length out of habit, not dislike'],
 ['playful-tease','jokes and flirts to keep real conversations at a distance'],
 ['warm-socialite','collects people and remembers every small detail about them'],
 ['dry-pragmatist','states things plainly and shows care through actions, not words'],
 ['restless-free-spirit','chases novelty and bristles at routine and plans'],
 ['earnest-idealist','believes loudly in something and is a little embarrassed about it'],
 ['competitive-rival','turns everything into a contest, including affection'],
 ['steady-anchor','the calm one everyone leans on, rarely asked how they are'],
 ['recovering-perfectionist','high standards for themselves, forgiveness only for others'],
 ['reluctant-leader','ends up in charge of everything and pretends not to want it'],
 ['old-soul-homebody','quiet evenings, deep hobbies, slow to let people in'],
 ['chaotic-creative','brilliant and disorganised, allergic to being managed'],
 ['gentle-grump','complains about everything and still shows up for everyone'],
 ['magnetic-flirt','reads rooms easily; attention is easy, intimacy is not']
]);

export const LIVING=described([
 ['alone','their own place; how they keep it says a lot'],
 ['with-family','multigenerational or by circumstance, with obligations'],
 ['with-roommates','shared flat, shared fridge politics'],
 ['with-partner','lives with a current or recent partner'],
 ['shared-house','friend group under one leaky roof'],
 ['dorm','institutional housing, thin walls'],
 ['workplace-housing','lives where they work; hard to leave the job behind'],
 ['moves-around','crashes with friends, sublets, never quite unpacked']
]);

export const FORMALITY=described([
 ['slangy','current slang, deliberately out of date memes'],
 ['casual','relaxed everyday speech, few complete sentences'],
 ['shifting','polite with strangers, loose with friends; the switch is the tell'],
 ['neutral','unremarkable register; easy to underestimate'],
 ['polished','full sentences, chosen words, sounds older than they are'],
 ['stiff','formal even when it costs them; second language, upbringing or armour']
]);

export const HUMOUR=described([
 ['deadpan','jokes without moving a muscle; you have to be paying attention'],
 ['goofy','commits to the bit past the point of dignity'],
 ['teasing','humour is always aimed at someone present, usually fondly'],
 ['wordplay','puns, exact meanings, correcting your grammar mid-joke'],
 ['self-deprecating','deflects with jokes at their own expense'],
 ['earnest','rarely jokes; takes things at face value and says so'],
 ['rare','almost never funny on purpose, which makes it land when it happens']
]);

export const DIRECTNESS=described([
 ['circles','asks three questions before the one they mean'],
 ['hedges','softens every request until it can be mistaken for small talk'],
 ['plain','says the thing once, without decoration'],
 ['blunt','says the thing twice, in case you missed it'],
 ['brutally-honest','honesty as a policy even when a kind lie was available']
]);

export const TEASING=described([
 ['none','takes people straight; teasing reads as mockery to them'],
 ['gentle','small fond jabs, never about anything raw'],
 ['relentless','a running bit they will not drop; affectionate in aggregate'],
 ['flirty','teasing as a way to test reactions and hide interest'],
 ['sharp-but-kind','witty and pointed about ideas, careful about people']
]);

export const INITIATION=described([
 ['waits','will not move first, ever; reads patience as dignity'],
 ['hints','engineers opportunities and hopes you notice'],
 ['invites','asks directly for time and activities, no more'],
 ['makes-moves','says what they want and acts on it; handles a no gracefully'],
 ['mirrors','matches whatever the other person\'s pace and boldness is']
]);

export const PACE=described([
 ['slow','trust first; weeks of small signals before a first date'],
 ['measured','open to dating but wants to know someone before feelings'],
 ['open','willing to try dating early and see where it goes'],
 ['eager','falls fast and says so; the risk excites them']
]);

// How they receive unwanted romantic attention. `deflect`, `tease_back` and `guarded` match the
// runtime's unwelcomeStyleOf fallbacks; the rest are authoring-only until wired.
export const UNWELCOME=described([
 ['deflect','changes the subject and hopes it evaporates'],
 ['tease_back','returns the advance as a joke, sting calibrated to interest'],
 ['guarded','names the boundary plainly and goes cooler'],
 ['honest','kind, unambiguous refusal that keeps the friendship intact'],
 ['flustered','goes red, overthanks, escapes as soon as polite']
]);

export const SPACE=described([
 ['touchy','hugs on greeting, drapes over furniture and friends'],
 ['close','stands nearer than average, touches to emphasize'],
 ['situational','distance follows trust; the change is readable'],
 ['arm-s-length','default personal bubble; contact is a decision'],
 ['untouchable','contact startles them; even a friendly hand on the shoulder']
]);

const ENUMS={archetype:ARCHETYPES,living:LIVING,formality:FORMALITY,humour:HUMOUR,directness:DIRECTNESS,teasing:TEASING,initiation:INITIATION,pace:PACE,unwelcome:UNWELCOME,space:SPACE};

// Section metadata: key, UI label, one-line explanation, and which fields are enums vs line lists vs prose.
export const PROFILE_SECTIONS=[
 {key:'everyday',label:'Everyday life',blurb:'The life that exists when the player is not in the room: where they live, who they see, what the week actually contains. Feeds schedules, gifts and small talk.',fields:{living:['enum','Living situation'],circle:['lines','Social circle — named people and what ties them'],leisure:['lines','Leisure interests a player could join or ask about'],habits:['lines','Everyday habits, practical and personal'],concerns:['lines','Practical concerns that occupy them (money, deadlines, family)']}},
 {key:'persona',label:'Personality',blurb:'The archetype, the presented self versus the private one, and the contradiction that keeps them human. Flaws and mechanical traits stay in their existing fields.',fields:{archetype:['enum','Broad archetype'],public:['prose','Public persona'],private:['prose','Private behaviour when the guard drops'],strengths:['lines','Strengths'],insecurities:['lines','Insecurities'],pride:['prose','What they are proud of'],contradictions:['lines','Contradictions — kept deliberately']}},
 {key:'voice',label:'Voice',blurb:'How they sound, not what they say: register, humour, directness, teasing. Tics and pet phrases live in the Speech profile; nothing here is compulsory per line.',fields:{formality:['enum','Formality'],humour:['enum','Humour'],directness:['enum','Directness'],teasing:['enum','Teasing style'],vocabulary:['prose','Vocabulary notes — pet topics, borrowed words, what they never say here']}},
 {key:'romance',label:'Romantic behaviour',blurb:'How attention is shown, invited, discouraged and received. Authoring guidance only: attraction scores, permission and consent stay engine-controlled in the dating modules.',fields:{shows:['lines','How they show interest without saying it'],attractedBy:['lines','What genuinely attracts them'],discouragedBy:['lines','What discourages them'],initiation:['enum','Comfort with initiating'],pace:['enum','Preferred pace'],compliments:['prose','How they receive compliments'],unwelcome:['enum','Receiving unwanted attention'],close:['prose','How they behave once close']}},
 {key:'body',label:'Physical expression',blurb:'Posture, space and the small tells attention produces. These are possibilities the scene may pick up — never gestures required every turn.',fields:{posture:['prose','Default posture and bearing'],tells:['lines','Meaningful habits and tells'],space:['enum','Personal space'],attention:['prose','How their body changes when attention is on someone']}},
 {key:'scenes',label:'Scene material',blurb:'Small wants, problems and unfinished matters that can carry a scene without a plot. Shared activities should name things in this world when possible.',fields:{problems:['lines','Current small problems'],shared:['lines','Activities they might invite someone into'],invitations:['lines','Open invitations they could make'],unfinished:['lines','Unfinished matters with other people']}}
];
export const PROFILE_SECTION_KEYS=Object.freeze(PROFILE_SECTIONS.map(s=>s.key));

// The shape a new profile starts in; every list editable as chips with custom values.
export const emptyProfile=()=>({everyday:{living:'',circle:[],leisure:[],habits:[],concerns:[]},persona:{archetype:'',public:'',private:'',strengths:[],insecurities:[],pride:'',contradictions:[]},voice:{formality:'',humour:'',directness:'',teasing:'',vocabulary:''},romance:{shows:[],attractedBy:[],discouragedBy:[],initiation:'',pace:'',compliments:'',unwelcome:'',close:''},body:{posture:'',tells:[],space:'',attention:''},scenes:{problems:[],shared:[],invitations:[],unfinished:[]}});

const LINES={everyday:['circle','leisure','habits','concerns'],persona:['strengths','insecurities','contradictions'],romance:['shows','attractedBy','discouragedBy'],body:['tells'],scenes:['problems','shared','invitations','unfinished']};
const PROSE={persona:['public','private','pride'],voice:['vocabulary'],romance:['compliments','close'],body:['posture','attention']};
const clean=v=>typeof v==='string'?v.trim():'';
const lines=v=>(Array.isArray(v)?v:typeof v==='string'&&v.trim()?[v]:[]).flatMap(x=>typeof x==='string'?x.split(/\n|,/):[]).map(clean).filter(Boolean);

/** Validates and clamps one profile; `fail(message)` decides whether bad input throws or is collected. */
export function validateProfileShape(profile,fail){
 if(!profile||typeof profile!=='object'||Array.isArray(profile))return fail('profile: expected an object');
 for(const [key,enumDef] of [['persona','archetype'],['everyday','living'],['voice','formality'],['voice','humour'],['voice','directness'],['voice','teasing'],['romance','initiation'],['romance','pace'],['romance','unwelcome'],['body','space']]){
  const v=clean(profile[key]?.[enumDef]);
  if(v&&!(ENUMS[enumDef].values.includes(v)))fail(`profile.${key}.${enumDef}: "${v}" is not in the ${enumDef} vocabulary`);
 }
 for(const [section,fields] of Object.entries(LINES))for(const f of fields){
  const list=lines(profile[section]?.[f]);
  if(list.length>6)fail(`profile.${section}.${f}: at most 6 entries`);
  if(list.some(x=>x.length>160))fail(`profile.${section}.${f}: entries at most 160 characters`);
 }
 for(const [section,fields] of Object.entries(PROSE))for(const f of fields)if(clean(profile[section]?.[f]).length>300)fail(`profile.${section}.${f}: at most 300 characters`);
}

const failThrows=message=>{throw Error(message);};
/** Normalizes raw authoring or model output into a valid profile; throws on unknown enum values. */
export function normalizeProfile(raw){
 const base=emptyProfile();
 for(const section of PROFILE_SECTION_KEYS){const x=raw?.[section]??{},t=base[section],fields=PROFILE_SECTIONS.find(s=>s.key===section).fields;
  for(const [f,[kind]] of Object.entries(fields))t[f]=kind==='enum'?clean(x[f]):kind==='lines'?lines(x[f]).slice(0,6).map(s=>s.slice(0,160)):clean(x[f]).slice(0,300);
 }
 validateProfileShape(base,failThrows);
 return base;
}

/** Soft contradiction flags for deliberate-complexity review; never blocks saving. */
export function profileWarnings(profile){
 const p=profile||{},out=[],w=(key,text)=>out.push({key,text});
 const a=p.persona?.archetype,v=p.voice||{},r=p.romance||{},b=p.body||{};
 if(['playful-tease','magnetic-flirt'].includes(a)&&v.teasing==='none')w('voice.teasing','A tease or flirt archetype with no teasing at all — keep only if the distance is the point.');
 if(a==='guarded-loner'&&r.initiation==='makes-moves')w('romance.initiation','A guarded loner who makes the first move is a strong choice; make sure `private` explains it.');
 if(a==='gentle-grump'&&(v.humour==='goofy'||v.humour==='teasing'))w('voice.humour','A grump with goofy humour is a real person, but confirm the archetype is not fighting the voice.');
 if(b.space==='untouchable'&&r.initiation==='makes-moves')w('body.space','Untouchable personal space with bold initiation contradicts unless the gap between them is the character.');
 if(v.formality==='stiff'&&v.humour==='goofy')w('voice.humour','Stiff formality with goofy humour reads as a deliberate clash — keep it intentional.');
 if(a==='playful-tease'&&r.pace==='slow'&&r.unwelcome==='flustered')w('romance','A flirt who is slow to commit and flustered by attention back is coherent only if the flirting is armour; say so in `private`.');
 return out;
}

/** Selective regeneration merge: replaces only the given sections of `current` with the patch's, validating both. */
export function mergeProfileSections(current,patch,sections){
 const base=normalizeProfile(current||{}),next=structuredClone(base);
 for(const s of sections)if(patch?.[s]!==undefined)next[s]=normalizeProfile({[s]:patch[s]})[s]||emptyProfile()[s];
 return normalizeProfile(next);
}
