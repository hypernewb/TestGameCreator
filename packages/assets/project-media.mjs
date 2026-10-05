import {inflateSync} from 'node:zlib';
import {assert} from '../core/engine.mjs';
import {uiMediaReferences} from '../../public/ui-art.mjs';

export const projectMediaPath=path=>typeof path==='string'&&/^scenario-media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path);
export function mediaReferences(pack){return [...(pack?.locations||[]).filter(l=>l.background).map((l,i)=>({ref:`locations.${l.id||i}.background`,path:l.background})),...(pack?.actors||[]).flatMap((a,i)=>[...(a.portrait?[{ref:`actors.${a.id||i}.portrait`,path:a.portrait}]:[]),...(a.idleAnimation?[{ref:`actors.${a.id||i}.idleAnimation`,path:a.idleAnimation}]:[]),...(a.idleStill?[{ref:`actors.${a.id||i}.idleStill`,path:a.idleStill}]:[]),...(a.poses||[]).map((p,j)=>({ref:`actors.${a.id||i}.poses.${p.id||j}.image`,path:p.image}))]),...uiMediaReferences(pack)];}
const dimensions=(w,h)=>assert(w>0&&h>0&&w<=8192&&h<=8192&&w*h<=40000000,'Image dimensions exceed the existing preparation limits');
function pngStructure(bytes){
 let pos=8,header=null,ended=false,data=[],palette=false,afterData=false;
 while(pos<bytes.length){assert(pos+12<=bytes.length,'PNG: truncated chunk');const n=bytes.readUInt32BE(pos),type=bytes.toString('ascii',pos+4,pos+8),end=pos+12+n;assert(end<=bytes.length&&/^[A-Za-z]{4}$/.test(type),'PNG: invalid chunk');const b=bytes.subarray(pos+8,pos+8+n);
  if(!header){assert(type==='IHDR'&&n===13,'PNG: IHDR required');const w=b.readUInt32BE(0),h=b.readUInt32BE(4),depth=b[8],color=b[9];dimensions(w,h);assert(({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]})[color]?.includes(depth)&&b[10]===0&&b[11]===0&&b[12]<=1,'PNG: invalid header');header={w,h,depth,color,interlace:b[12]};}
  else if(type==='IHDR')throw Error('PNG: duplicate IHDR');
  else if(type==='PLTE'){assert(!data.length&&!palette&&n>0&&n%3===0&&n<=768,'PNG: invalid palette');palette=true;}
  else if(type==='IDAT'){assert(!afterData,'PNG: noncontiguous image data');data.push(b);}
  else if(type==='IEND'){assert(n===0&&end===bytes.length&&data.length,'PNG: invalid end or missing image data');ended=true;pos=end;break;}
  else {assert(type[0]===type[0].toLowerCase(),'PNG: unknown critical chunk');if(data.length)afterData=true;}pos=end;
 }
 assert(header&&ended&&(header.color!==3||palette),'PNG: incomplete image');const {w,h,depth,color,interlace}=header,channels=({0:1,2:3,3:1,4:2,6:4})[color],passes=interlace?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]],rows=passes.map(([x,y,dx,dy])=>{const width=Math.max(0,Math.ceil((w-x)/dx)),height=Math.max(0,Math.ceil((h-y)/dy));return {stride:Math.ceil(width*channels*depth/8),height:width?height:0};}),size=rows.reduce((n,r)=>n+(r.stride+1)*r.height,0);let raw;try{raw=inflateSync(Buffer.concat(data),{maxOutputLength:size+1});}catch{throw Error('PNG: invalid compressed image data');}assert(raw.length===size,'PNG: invalid pixel data length');let at=0;for(const r of rows)for(let y=0;y<r.height;y++){assert(raw[at]<=4,'PNG: invalid row filter');at+=r.stride+1;}
}
function jpegStructure(bytes){
 let pos=2,frame=false,scan=false,entropy=false,quant=false,huffman=false,components=[],frameMarker=0;
 while(pos<bytes.length){assert(bytes[pos++]===255,'JPEG: invalid marker');while(bytes[pos]===255)pos++;const marker=bytes[pos++];if(marker===217){assert(frame&&scan&&entropy&&pos===bytes.length,'JPEG: incomplete image');return;}assert(marker!==216&&marker!==0&&!(marker>=208&&marker<=215)&&pos+2<=bytes.length,'JPEG: invalid marker');const n=bytes.readUInt16BE(pos),end=pos+n;assert(n>=2&&end<=bytes.length,'JPEG: truncated segment');const b=bytes.subarray(pos+2,end);
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){assert(!frame&&b.length>=6&&b[5]>0&&b[5]<=4&&n===8+3*b[5],'JPEG: invalid frame');dimensions(b.readUInt16BE(3),b.readUInt16BE(1));assert([8,12,16].includes(b[0]),'JPEG: invalid precision');components=Array.from({length:b[5]},(_,i)=>b[6+3*i]);assert(new Set(components).size===components.length,'JPEG: duplicate frame component');frameMarker=marker;frame=true;}
  if(marker===219){let at=0;while(at<b.length){const table=b[at++];assert((table>>4)<=1&&(table&15)<=3,'JPEG: invalid quantization table');at+=64*((table>>4)+1);assert(at<=b.length,'JPEG: truncated quantization table');}assert(at>0,'JPEG: empty quantization table');quant=true;}
  if(marker===196){let at=0;while(at<b.length){assert(at+17<=b.length&&(b[at]>>4)<=1&&(b[at]&15)<=3,'JPEG: invalid Huffman table');const count=b.subarray(at+1,at+17).reduce((n,v)=>n+v,0);assert(count>0&&count<=256,'JPEG: invalid Huffman symbol count');at+=17+count;assert(at<=b.length,'JPEG: truncated Huffman table');}assert(at>0,'JPEG: empty Huffman table');huffman=true;}
  if(marker===218){assert(frame&&b.length>=4&&b[0]>0&&b[0]<=4&&n===6+2*b[0],'JPEG: invalid scan');assert(Array.from({length:b[0]},(_,i)=>b[1+2*i]).every(id=>components.includes(id)),'JPEG: unknown scan component');assert([195,199,203,207].includes(frameMarker)||quant,'JPEG: missing quantization table');assert(frameMarker>=201||huffman,'JPEG: missing Huffman table');scan=true;pos=end;let count=0;while(pos<bytes.length){if(bytes[pos]!==255){pos++;count++;continue;}if(bytes[pos+1]===0){pos+=2;count++;continue;}if(bytes[pos+1]>=208&&bytes[pos+1]<=215){pos+=2;continue;}break;}assert(count>0,'JPEG: empty image scan');entropy=true;continue;}pos=end;
 }throw Error('JPEG: missing end of image');
}
function webpStructure(bytes){assert(bytes.length>=20&&bytes.readUInt32LE(4)+8===bytes.length,'WebP: incomplete RIFF');let pos=12,image=false;while(pos<bytes.length){assert(pos+8<=bytes.length,'WebP: truncated chunk');const type=bytes.toString('ascii',pos,pos+4),n=bytes.readUInt32LE(pos+4),end=pos+8+n;assert(end<=bytes.length,'WebP: truncated image');if(type==='VP8 '||type==='VP8L'||type==='ANMF'){assert(n>(type==='VP8 '?10:type==='VP8L'?5:16),'WebP: incomplete image data');image=true;}pos=end+(n%2);}assert(pos===bytes.length&&image,'WebP: missing image data');}

