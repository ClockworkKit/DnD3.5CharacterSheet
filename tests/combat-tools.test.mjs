import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {combatToolSections} from '../lib/combat-tools.ts';
import {applyClericSpecialty} from '../lib/cleric-specialty.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {alternateActions,useAlternateAction} from '../lib/alternate-actions.ts';

const create=(kind='Fighter',level=9)=>createPlayerCharacter({name:'Combat tools QA',kind,level,raceId:'human',scores:{STR:12,DEX:14,CON:12,INT:18,WIS:18,CHA:14},method:'manual'});
const saved=c=>JSON.parse(JSON.stringify(c));

test('combat exposes Factotum and cleric magic but not an empty fighter spellbook',()=>{
 assert.equal(combatToolSections(create()).magic,false);
 assert.equal(combatToolSections(create('Factotum')).magic,true);
 const c=create('Cleric');applyClericSpecialty(c,'axe-brother');
 assert.equal(combatToolSections(c).magic,true);
 assert.equal(combatToolSections(c).martial,false);
});

test('martial systems and magical systems appear in their own combat panels',()=>{
 assert.equal(combatToolSections(create('Warblade')).martial,true);
 const warlock=combatToolSections(create('Warlock'));
 assert.equal(warlock.magic,true);assert.equal(warlock.martial,false);
 assert.equal(combatToolSections(create()).martial,false);
});

test('a recorded spell-like ability exposes magic without requiring a caster',()=>{
 const c=create();c.features.push({id:'sla',name:'Test ability',kind:'Other',magic:true,description:'',source:'',max:3,used:2});
 const before=saved(c);assert.equal(combatToolSections(c).magic,true);assert.deepEqual(saved(c),before);
});

test('alternate combat controls appear once per selected feature, even with multiple actions',()=>{
 const c=create('Monk');configureAlternateFeature(c,'monk-invisible-fist',{reviewed:true});
 assert.deepEqual(combatToolSections(c).alternateIds,[]);
 selectAlternateFeature(c,'monk-invisible-fist',true);recompute(c);
 assert.ok(alternateActions(c).filter(a=>a.featureId==='monk-invisible-fist').length>1);
 assert.deepEqual(combatToolSections(c).alternateIds,['monk-invisible-fist']);
 useAlternateAction(c,'monk-invisible-fist','invisible');const before=saved(c);
 combatToolSections(c);combatToolSections(c);assert.deepEqual(saved(c),before);
 selectAlternateFeature(c,'monk-invisible-fist',false);recompute(c);
 assert.deepEqual(combatToolSections(c).alternateIds,[]);
});

test('combat visibility never resets leveled characters, damage, preparations or daily resources',()=>{
 let c=create('Cleric',5);applyClericSpecialty(c,'axe-brother');
 c.casters[0].spells[0].prepared=2;c.casters[0].spells[0].spent=1;
 c.casters[0].slots[1].used=1;c.factotum.spent=2;c.factotum.pietyUsed=1;
 c.features.push({id:'custom-use',name:'Daily item',kind:'Other',description:'',source:'',max:3,used:2});
 c.hp-=7;c.classLevels[0].level=6;c.notes='Keep the last session';recompute(c);
 c=characterSchema.parse(saved(c));const before=saved(c);
 for(let i=0;i<3;i++)combatToolSections(c);
 assert.deepEqual(saved(c),before);assert.equal(c.classLevels[0].level,6);
 assert.equal(c.maxHp-c.hp,7);assert.equal(c.casters[0].spells[0].spent,1);
});
