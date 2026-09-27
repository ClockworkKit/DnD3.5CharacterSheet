import {createMonsterSheet,creatureAbilityModifier} from './creatures.ts';
import {characterSchema,newWeapon,uid,type Character} from './model.ts';
import {skillBonus} from './rules.ts';
const core='https://srd.dndtools.org/srd/monsters/monsters/core/';
const skeletonSource=core+'monstersS.html';
export const bestiary=[
 {id:'human-skeleton',name:'Human warrior skeleton',type:'Undead',cr:1/3,source:skeletonSource},
 {id:'wolf-skeleton',name:'Wolf skeleton',type:'Undead',cr:1,source:skeletonSource},
 {id:'owlbear-skeleton',name:'Owlbear skeleton',type:'Undead',cr:2,source:skeletonSource},
 {id:'ghoul',name:'Ghoul',type:'Undead',cr:1,source:core+'monstersG.html'},
 {id:'wolf',name:'Wolf',type:'Animal',cr:1,source:'https://srd.dndtools.org/srd/monsters/monsters/animalsvermin/animalsCore.html'},
 {id:'ogre',name:'Ogre',type:'Giant',cr:3,source:core+'monstersOtoR.html'},
] as const;
export function challengeRatingLabel(value:number|null){if(value===null)return '—';for(const denominator of [2,3,4,6,8])if(Math.abs(value-1/denominator)<1e-8)return '1/'+denominator;return String(value);}
export function createBestiaryMonster(id:string,name?:string):Character {
 const entry=bestiary.find(e=>e.id===id);if(!entry)throw new Error('Choose a monster from the bestiary.');
 let c:Character;
 if(id.endsWith('skeleton')){
  const human=id==='human-skeleton',owl=id==='owlbear-skeleton';
  c=createMonsterSheet({name:entry.name,size:owl?'Large':'Medium',speed:human||owl?30:50,scores:{STR:owl?21:13,DEX:owl?14:human?13:17,CON:null,INT:null,WIS:10,CHA:1},creature:{type:'Undead',racialHitDice:owl?5:human?1:2,challengeRating:entry.cr,source:entry.source,reach:5,naturalAttacks:human?[{id:'claw',name:'Claw',count:2,damage:'1d4'}]:owl?[{id:'claw',name:'Claw',count:2,damage:'1d6'},{id:'bite',name:'Bite',role:'secondary',damage:'1d8'}]:[{id:'bite',name:'Bite',damage:'1d6'}],senses:'Darkvision 60 ft.',specialQualities:['Undead traits'],immunities:'Cold; undead immunities',treasure:'None',environment:human?'Temperate plains':'Temperate forests',organization:'Any',advancement:human?'—':owl?'6–8 HD (Large); 9–15 HD (Huge)':'3 HD (Medium); 4–6 HD (Large)'}});
  c.defense.natural=2;c.defense.dr='5/bludgeoning';c.initiative=4;c.alignment='Neutral evil';feat(c,'Improved Initiative');
  if(human){c.defense.shield=2;c.defense.checkPenalty=-2;c.weapons=[{...newWeapon(),name:'Scimitar',damage:'1d6',crit:'18–20 / ×2',criticalRange:18,criticalMultiplier:2}];c.gear=[item('Heavy steel shield',15),item('Scimitar',4)];c.creature!.notes='Choose scimitar or claws as the attack routine. Two claws require free hands; lower the shield bonus when the shield is not in use.';}
 }else if(id==='wolf'){
  c=createMonsterSheet({name:entry.name,speed:50,scores:{STR:13,DEX:15,CON:15,INT:2,WIS:12,CHA:6},creature:{type:'Animal',racialHitDice:2,challengeRating:1,source:entry.source,naturalAttacks:[{id:'bite',name:'Bite',damage:'1d6',attackBonus:1,notes:'Weapon Focus included. On a hit: free trip attempt (+1); a failed attempt cannot be reversed.'}],senses:'Low-light vision; scent',specialAttacks:['Trip'],environment:'Temperate forests',organization:'Solitary, pair, or pack (7–16)',treasure:'None',advancement:'3 HD (Medium); 4–6 HD (Large)',notes:'Survival gains +4 when tracking by scent. The printed bite uses +1 Strength damage.'}});
  c.defense.natural=2;c.alignment='Neutral';c.automation.quadruped=true;feat(c,'Track');feat(c,'Weapon Focus (bite)');skills(c,{Hide:2,Listen:3,'Move Silently':3,Spot:3,Survival:1});
 }else if(id==='ghoul'){
  c=createMonsterSheet({name:entry.name,scores:{STR:13,DEX:15,CON:null,INT:13,WIS:14,CHA:12},creature:{type:'Undead',racialHitDice:2,challengeRating:1,source:entry.source,naturalAttacks:[{id:'bite',name:'Bite',damage:'1d6',notes:'Paralysis and ghoul fever; see special abilities.'},{id:'claw',name:'Claw',count:2,role:'secondary',damage:'1d3',notes:'Paralysis; see special abilities.'}],senses:'Darkvision 60 ft.',specialAttacks:['Ghoul fever','Paralysis'],specialQualities:['Undead traits','Turn resistance +2'],environment:'Any',organization:'Solitary, gang (2–4), or pack (7–12)',treasure:'None',advancement:'3 HD (Medium)',notes:'Paralysis: bite/claw, Fortitude DC 12, 1d4+1 rounds; elves are immune. Ghoul fever: bite, Fortitude DC 12; onset 1 day; 1d3 Constitution and 1d3 Dexterity damage. See source for transformation on death.'}});
  c.defense.natural=2;c.alignment='Chaotic evil';c.languages='Common';feat(c,'Multiattack');skills(c,{Balance:6,Climb:5,Hide:6,Jump:5,'Move Silently':6,Spot:7});
 }else{
  c=createMonsterSheet({name:entry.name,size:'Large',speed:30,maxHp:29,scores:{STR:21,DEX:8,CON:15,INT:6,WIS:10,CHA:7},creature:{type:'Giant',racialHitDice:4,challengeRating:3,source:entry.source,reach:10,senses:'Darkvision 60 ft.; low-light vision',environment:'Temperate hills',organization:'Solitary, pair, gang (3–4), or band (5–8)',treasure:'Standard',advancement:'By character class',notes:'Land speed is 30 ft. in hide armor; unarmored base speed is 40 ft. Toughness is included in HP and Weapon Focus is included in greatclub attack.'}});
  c.defense.natural=5;c.defense.armor=3;c.defense.dexCap=4;c.defense.checkPenalty=-3;c.defense.spellFailure=20;c.hitDice='4d8+11';c.alignment='Chaotic evil';c.languages='Giant';
  c.weapons=[{...newWeapon(),name:'Greatclub',damage:'2d8',strength:'two',attack:1},{...newWeapon(),name:'Javelin',damage:'1d8',ability:'DEX',range:'30 ft.',attackMode:'ranged'}];c.gear=[item('Hide armor',50),item('Greatclub',16),item('Javelin',4)];feat(c,'Toughness');feat(c,'Weapon Focus (greatclub)');skills(c,{Climb:5,Listen:2,Spot:2});
 }
 if(id==='wolf')c.hitDice='2d8+4';
 if(name?.trim())c.name=name.trim();
 return characterSchema.parse(c);
}
function feat(c:Character,name:string){c.features.push({id:uid(),name,kind:'Feat',description:'Listed in the source stat block. Fixed bonuses are included in the entered statistics.',source:c.creature!.source,max:0,used:0});}
function item(name:string,weight:number):Character['gear'][number]{return {id:uid(),name,weight,qty:1,carried:true,equipped:true,notes:'Published equipment; armor and attack values are entered manually.'};}
function skills(c:Character,totals:Record<string,number>){for(const [name,total] of Object.entries(totals)){const s=c.skills.find(s=>s.name===name)!;s.ranks=Math.max(0,total-creatureAbilityModifier(c,s.ability));s.misc+=total-skillBonus(c,s);}}
