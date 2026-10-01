// One appended JSON line per evaluation run (fun gate or prompt A/B), so week-over-week trend is a grep over
// artifacts/testing-ledger.jsonl instead of an exercise in memory. Best-effort: never fail a run over the ledger.
import {appendFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
export function appendLedger(root,entry){
 try{const file=resolve(root,'artifacts/testing-ledger.jsonl');mkdirSync(dirname(file),{recursive:true});
  appendFileSync(file,JSON.stringify({date:new Date().toISOString(),...entry})+'\n');}catch{}
}