export function imageInfo(bytes,type){
 if(type==='png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.length>=33){
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],color=bytes[25];let offset=8;const data=[];
  while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset),name=bytes.toString('ascii',offset+4,offset+8);if(offset+12+length>bytes.length)return null;if(name==='IDAT')data.push(bytes.subarray(offset+8,offset+8+length));if(name==='IEND')break;offset+=12+length;}
  let transparent=false;
  if(depth===8&&color===6&&width*height<=1600000){const raw=inflateSync(Buffer.concat(data)),stride=width*4;if(raw.length>=(stride+1)*height){let previous=Buffer.alloc(stride),cursor=0;
   for(let y=0;y<height&&!transparent;y++){const filter=raw[cursor++],row=Buffer.from(raw.subarray(cursor,cursor+stride));cursor+=stride;
    for(let x=0;x<stride;x++){const left=x>=4?row[x-4]:0,up=previous[x],upperLeft=x>=4?previous[x-4]:0;if(filter===1)row[x]=(row[x]+left)&255;else if(filter===2)row[x]=(row[x]+up)&255;else if(filter===3)row[x]=(row[x]+Math.floor((left+up)/2))&255;else if(filter===4){const p=left+up-upperLeft,pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-upperLeft),predictor=pa<=pb&&pa<=pc?left:pb<=pc?up:upperLeft;row[x]=(row[x]+predictor)&255;}else if(filter!==0)return null;}
    for(let x=3;x<stride;x+=4)if(row[x]<255){transparent=true;break;}previous=row;
   }
  }}return {width,height,alpha:transparent};
 }
 if(type==='jpeg'&&bytes[0]===255&&bytes[1]===216){let i=2;while(i+9<bytes.length){if(bytes[i]!==255){i++;continue;}while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;if([1,216,217,...Array.from({length:8},(_,n)=>208+n)].includes(marker))continue;const size=bytes.readUInt16BE(i);if(size<2||i+size>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {width:bytes.readUInt16BE(i+5),height:bytes.readUInt16BE(i+3),alpha:false};i+=size;}}
 return null;
}
export function validateImage(data,kind){
 assert(typeof data==='string'&&data.length<=4900000,'Image is too large (maximum 3.5 MB)');const match=data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);assert(match,'Use a PNG, JPEG, or WebP image');const type=match[1],bytes=Buffer.from(match[2],'base64');assert(bytes.length>0&&bytes.length<=3500000,'Image is too large (maximum 3.5 MB)');const signature=type==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';assert(signature,'Image content does not match its file type');({png:pngStructure,jpeg:jpegStructure,webp:webpStructure})[type](bytes);const info=imageInfo(bytes,type);
 if(kind==='background')assert(type==='jpeg'&&info?.width===1920&&info?.height===1080,'Backgrounds must be prepared as 1920 × 1080 landscape images (16:9).');else if(kind==='character')assert(type==='png'&&info?.width===1024&&info?.height===1536&&info.alpha,'Character art must be a transparent PNG on a 1024 × 1536 canvas.');else if(kind==='animation')assert(type==='webp','Idle animations must be WebP images.');else assert(!kind,'Unknown image type');return {bytes,type,info};
}
export function validateProjectMedia(pack,{read,media}={}){
 const refs=mediaReferences(pack).filter(r=>typeof r.path==='string'&&r.path.startsWith('scenario-media/')),checked=new Map();assert(media===undefined||media&&typeof media==='object'&&!Array.isArray(media),'Project media must be an object');
 const check=(path,asset)=>{assert(projectMediaPath(path),'Invalid project asset path');if(asset!==undefined){assert(asset&&typeof asset.mime==='string'&&typeof asset.data==='string','Embedded media requires mime and data');const expected=path.endsWith('.jpg')?'image/jpeg':path.endsWith('.png')?'image/png':'image/webp';assert(asset.mime===expected,'Embedded image MIME does not match its path');validateImage(`data:${asset.mime};base64,${asset.data}`);}else {assert(read,'Referenced upload is missing');const type=path.endsWith('.jpg')?'jpeg':path.endsWith('.png')?'png':'webp';validateImage(`data:image/${type};base64,${read(path).toString('base64')}`);}checked.set(path,true);};
 for(const r of refs)try{if(!checked.has(r.path))check(r.path,Object.hasOwn(media||{},r.path)?media[r.path]:undefined);}catch(e){throw Error(`${r.ref.slice(0,120)}: ${String(r.path).slice(0,120)}: ${e.message}`);}
 for(const [path,asset] of Object.entries(media||{}))if(!checked.has(path))try{check(path,asset);}catch(e){throw Error(`media.${String(path).slice(0,120)}: ${e.message}`);}return refs;
}
