// Curated list of modern warm-VN art assets and their ComfyUI generation jobs.
export const BACKGROUND_SIZE={width:1920,height:1080};
export const PORTRAIT_SIZE={width:1024,height:1536};
const STYLE='contemporary visual novel illustration, warm rustic palette, aged cream, terracotta, walnut brown and muted brass, clean painted linework, soft natural light';
const NEGATIVE_BG='text, watermark, logo, blurry, photorealistic photograph, people, characters, sci-fi interface, neon, pixel art, fisheye, dutch angle';
const NEGATIVE_PORTRAIT='text, watermark, logo, blurry, background, cropped hair, cropped hands, extra fingers, extra limbs, deformed hands, neon, pixel art, chibi';
const bg=(id,name,scene)=>({id,kind:'background',name,prompt:`${STYLE}, ${scene}, no people`,negative:NEGATIVE_BG,...BACKGROUND_SIZE,placeholder:`assets/${id}.svg`});
const portrait=(id,name,scene)=>({id,kind:'portrait',name,prompt:`${STYLE}, adult character sprite from head to knees, ${scene}, front three-quarter view, transparent background, consistent canvas and eye line`,negative:NEGATIVE_PORTRAIT,...PORTRAIT_SIZE,placeholder:`assets/${id}.svg`});

export const ASSET_MANIFEST=[
  bg('hub','Hub','bright administrative hall with tall windows and late afternoon light'),
  bg('workshop','Workshop','cluttered maker workshop with a workbench, tools, and an open notebook, warm interior light'),
  bg('meeting','Meeting Room','small meeting room with a circular table and three chairs, dramatic diagonal shadows'),
  bg('sanctuary','Sanctuary','quiet glowing chamber with a well of light and an arched doorway, mystical calm atmosphere'),
  bg('threshold','Threshold','a lattice of pale light blocking a corridor, tense magical barrier'),
  bg('observatory','Observatory','observatory interior with an unfamiliar night sky through a window and a small compass on a table'),
  portrait('ada-neutral','Ada (neutral)','adult woman project coordinator, precise composed expression, tidy practical clothing'),
  portrait('brin-neutral','Brin (neutral)','adult maker, neutral expression, work apron'),
  portrait('brin-smile','Brin (smile)','adult maker, warm open smile, work apron'),
];

export const findAsset=id=>ASSET_MANIFEST.find(a=>a.id===id);

export const workflowFor=(entry,{seed=0,checkpoint='sd_xl_base_1.0.safetensors'}={})=>({
  3:{class_type:'KSampler',inputs:{seed,steps:24,cfg:6,sampler_name:'dpmpp_2m',scheduler:'karras',denoise:1,model:['4',0],positive:['6',0],negative:['7',0],latent_image:['5',0]}},
  4:{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:checkpoint}},
  5:{class_type:'EmptyLatentImage',inputs:{width:entry.width,height:entry.height,batch_size:1}},
  6:{class_type:'CLIPTextEncode',inputs:{text:entry.prompt,clip:['4',1]}},
  7:{class_type:'CLIPTextEncode',inputs:{text:entry.negative,clip:['4',1]}},
  8:{class_type:'VAEDecode',inputs:{samples:['3',0],vae:['4',2]}},
  9:{class_type:'SaveImage',inputs:{filename_prefix:entry.id,images:['8',0]}},
});
