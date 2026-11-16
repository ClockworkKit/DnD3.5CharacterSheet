import type {Character} from './model.ts';
import {alternateClassLevel,classFeatureLevel} from './alternate-features.ts';
import {characterGestaltRows} from './gestalt-progression.ts';
import {clericChannelState} from './cleric-channel.ts';

type Feature=Character['features'][number];
type Kind='turn'|'rebuke'|'unknown';
export const coreTurningId='daily:Turn or rebuke undead';
type Source={ruleId:string;classId:string;name:string;delay:number;kind:Kind;active:boolean};

/** Explicit identities, never guesses from editable card names. */
function sources(c:Character):Source[]{
 const out:Source[]=[];
 const add=(classId:string,name:string,ruleId:string,delay:number,kind:Kind,feature:string)=>{
  if(alternateClassLevel(c,classId)>delay)out.push({classId,name,ruleId,delay,kind,active:classFeatureLevel(c,classId,feature)>delay});
 };
 const channel=clericChannelState(c).channel;
 add('cleric','Cleric',coreTurningId,0,channel==='cure'?'turn':channel==='inflict'?'rebuke':'unknown','turn-undead');
 add('paladin','Paladin',coreTurningId,3,'turn','turn-undead');
 add('blackguard','Blackguard','daily:Command undead',2,'rebuke','command-undead');
 add('dread-necromancer','Dread Necromancer','supp:dread-necromancer:Rebuke undead',0,'rebuke','rebuke-undead');
 add('death-master','Death Master','supp:death-master:Rebuke undead',0,'rebuke','rebuke-undead');
 // One legacy core card cannot assign its expenditure between opposite channels.
 const core=out.filter(s=>s.ruleId===coreTurningId);
 if(new Set(core.map(s=>s.kind)).size>1)for(const s of core)s.kind='unknown';
 return out;
}

export function turningResourceKind(c:Character,f:Feature):Kind|null{
 if(f.ruleId){
  const rows=sources(c).filter(s=>s.ruleId===f.ruleId&&s.active);
  return rows.length?rows[0].kind:null;
 }
 // Preserve support for explicitly entered/manual legacy resources.
 if(/^(rebuke|command) undead/i.test(f.name))return 'rebuke';
 if(/^turn undead/i.test(f.name))return 'turn';
 return /^turn or rebuke undead/i.test(f.name)?'unknown':null;
}

function groups(c:Character){
 if(c.advancementMode!=='gestalt'||!c.automation.enabled||c.gestaltTurningPools==='independent')return [];
 const rows=characterGestaltRows(c)!,all=sources(c);
 return (['turn','rebuke'] as const).flatMap(kind=>{
  const members=all.filter(s=>s.kind===kind),active=members.filter(s=>s.active);
  const ruleIds=[...new Set(members.map(s=>s.ruleId))],activeRuleIds=[...new Set(active.map(s=>s.ruleId))];
  if(ruleIds.length<2||!active.length)return [];
  // Nonoverlapping eligible levels accrue; simultaneous advancement counts once.
  const baseLevel=rows.reduce((n,row)=>n+Number([row.left,row.right].some(side=>active.some(s=>s.classId===side.classId&&side.classLevel>s.delay))),0);
  return [{kind,label:kind==='turn'?'Shared turn undead':'Shared rebuke undead',members,active,ruleIds,activeRuleIds,baseLevel}];
 });
}

/** Shared advancement without coupling calculations to whether a card exists yet. */
export function sharedTurningBaseLevel(c:Character,ruleId:string,fallback:number){
 return groups(c).find(g=>g.activeRuleIds.includes(ruleId))?.baseLevel??fallback;
}

/** Read-only pool view: retain every source card, including replaced expenditure.
 * Class-specific stored maxima are references; the best active limit applies once.
 * No loading migration, duplicated mirror counter, or automatic expenditure reset.
 */
export function sharedTurningPools(c:Character){
 return groups(c).map(g=>{
  const activeCards=c.features.filter(f=>g.activeRuleIds.includes(f.ruleId??''));
  const records=[...new Map([...c.features,...c.retiredResources??[]].filter(f=>g.ruleIds.includes(f.ruleId??'')).map(f=>[f.id,f])).values()];
  const retained=g.ruleIds.filter(id=>!records.some(f=>f.ruleId===id)).reduce((n,id)=>n+(c.alternateFeatures.uses['retained:'+id]??0),0);
  const used=records.reduce((n,f)=>n+f.used,retained),max=Math.max(0,...activeCards.map(f=>f.max));
  return {...g,activeCards,records,used,max,remaining:Math.max(0,max-used)};
 });
}
export function featureUseNumbers(c:Character,f:Feature){
 const recognized=f.ruleId===coreTurningId||f.ruleId==='daily:Command undead'||f.ruleId==='supp:dread-necromancer:Rebuke undead'||f.ruleId==='supp:death-master:Rebuke undead';
 const shared=recognized?sharedTurningPools(c).find(g=>g.activeCards.some(card=>card.id===f.id)):undefined;
 return shared?{max:shared.max,used:shared.used,remaining:shared.remaining,shared}:{max:f.max,used:f.used,remaining:Math.max(0,f.max-f.used),shared:undefined};
}
export function spendTrackedFeature(c:Character,id:string,cost=1){
 const f=c.features.find(f=>f.id===id);
 if(!f||!Number.isInteger(cost)||cost<1||cost>10000||f.used+cost>10000||featureUseNumbers(c,f).remaining<cost)throw new Error('Not enough uses remain for this resource.');
 f.used+=cost;
}
export function sharedTurningWarnings(c:Character){
 if(c.advancementMode!=='gestalt'||!c.automation.enabled||c.gestaltTurningPools==='independent')return [];
 const all=sources(c),active=all.filter(s=>s.active);
 if(!active.some(s=>s.kind==='unknown')||active.length<2)return [];
 return ['Turning/rebuking overlap needs review: record the Cleric channel in Combat or Magic using the character and deity rules. If one legacy core counter represents both positive turning and negative rebuking, review its allocation with the GM. Unresolved sources remain separate; no channel or spent-use allocation is inferred.'];
}
