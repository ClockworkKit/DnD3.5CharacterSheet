import type {Character,Feat} from './model.ts';
import {alternateClassLevel,activeAlternateFeatures,alternateSettings,configureAlternateFeature,hasAlternateFeature} from './alternate-features.ts';
import {monkStyles,rangerStyles} from './alternate-styles.ts';
import {equipmentById,equipmentCatalog} from './equipment.ts';
import {featEligibility,featChoices} from './prerequisites.ts';
import catalog from './prerequisite-catalog.json' with {type:'json'};
const clean=(name:string)=>name.replace(/\s*\[[^\]]*\]/g,'').trim();
const identity=(name:string)=>clean(name).toLowerCase();
export const alternateFeatLibrary:Feat[]=catalog.feats.map(f=>({...f,description:'',source:'https://srd.dndtools.org/srd/feats/feats.html'}));
export function selectedMonkStyle(c:Character){return hasAlternateFeature(c,'monk-fighting-styles')?monkStyles.find(s=>identity(s.name)===identity(alternateSettings(c,'monk-fighting-styles').choice)):undefined;}
export function monkStyleBonus(c:Character,name:string){return selectedMonkStyle(c)?.name===name&&alternateClassLevel(c,'monk')>=6&&alternateSettings(c,'monk-fighting-styles').styleQualifiedAtSix;}
export function alternateGrantActive(c:Character,ruleId?:string){
 if(ruleId?.startsWith('acf-grant:')&&!hasAlternateFeature(c,ruleId.split(':')[1]))return false;
 if(!ruleId?.startsWith('acf-grant:ranger-combat-styles:'))return true;
 return !c.gear.some(g=>g.carried&&g.equipped&&g.qty>0&&equipmentById(g.catalogId)?.kind==='armor'&&(['light','medium','heavy'].indexOf(equipmentById(g.catalogId)!.category)-(g.material==='mithral'?1:0))>0);
}
type Grant={featureId:string,slot:string,name:string,choice?:string};
const splitFeat=(text:string)=>{const m=text.match(/^(.*?)\s*\((.*)\)$/);return m?{name:m[1],choice:m[2]}:{name:text};};
export function alternateFeatSlots(c:Character,id:string){
 const level=alternateClassLevel(c,id.split('-')[0]);
 const levels=id==='paladin-holy-warrior'||id==='ranger-champion-of-the-wild'?[4,8,11,14]:id==='soulknife-bonus-feats'?[3,7,11,15,19]:[];
 return levels.filter(l=>l<=level).map(l=>({key:'feat-'+l,level:l}));
}
export function allowedAlternateFeats(c:Character,id:string){
 const pal=['Cleave','Extra Smiting','Extra Turning','Great Cleave','Improved Smiting','Mounted Combat','Mounted Archery','Power Attack','Ride-By Attack','Skill Focus','Spirited Charge','Trample'];
 const ranger=['Blind-Fight','Combat Expertise','Eyes in the Back of Your Head','Improved Disarm','Improved Favored Enemy','Improved Feint','Improved Trip',...(c.automation.rangerStyle==='archery'?['Far Shot','Improved Precise Shot','Improved Rapid Shot','Manyshot','Point Blank Shot','Precise Shot','Ranged Disarm','Ranged Pin','Ranged Sunder','Sharp-Shooting','Shot on the Run']:c.automation.rangerStyle==='two-weapon'?['Greater Two-Weapon Defense','Greater Two-Weapon Fighting','Improved Two-Weapon Defense','Improved Two-Weapon Fighting','Two-Weapon Defense','Weapon Finesse']:[])];
 return alternateFeatLibrary.filter(f=>id==='paladin-holy-warrior'?pal.some(name=>identity(name)===identity(f.name))||f.category==='Divine':id==='ranger-champion-of-the-wild'?ranger.some(name=>identity(name)===identity(f.name)):id==='soulknife-bonus-feats');
}
export function alternateFeatSelectionProblem(c:Character,id:string,key:string,featId:string,choice=''){
 if(!hasAlternateFeature(c,id)||!alternateFeatSlots(c,id).some(s=>s.key===key))return 'This bonus feat is not available at your class level.';
 const feat=allowedAlternateFeats(c,id).find(f=>f.id===featId);if(!feat)return 'Choose a feat permitted by this class feature.';
 if(id==='paladin-holy-warrior'&&feat.id==='skill-focus'&&choice!=='Ride')return 'Holy Warrior allows Skill Focus only for Ride.';
 const candidate={...c,features:c.features.filter(f=>f.ruleId!=='acf-grant:'+id+':'+key)};
 const eligibility=featEligibility(candidate,feat,choice);
 return eligibility.eligible?'':eligibility.requirements.filter(r=>r.state==='missing'||r.state==='confirm'&&!r.confirmed).map(r=>r.label).join('; ');
}
export function selectAlternateBonusFeat(c:Character,id:string,key:string,featId:string,choice=''){
 if(featId){const problem=alternateFeatSelectionProblem(c,id,key,featId,choice);if(problem)throw new Error(problem);}
 const rules={...alternateSettings(c,id).rules};rules[key]=featId;rules[key+'-choice']=choice;
 configureAlternateFeature(c,id,{rules});syncAlternateFeatGrants(c);
}
export function alternateWeaponChoices(id:string){return equipmentCatalog.filter(e=>e.kind==='weapon'&&(id!=='sorcerer-stalwart-sorcerer'||e.category==='martial'&&!e.ranged)).map(e=>e.name);}
export function alternateGrantedFeats(c:Character):Grant[]{
 const out:Grant[]=[];
 const add=(featureId:string,slot:string,text:string,choice?:string)=>out.push({featureId,slot,...splitFeat(text),...(choice?{choice}:{})});
 for(const d of activeAlternateFeatures(c)){
  const lv=alternateClassLevel(c,d.classId),s=alternateSettings(c,d.id);
  if(d.id==='monk-fighting-styles'){const style=selectedMonkStyle(c);if(style)style.feats.forEach((name,i)=>{if(lv>=[1,2,6][i]&&(!['Weapon Focus','Weapon Specialization'].includes(name)||alternateWeaponChoices(d.id).includes(s.rules.weapon)))add(d.id,'style-'+[1,2,6][i],name,['Weapon Focus','Weapon Specialization'].includes(name)?s.rules.weapon:undefined);});}
  if(d.id==='ranger-combat-styles'){const style=rangerStyles[s.choice];if(style)style.forEach((name,i)=>{if(lv>=[2,6,11][i]&&(name!=='Improved Critical'||alternateWeaponChoices(d.id).includes(s.rules.weapon)))add(d.id,'style-'+[2,6,11][i],name,name==='Improved Critical'?s.rules.weapon:undefined);});}
  if(d.id==='barbarian-city-brawler')add(d.id,'unarmed','Improved Unarmed Strike');
  if(d.id==='sorcerer-stalwart-sorcerer'&&alternateWeaponChoices(d.id).includes(s.rules.weapon)){add(d.id,'weapon','Martial Weapon Proficiency',s.rules.weapon);add(d.id,'focus','Weapon Focus',s.rules.weapon);}
  if(d.id==='cleric-no-turning'&&s.choice==='Scribe')add(d.id,'scribe','Scribe Scroll');
  if(d.id==='cleric-no-turning'&&s.choice==='Wanderer')add(d.id,'endurance','Endurance');
  for(const slot of alternateFeatSlots(c,d.id)){const f=allowedAlternateFeats(c,d.id).find(f=>f.id===s.rules[slot.key]);if(!f)continue;const choice=s.rules[slot.key+'-choice']||'';if(featChoices(c,f).length&&!featChoices(c,f).includes(choice))continue;if(d.id==='paladin-holy-warrior'&&f.id==='skill-focus'&&choice!=='Ride')continue;add(d.id,slot.key,clean(f.name),choice);}
 }
 return out;
}
export function syncAlternateFeatGrants(c:Character){
 const old=new Map(c.features.filter(f=>f.ruleId?.startsWith('acf-grant:')).map(f=>[f.ruleId!,f]));
 const previous=c.features;
 c.features=c.features.filter(f=>!f.ruleId?.startsWith('acf-grant:'));
 const grants:Character['features']=[];
 for(const g of alternateGrantedFeats(c)){
  const key='acf-grant:'+g.featureId+':'+g.slot;
  if(c.features.some(f=>f.kind==='Feat'&&!f.ruleId?.startsWith('acf-grant:')&&identity(f.name)===identity(g.name)&&(f.choice||'')===(g.choice||'')))continue;
  if(c.features.length+grants.length>=250)continue;
  const def=activeAlternateFeatures(c).find(d=>d.id===g.featureId)!;
  grants.push({...old.get(key),id:old.get(key)?.id||crypto.randomUUID(),ruleId:key,name:g.name,kind:'Feat',choice:g.choice||'',description:'Granted by '+def.name+'. Manage the choice in Classes.',source:def.source,max:0,used:0});
 }
 const byKey=new Map(grants.map(f=>[f.ruleId,f]));
 c.features=previous.flatMap(f=>{if(!f.ruleId?.startsWith('acf-grant:'))return [f];const next=byKey.get(f.ruleId);byKey.delete(f.ruleId);return next?[next]:[];});
 c.features.push(...byKey.values());
}
