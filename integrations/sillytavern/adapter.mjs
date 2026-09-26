import {intentMessages,narrativeMessages,parseIntent} from '../../packages/ai/providers.mjs';
import {daypartMessages,validateDaypart} from '../../packages/ai/daypart.mjs';
// Original adapter. Does not import or redistribute SillyTavern source.
export class SillyTavernProvider {
  name='SillyTavern';
  constructor(getContext=()=>globalThis.SillyTavern.getContext()){this.getContext=getContext;}
  async call(messages,signal){if(signal?.aborted)throw new Error('Cancelled');const raw=this.getContext().generateRaw({prompt:messages});let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('SillyTavern timeout')),30000);});try{const result=await Promise.race([raw,timeout]);if(signal?.aborted)throw new Error('Cancelled');return result;}finally{clearTimeout(timer);}}
  async interpret(input,context,available,signal){return parseIntent(await this.call(intentMessages(input,context,available),signal),available);}
  async narrate(context,signal){return this.call(narrativeMessages(context),signal);}
  async generateDaypart(context,signal){return validateDaypart(await this.call(daypartMessages(context),signal),context);}
}
