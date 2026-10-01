// Reader for the earned Lust floor owned by social.touch-ladder (packages/modules/touch-ladder.mjs): absent pack field = no baseline, no hint.
export const lustBaselineOf=(s,p,id)=>p.lustBaseline?{baseline:s.modules['social.touch-ladder']?.characters?.[id]?.lustBaseline||0,milestones:s.modules['social.touch-ladder']?.characters?.[id]?.lustMilestones||[]}:null;
// Vague only: no number, no milestone name.
export const lustBaselineHint=(s,p,id)=>{const runtime=lustBaselineOf(s,p,id);return runtime&&runtime.baseline>0?p.lustBaseline.hint||'':'';};