import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {registry} from '../packages/modules/index.mjs';
import {runDeterministicPlaytest} from '../packages/testing/playtest-audit.mjs';

const arg=(name,fallback)=>{const at=process.argv.indexOf(`--${name}`);return at<0?fallback:process.argv[at+1];};
const file=resolve(arg('pack','packs/neutral.json')),turns=Number(arg('turns','50')),seed=Number(arg('seed','42'));
const pack=JSON.parse(readFileSync(file,'utf8')),result=runDeterministicPlaytest(pack,registry,{turns,seed});
console.log(`${pack.id}: ${result.report.turns} turns · ${result.report.summary.critical} critical · ${result.report.summary.warnings} warnings · ${result.report.summary.info} info`);
for(const finding of result.report.findings)console.log(`[${finding.severity.toUpperCase()}] ${finding.code}: ${finding.message}`);
process.exitCode=result.report.summary.critical?1:0;
