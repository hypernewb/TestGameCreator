// Studio-only: turns Wizard data-URI artwork into uploaded project media before the player contract validates the export.
import {validateFrame as wizardArt} from '../vn_ui_studio/model.mjs';
import {artCarriers,uiArtPath} from './ui-art.mjs';
// Studio import: each Wizard data URI is checked with the Wizard's own validator, SVG is rasterised to PNG, then uploaded once per distinct URI.
export async function embedWizardArt(raw,{upload,rasterize=rasterizeSvg}){
 const data=typeof raw==='string'?JSON.parse(raw):structuredClone(raw),found=artCarriers(data?.config).filter(([o,k])=>o[k].startsWith('data:'));if(!found.length)return {raw:data,count:0};
 const seen=new Map();for(const [o,k,ref] of found){const uri=o[k];if(!seen.has(uri)){try{wizardArt(uri);}catch(e){throw Error(ref+': '+e.message);}const path=await upload(uri.startsWith('data:image/svg+xml;')?await rasterize(uri):uri);if(!uiArtPath(path))throw Error(ref+': artwork upload failed.');seen.set(uri,path);}o[k]=seen.get(uri);}
 return {raw:data,count:seen.size};
}
// Decoded from a blob: URL (Studio CSP allows img-src blob:, not data:, and connect-src forbids fetching data:); the Wizard validator already refused scripts and external refs.
export async function rasterizeSvg(uri,{doc=globalThis.document,size=512}={}){
 const [head,body='']=uri.split(','),text=/;base64$/.test(head)?new TextDecoder().decode(Uint8Array.from(atob(body),c=>c.charCodeAt(0))):decodeURIComponent(body),src=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'})),img=new Image();
 try{img.src=src;try{await img.decode();}catch{throw Error('SVG artwork could not be decoded.');}const w=Math.min(2048,img.naturalWidth||size),h=Math.min(2048,img.naturalHeight||size),c=doc.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);return c.toDataURL('image/png');}finally{URL.revokeObjectURL(src);}
}
