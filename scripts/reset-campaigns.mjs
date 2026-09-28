import {fileURLToPath} from 'node:url';
import {Store} from '../packages/persistence/store.mjs';
export function resetCampaigns({dbPath,apply=false,log=console.log}={}){
  const store=new Store(dbPath);const campaigns=store.list();
  if(!campaigns.length){log('No campaigns found.');store.close();return {campaigns,deleted:false};}
  log(`Found ${campaigns.length} campaign(s):`);for(const c of campaigns)log(`  ${c.id} (revision ${c.revision})`);
  if(!apply){log('\nDry run only — nothing deleted. Re-run with --apply to permanently delete all campaigns, backups, and recovery backups.');store.close();return {campaigns,deleted:false};}
  store.db.exec('DELETE FROM campaigns;DELETE FROM backups;DELETE FROM recovery_backups;VACUUM;');
  log(`\nDeleted ${campaigns.length} campaign(s) and all associated backups.`);store.close();return {campaigns,deleted:true};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  resetCampaigns({dbPath:fileURLToPath(new URL('../data/campaigns.sqlite',import.meta.url)),apply:process.argv.includes('--apply')});
}
