import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {findClass} from '../lib/classes.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {gestaltProgressionSchema,gestaltLevelSequence,gestaltBaseTotals} from '../lib/gestalt-progression.ts';
import {hitPointGrant,skillPointGrant} from '../lib/level-history.ts';
import {classSkillAt} from '../lib/skill-points.ts';

const make=(pairs)=>{
 const c=createPlayerCharacter({name:'Gestalt foundation QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:12,WIS:14,CHA:10},method:'manual'});
 const counts=new Map();for(const pair of pairs)for(const id of pair)counts.set(id,(counts.get(id)??0)+1);
 c.classLevels=[...counts].map(([id,level])=>({id:'entry-'+id,classId:id,name:findClass(id)?.name??id,level,notes:'Preserve class notes'}));
 const plan=gestaltProgressionSchema.parse({version:1,bonusMethod:'best-progression-v1',levels:pairs.map(([left,right],i)=>({id:'level-'+(i+1),left:'entry-'+left,right:'entry-'+right}))});
 return {c,plan};
};
const repeat=(left,right,n)=>Array.from({length:n},()=>[left,right]);
const compile=(fixture,options)=>gestaltLevelSequence(fixture.c,fixture.plan,options);

test('Fighter 5 // Wizard 5 has five shared rows, d10s and better nonstacking base bonuses',()=>{
 const f=make(repeat('fighter','wizard',5)),before=structuredClone(f);
 const rows=compile(f);assert.deepEqual(gestaltBaseTotals(rows),{level:5,bab:5,fort:4,ref:1,will:4,hitDice:'5d10'});
 assert.equal(rows.length,5);assert.ok(rows.every(r=>r.die===10&&r.skillBase===2));
 assert.equal(rows[4].left.classLevel,5);assert.equal(rows[4].right.classLevel,5);assert.equal(rows[4].key,'gestalt-level-5');assert.deepEqual(f,before);
});

test('Ranger // Rogue and Wizard // Cleric retain both class identities with one allowance per level',()=>{
 const ranger=compile(make(repeat('ranger','rogue',5)));
 assert.deepEqual(gestaltBaseTotals(ranger),{level:5,bab:5,fort:4,ref:4,will:1,hitDice:'5d8'});
 assert.ok(ranger.every(r=>r.skillBase===8&&r.left.classId==='ranger'&&r.right.classId==='rogue'));
 const casters=compile(make(repeat('wizard','cleric',5)));
 assert.deepEqual(gestaltBaseTotals(casters),{level:5,bab:3,fort:4,ref:1,will:4,hitDice:'5d8'});
 assert.equal(casters[4].left.classLevel,5);assert.equal(casters[4].right.classLevel,5);
});

test('either side can change classes and switching sides does not reset individual class levels',()=>{
 const f=make([['fighter','wizard'],['rogue','wizard'],['wizard','fighter'],['ranger','cleric'],['rogue','cleric']]);
 const rows=compile(f);assert.equal(rows.length,5);
 assert.deepEqual(rows.map(r=>[r.left.classLevel,r.right.classLevel]),[[1,1],[1,2],[3,2],[1,1],[2,2]]);
 assert.deepEqual(rows.map(r=>r.skillBase),[2,8,2,6,8]);
 const swapped={...f,plan:{...f.plan,levels:f.plan.levels.map(r=>({...r,left:r.right,right:r.left}))}};
 assert.deepEqual(compile(swapped).map(r=>({key:r.key,die:r.die,skillBase:r.skillBase,left:r.right,right:r.left})),rows.map(({key,die,skillBase,left,right})=>({key,die,skillBase,left,right})));
 assert.throws(()=>gestaltBaseTotals(rows),/rounding policy/);
});

test('mixed-class bonuses fail explicitly until a rounding policy is selected, rather than inflating saves',()=>{
 const f=make([['wizard','fighter'],['wizard','sorcerer'],['wizard','sorcerer'],['wizard','sorcerer'],['wizard','sorcerer']]);
 assert.throws(()=>gestaltBaseTotals(compile(f)),/rounding policy/);
 for(const method of ['fractional','best-side','best-table-increment-v1','unknown'])assert.equal(gestaltProgressionSchema.safeParse({...f.plan,bonusMethod:method}).success,false);
 for(let n=1;n<=20;n++){
  const totals=gestaltBaseTotals(compile(make(repeat('fighter','wizard',n))));
  assert.equal(totals.bab,n);assert.equal(totals.fort,2+Math.floor(n/2));assert.equal(totals.ref,Math.floor(n/3));assert.equal(totals.will,2+Math.floor(n/2));
  assert.equal(gestaltBaseTotals(compile(make(repeat('cleric','wizard',n)))).bab,Math.floor(n*3/4));
 }
});

test('duplicate or missing entries, mismatched totals and invalid plan data are rejected without mutation',()=>{
 const f=make(repeat('fighter','wizard',2)),before=structuredClone(f);
 const bad=[{...f.plan,levels:[f.plan.levels[0],f.plan.levels[0]]},{...f.plan,levels:[{...f.plan.levels[0],right:'entry-fighter'},f.plan.levels[1]]},{...f.plan,levels:[{...f.plan.levels[0],left:'missing'},f.plan.levels[1]]},{...f.plan,levels:f.plan.levels.slice(0,1)}];
 for(const plan of bad)assert.throws(()=>gestaltLevelSequence(f.c,plan));
 const duplicate=structuredClone(f);duplicate.c.classLevels.push({...duplicate.c.classLevels[0],id:'duplicate'});assert.throws(()=>compile(duplicate),/unique entry/);
 assert.equal(gestaltProgressionSchema.safeParse({...f.plan,version:2}).success,false);
 assert.equal(gestaltProgressionSchema.safeParse({...f.plan,levels:[]}).success,false);assert.deepEqual(f,before);
});

test('same-class families and two prestige classes cannot be waived through combination approvals',()=>{
 const variants=make([['wizard','sorcerer']]);assert.throws(()=>compile(variants,{policies:{wizard:{family:'shared-test-family'},sorcerer:{family:'shared-test-family'}}}),/same class/);
 const prestige=make([['loremaster','horizon-walker']]);assert.throws(()=>compile(prestige),/two prestige/);
 const duplicate=make([['fighter','wizard']]);duplicate.c.classLevels[1].classId='fighter';assert.throws(()=>compile(duplicate),/unique entry/);
});

test('combination prestige classes need a scoped, named GM approval that survives serialization',()=>{
 for(const id of ['arcane-trickster','eldritch-knight','mystic-theurge','cerebremancer']){
  const f=make([[id,'fighter']]);assert.throws(()=>compile(f),/GM approval/);
  f.plan.levels[0].approvals=[{classId:id,gm:'Test GM',reason:'Campaign-approved exception for this progression'}];
  const saved=gestaltProgressionSchema.parse(JSON.parse(JSON.stringify(f.plan)));assert.deepEqual(saved,f.plan);assert.equal(gestaltLevelSequence(f.c,saved).length,1);
  f.plan.levels[0].approvals[0].classId='loremaster';assert.throws(()=>compile(f),/does not match/);
 }
 const f=make([['mystic-theurge','fighter']]);f.plan.levels[0].approvals=[{classId:'mystic-theurge',gm:' ',reason:' '}];assert.throws(()=>compile(f));
});

test('alternate Hit Dice and skill grants use the current selected features',()=>{
 const f=make(repeat('cleric','wizard',2));configureAlternateFeature(f.c,'cleric-golarion-cleric',{reviewed:true});selectAlternateFeature(f.c,'cleric-golarion-cleric',true);
 assert.deepEqual(gestaltBaseTotals(compile(f)),{level:2,bab:2,fort:3,ref:0,will:3,hitDice:'2d10'});
 const g=make([['fighter','wizard']]);configureAlternateFeature(g.c,'fighter-golarion-fighter',{reviewed:true});selectAlternateFeature(g.c,'fighter-golarion-fighter',true);assert.equal(compile(g)[0].skillBase,4);
});

test('explicit custom tables and class policies are supported; missing or replaced tables are never guessed',()=>{
 const f=make([['test-custom','wizard']]);assert.throws(()=>compile(f),/explicit class table/);
 const definition={...structuredClone(findClass('fighter')),id:'test-custom',name:'Test custom',hitDie:12,skillPoints:6};
 const row=compile(f,{definitions:[definition]})[0];assert.equal(row.die,12);assert.equal(row.skillBase,6);assert.equal(row.left.base.bab,1);
 assert.throws(()=>compile(f,{definitions:[findClass('fighter')]}),/replace a catalog/);
 const missing={...definition,levels:[]};assert.throws(()=>compile(f,{definitions:[missing]}),/complete table/);
 const malformed={...definition,levels:[{...definition.levels[0],bab:2}]};assert.throws(()=>compile(f,{definitions:[malformed]}),/explicit progression policy/);
});

test('racial-HD and monster combinations fail explicitly; level adjustment does not create paired levels',()=>{
 const f=make(repeat('fighter','wizard',2));f.c.ancestry.levelAdjustment=2;assert.equal(gestaltBaseTotals(compile(f)).level,2);
 f.c.ancestry.racialHitDice=2;assert.throws(()=>compile(f),/racial Hit Dice/);f.c.ancestry.racialHitDice=0;f.c.sheetKind='monster';assert.throws(()=>compile(f),/class-based/);
});

test('paired rows reuse HP and skill grants with Constitution, Intelligence and first-level multipliers applied once',()=>{
 const f=make(repeat('fighter','wizard',5)),rows=compile(f);
 f.c.automation.history=rows.map((row,i)=>({key:row.key,hitDieRoll:[10,4,5,6,7][i],intScore:12,skillRanks:{},skillClassOverrides:{}}));
 const before=structuredClone(f.c);
 assert.equal(rows.reduce((n,row,i)=>n+hitPointGrant(f.c,row,i),0),42);
 assert.equal(rows.reduce((n,row,i)=>n+skillPointGrant(f.c,row,i),0),32);
 assert.deepEqual(f.c,before);
 f.c.scores.INT=18;assert.equal(rows.reduce((n,row,i)=>n+skillPointGrant(f.c,row,i),0),32,'historical Intelligence remains authoritative');
 f.c.automation.hpMethod='maximum';assert.equal(rows.reduce((n,row,i)=>n+hitPointGrant(f.c,row,i),0),60);
 f.c.automation.hpMethod='average';assert.equal(rows.reduce((n,row,i)=>n+hitPointGrant(f.c,row,i),0),42);
});

test('the existing skill classifier unions both classes while preserving explicit historical overrides',()=>{
 const f=make([['ranger','rogue']]),row=compile(f)[0];
 const skill=name=>f.c.skills.find(s=>s.name===name);
 assert.equal(classSkillAt(f.c,skill('Survival'),row),true);assert.equal(classSkillAt(f.c,skill('Disable Device'),row),true);assert.equal(classSkillAt(f.c,skill('Spellcraft'),row),false);
 f.c.automation.history=[{key:row.key,intScore:12,skillRanks:{},skillClassOverrides:{[skill('Survival').id]:false}}];
 assert.equal(classSkillAt(f.c,skill('Survival'),row),false);assert.equal(classSkillAt(f.c,skill('Disable Device'),row),true);
 skill('Disable Device').classSkillOverride=false;assert.equal(classSkillAt(f.c,skill('Disable Device'),row),false);
});
