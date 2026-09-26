import {clone,assert} from '../core/engine.mjs';
// Migrations are trusted developer code, not executable content from save files.
// No historical production migrations are registered in v0.1.
export function migrateSave(original,targetVersion,steps,backup){
  assert(typeof backup==='function','A backup writer is required');
  backup(clone(original));
  let next=clone(original),count=0;
  while(next.version!==targetVersion){assert(++count<=20,'Migration chain too long');const step=steps[next.version];assert(typeof step==='function',`No migration from save version ${next.version}`);const previous=next.version;next=step(clone(next));assert(next&&Number.isInteger(next.version)&&next.version>previous,'Migration did not advance version');assert(next.version<=targetVersion,'Migration overshot target');}
  return next;
}
