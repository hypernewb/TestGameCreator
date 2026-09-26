// The model chooses an index; the engine resolves it to a trusted, available action.
export function intentFormat(available){
 const ids=available.filter(a=>a.enabled).map((_,i)=>i);
 return {type:'json_schema',json_schema:{name:'game_action',strict:false,schema:{type:'object',properties:{index:{type:'integer',enum:[-1,...ids]},question:{type:'string'}},required:['index','question']}}};
}

export function daypartFormat(context){
 const count=context.hangoutCandidates.length;
 return {type:'json_schema',json_schema:{name:'daypart_intro',strict:false,schema:{type:'object',properties:{
  lines:{type:'array',items:{type:'string'},minItems:3,maxItems:5},
  hangouts:{type:'array',items:{type:'object',properties:{char:{type:'string',...(count?{enum:context.hangoutCandidates.map(h=>h.char)}:{})},text:{type:'string'},description:{type:'string'}},required:['char','text','description']},minItems:count,maxItems:count},
  breakups:{type:'array',maxItems:0},posts:{type:'array',maxItems:0}
 },required:['lines','hangouts','breakups','posts']}}};
}
