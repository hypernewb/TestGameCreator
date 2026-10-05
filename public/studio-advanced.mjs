import {mountSystems} from './studio-systems.mjs';
import {advancedSpecs,advancedTarget,editAdvanced} from './creator-advanced-contract.mjs';
export function mountAdvanced(parent,options){return mountSystems(parent,{...options,scope:'advanced',specs:advancedSpecs,targetOf:advancedTarget,initial:(p,key)=>structuredClone(advancedSpecs(p)[key]?.defaults||{}),edit:editAdvanced});}
