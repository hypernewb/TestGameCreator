// Matches ComfyUI SaveImage output files (`<prefix>_00001_.png`) to manifest asset ids.
const FILE_RE=/^(.+)_(\d+)_\.(png|jpg|jpeg|webp)$/i;

export function planSync({ids,files}){
  const byId=new Map(ids.map(id=>[id,null]));
  for(const file of files){
    const m=FILE_RE.exec(file);if(!m)continue;
    const [,prefix,counter,ext]=m;if(!byId.has(prefix))continue;
    const n=Number(counter),current=byId.get(prefix);
    if(!current||n>current.counter)byId.set(prefix,{file,counter:n,ext:ext.toLowerCase()});
  }
  const matched=[...byId.entries()].filter(([,v])=>v).map(([id,v])=>({id,file:v.file,ext:v.ext}));
  const missing=[...byId.entries()].filter(([,v])=>!v).map(([id])=>id);
  return {matched,missing};
}
