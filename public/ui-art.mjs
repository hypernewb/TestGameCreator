// Wizard artwork contract for the player: art is only ever a project media path (scenario-media/<uuid>.png|jpg|webp, same regex as project-media.mjs and the server's assetFile), served same-origin under CSP img-src 'self'. Wizard data URIs are converted to uploaded media in Studio (ui-art-import.mjs) before validation.
export const uiArtPath=p=>typeof p==='string'&&/^scenario-media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(p);
export const artUrl=p=>uiArtPath(p)?'/'+p:'';
export const iconHref=glyph=>/^[a-z]+$/.test(glyph||'')?'/vn_ui_studio/icons.svg#i-'+glyph:'';
// Every art-carrying field of a Wizard config: [object, key, label].
export function artCarriers(config){
 const out=[],put=(o,k,ref)=>{if(o&&typeof o==='object'&&typeof o[k]==='string'&&o[k])out.push([o,k,ref]);},states=(b,ref)=>{for(const [m,v] of Object.entries(b?.states||{}))put(v,'art',ref+'.states.'+m+'.art');};
 for(const [id,a] of Object.entries(config?.appearance||{}))put(a,'frame','appearance.'+id+'.frame');
 for(const [id,u] of Object.entries(config?.utilities||{}))put(u,'asset','utilities.'+id+'.asset');
 for(const [id,b] of Object.entries(config?.buttons||{}))states(b,'buttons.'+id);
 for(const [i,p] of (Array.isArray(config?.presets)?config.presets:[]).entries()){put(p?.appearance,'frame','presets.'+i+'.appearance.frame');states(p?.button,'presets.'+i+'.button');}
 return out;
}
const uiConfigs=pack=>(pack?.gameProject?.ui?.options||[]).map(o=>[o.id,o.skin?.export?.config]).filter(([,c])=>c);
export function uiMediaReferences(pack){return uiConfigs(pack).flatMap(([id,c])=>artCarriers(c).map(([o,k,ref])=>({ref:`gameProject.ui.${id}.${ref}`,path:o[k]})));}
// Rewrites imported media paths (old → new) in place on a cloned pack; unknown paths are left for validation to refuse.
export function remapUiMedia(pack,remap){const next=structuredClone(pack);for(const [,c] of uiConfigs(next))for(const [o,k] of artCarriers(c))if(Object.hasOwn(remap,o[k]))o[k]=remap[o[k]];return next;}
// Player markup: an svg <use> of the shared Wizard sprite (stroke set here: <use> does not inherit the sprite root's presentation attributes), or an <img> of validated project media; never innerHTML.
export function iconNode(doc,{glyph,asset}={}){
 const src=artUrl(asset);if(src){const e=doc.createElement('img');e.className='button-icon';e.src=src;e.alt='';return e;}
 const href=iconHref(glyph);if(!href)return null;const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),use=doc.createElementNS('http://www.w3.org/2000/svg','use');svg.setAttribute('class','game-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');for(const [k,v] of [['fill','none'],['stroke','currentColor'],['stroke-width','1.5'],['stroke-linecap','round'],['stroke-linejoin','round']])svg.setAttribute(k,v);use.setAttribute('href',href);svg.append(use);return svg;
}
// Wizard button content: tools use their utility glyph/asset; shop/map/board/calendar use appearance.icon (auto → own id, none → no icon).
export function buttonIcon(id,w){if(w.utility)return {glyph:w.utility.glyph,asset:w.utility.asset};const c=w.appearance?.icon;return !c||c==='none'?null:{glyph:c==='auto'?(['shop','map','board','calendar'].includes(id)?id:null):c};}
export function fillButton(e,id,w,label){
 const doc=e.ownerDocument,b=w.button,ic=buttonIcon(id,w),icon=b.display!=='label'&&ic?iconNode(doc,ic):null,size=b.iconSize+'px',span=doc.createElement('span');span.className='design-label';span.textContent=label;
 Object.assign(span.style,{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:'0'});if(icon){for(const k of ['width','height'])icon.style[k]=size;icon.style.flex='0 0 '+size;if(icon.tagName.toLowerCase()==='img')icon.style.objectFit='contain';}
 e.replaceChildren(...(icon?[icon]:[]),...(b.display==='icon'&&icon?[]:[span]));e.setAttribute('aria-label',label);e.setAttribute('data-display',b.display);return e;
}
