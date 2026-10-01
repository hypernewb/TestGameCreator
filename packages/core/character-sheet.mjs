// Shared with the browser editor, like the core calendar contract.
export {TRAITS,GIFT_CATEGORIES,EXPERIENCE,REGIONS,SHEET_TABS,createSheet,importCharacterSheet,validateCharacterSheets,saveSheets,loadSheets,resolveLimit,giftTaste} from '../../public/sheet-editor.mjs';
export const bodyRegionOf=(pack,character,region)=>(pack.characterSheets||[]).find(s=>s.actorId===character)?.dating?.body?.[region]||{limit:null,sensitivity:null};
