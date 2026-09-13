"""Add verified numerical racial variants and concise support notes."""
import json,copy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
path=root/'lib/race-data.json';races=json.loads(path.read_text());by={r['id']:r for r in races}
source='https://srd.dndtools.org/srd/variant/unearthedElementalVariants.html'
variants=[('air-gnome','gnome',{'DEX':2,'STR':-2},'air'),('air-goblin','goblin',{'DEX':4,'STR':-2,'CON':-2},'air'),('earth-dwarf','dwarf',{'STR':2,'CON':2,'DEX':-2,'CHA':-2},'earth'),('earth-kobold','kobold',{'STR':-2,'CON':-2},'earth'),('fire-elf','elf',{'DEX':2,'CON':-2,'INT':2,'CHA':-2},'fire'),('fire-half-elf','half-elf',{},'fire-half'),('fire-hobgoblin','hobgoblin',{'DEX':2,'CON':2,'INT':2,'CHA':-2},'fire'),('water-half-orc','half-orc',by['half-orc']['abilities'],'water-half'),('water-halfling','halfling',{'STR':-2,'DEX':2,'CON':2},'water'),('water-orc','orc',{'STR':4,'CON':2,'INT':-2,'WIS':-2,'CHA':-2},'water')]
notes={'air':['Breathless: no breathing or inhalation exposure.','Earth opponents: attack +1; saves against their magical abilities or earth magic −2.'],'earth':['Grounded resistance to bull rush/trip +4; adds to existing stability.','Air opponents: attack +1; saves against their magical abilities or air magic −2.'],'fire':['Fire resistance 5.','Water opponents: attack +1; saves against water/cold magic or those creatures’ magical abilities −2.'],'water':['Natural swimming at base land speed; Swim +8, take 10 under pressure, straight-line swimming run. Air breathing is unchanged.','Fire opponents: attack +1; saves against their magical abilities or fire magic −2.'],'fire-half':['Water opponents: attack +1; saves against their magical abilities −1. No general fire-race benefits.'],'water-half':['Fire opponents: attack +1; saves against their magical abilities −1. No general water-race benefits.']}
for ident,base,abilities,element in variants:
 r=copy.deepcopy(by[base]);r.update(id=ident,name=ident.replace('-',' ').title().replace('Half Elf','Half-Elf').replace('Half Orc','Half-Orc'),group='Elemental variants',abilities=abilities,source=source,book='Unearthed Arcana',openGame=True,baseRace=base,element=element)
 r['traits']=list(by[base]['traits'])+notes[element]
 if ident=='air-gnome':r['traits']=[t for t in r['traits'] if 'goblinoid' not in t and 'giant' not in t];r['traits']+=['No usual kobold/goblinoid attack bonus. AC +4 dodge against Large or larger earth-subtype foes.']
 if ident=='air-goblin':r['skills'].pop('Ride',None)
 if ident=='earth-dwarf':r['traits']=[t for t in r['traits'] if not any(w in t for w in ['Poison saves','Attacks against','Stonecunning;'])];r['traits']+=['Poison saves +2; no ordinary dwarf spell-save or orc/goblinoid attack bonus.','Stonework Search +4; stone/metal Appraise and Craft +4; grounded stability totals +8. Dwarf weapon familiarity remains.']
 if ident=='earth-kobold':r['traits']+=['Stonework trapmaking racial bonus increases to +4.']
 if ident=='fire-hobgoblin':r['vision']='Low-light vision';r['skills'].pop('Move Silently',None)
 by[ident]=r
kob=copy.deepcopy(by['kobold']);kob.update(id='aquatic-kobold',name='Aquatic Kobold',group='Aquatic variants',baseRace='kobold',type='Humanoid (aquatic, reptilian)',swim=40,waterBreathing=True,bonusLanguages='Common, Undercommon, Aquan.',source='https://srd.dndtools.org/srd/variant/unearthedEnvironmentalVariants.html',book='Unearthed Arcana')
kob['traits']+=['Swim 40 ft.; Swim checks +8; take 10 even under pressure; run swimming in a straight line.','Water breathing only. Outside water, breath-holding lasts 2 × Constitution rounds before suffocation checks.','Default LA +0. The source suggests optional +1 in mixed aquatic/non-aquatic underwater or ship campaigns; use the LA field for the DM’s choice.'];by[kob['id']]=kob
illum=copy.deepcopy(by['human']);illum.update(id='illumian',name='Illumian',group='Other books',type='Humanoid (human)',languages=['Common','Illumian'],source='https://srd.dndtools.org/srd/races/racesRod.html',book='Races of Destiny',openGame=False,traits=['Select power sigils and manage their combination below. Suppressing luminous sigils suppresses their supernatural benefits.','Shadow-descriptor spell saves +2; glyphic resonance depends on the incoming caster level.','Always literate; Speak Language is always a class skill.','Final utterance duration equals Hit Dice in rounds. Human subtype grants no human bonus feat or extra skill points.']);by['illumian']=illum
ordered=[by[r['id']] for r in races]+[r for k,r in by.items() if k not in {x['id'] for x in races}]
path.write_text(json.dumps(ordered,ensure_ascii=False,separators=(',',':'))+'\n')
p=root/'public/data/races.json';refs=json.loads(p.read_text());ids={r['id'] for r in refs}
for r in ordered:
 if r['id'] not in ids:refs.append({**r,'reference':'\n\n'.join(r['traits'])+'\n\nSee the linked source for full inherited traits and variant exceptions.' if r['openGame'] else ''})
p.write_text(json.dumps(refs,ensure_ascii=False,separators=(',',':'))+'\n')
