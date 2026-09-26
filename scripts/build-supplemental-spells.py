"""Build supplemental list memberships and clearly labeled reference-only entries.

Inputs are the checked class spell index and a separately labeled compendium index.
Run again after regenerating the SRD catalog.
"""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=json.loads((root/'public/data/spells.json').read_text(encoding='utf8'))
pages=json.loads((root/'lib/supplemental-spell-lists.json').read_text())
def key(name):
 name=re.sub(r"\b(?:Bigby|Mordenkainen|Leomund|Melf|Nystul|Otiluke|Otto|Rary|Tasha|Tenser|Evard)'s\s+",'',name,flags=re.I)
 return ' '.join(sorted(re.findall(r'[a-z0-9]+',name.lower())))
bykey={key(s['name']):s for s in base}
aliases={'Acid Orb, Lesser':'Orb of Acid, Lesser','Cold Orb, Lesser':'Orb of Cold, Lesser','Electric Orb, Lesser':'Orb of Electricity, Lesser','Fire Orb, Lesser':'Orb of Fire, Lesser','Sonic Orb, Lesser':'Orb of Sound, Lesser','Acid Orb':'Orb of Acid','Cold Orb':'Orb of Cold','Electric Orb':'Orb of Electricity','Fire Orb':'Orb of Fire','Sonic Orb':'Orb of Sound'}
result={}
for p in pages:
 assert len(p['entries'])==p['total'],(p['id'],p['level'],len(p['entries']),p['total'])
 label=p['id'].replace('-',' ').title()
 for e in p['entries']:
  # Oriental Adventures entries predate the Complete Arcane Wu Jen used here.
  if p['id']=='wu-jen' and e['book']=='OA':continue
  name=aliases.get(e['name'],e['name']);k=key(name);existing=bykey.get(k)
  ident=existing['id'] if existing else 'supp-'+re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')
  if ident not in result:
   result[ident]={'id':ident,'levels':{},'sources':[]}
   if not existing:
    def value(field):return e[field] if e[field] and e[field]!='None' else 'See source'
    result[ident]['spell']={'id':ident,'name':name,'school':e['school'],'levels':{},'levelText':'','components':value('components'),'castingTime':value('castingTime'),'range':value('range'),'duration':value('duration'),'target':'See source','save':'See source','resistance':'See source','description':f"Reference entry from {e['book']}. The class list and spell level are indexed; full effect text and saving-throw details are not bundled. Consult the linked source before resolving this spell, or add your own complete version with Custom spell.",'source':p['source'],'referenceOnly':True}
  r=result[ident]
  if label in r['levels'] and r['levels'][label]!=p['level']:raise ValueError('Conflicting class spell levels: '+name+' '+label)
  r['levels'][label]=p['level']
  if p['source'] not in r['sources']:r['sources'].append(p['source'])

# Add the supplied mixed-edition compendium as an explicitly unverified index.
# Never replace an SRD spell or a previously checked supplemental identity.
index=json.loads((root/'lib/compendium-spell-index.json').read_text(encoding='utf8'))
known={key(s['name']) for s in base}|{key(r['spell']['name']) for r in result.values() if 'spell' in r}
groups={}
for entry in index:
 name=entry['name'].split(' / ')[0]
 k=key(name)
 if k in known:continue
 groups.setdefault(k,[]).append({**entry,'name':name})
for entries in groups.values():
 e=entries[0];name=e['name'];ident='supp-'+re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')
 if ident in result:continue
 memberships={}
 for entry in entries:
  for label,level in entry['levels'].items():memberships.setdefault(label,set()).add(level)
 levels={label:next(iter(values)) for label,values in memberships.items() if len(values)==1}
 if not levels:continue
 references=sorted({entry['book']+' (compilation p. '+str(entry['page'])+')' for entry in entries})
 conflicts=[label for label,values in memberships.items() if len(values)>1]
 description='Compendium index only. Sources: '+'; '.join(references)+'. This compilation includes 3.0, 3.5, magazine and third-party material. Confirm the spell level, edition and full rules with your DM before using it. Full effect text is not bundled.'
 if conflicts:description+=' Conflicting levels omitted for: '+', '.join(conflicts)+'.'
 result[ident]={'id':ident,'levels':levels,'sources':references,'spell':{'id':ident,'name':name,'school':e['school'],'levels':{},'levelText':'','components':'See source','castingTime':'See source','range':'See source','target':'See source','duration':'See source','save':'See source','resistance':'See source','description':description,'source':'Spells v6.01, compiled by Zook1shoe (2013)','referenceOnly':True,'catalogOrigin':'compendium'}}
# Verified against the user's preferred SRD site's Player's Handbook II entry.
# Retain the pre-existing supplemental ID so saved spellbooks continue to resolve.
ident='supp-kelgore-s-fire-bolt'
result[ident]={'id':ident,'levels':{'Duskblade':1,'Sorcerer / Wizard':1},'sources':['https://srd.dndtools.org/srd/magic/spells/spells/spellsphb2.html'],'spell':{'id':ident,'name':"Kelgore's Fire Bolt",'school':'Conjuration/Evocation [Fire]','levels':{},'levelText':'','components':'V, S, M','castingTime':'1 standard action','range':'Medium (100 ft. + 10 ft./level)','target':'One creature','duration':'Instantaneous','save':'Reflex half','resistance':'Yes; if not overcome, damage is reduced to 1d6','description':'A heated conjured stone deals 1d6 fire damage per caster level, capped at 5d6. A successful Reflex save halves the damage. If the spell fails to overcome spell resistance, roll only 1d6 fire damage instead of the normal effect; apply the saving throw normally. Material component: ashes. Source: Player\'s Handbook II, p. 116.','source':'https://srd.dndtools.org/srd/magic/spells/spells/spellsphb2.html','referenceOnly':False}}

rows=sorted(result.values(),key=lambda r:r['id'])
(root/'public/data/supplemental-spells.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
print(f"{len(rows)} spell identities; {sum('spell' in r for r in rows)} new reference entries; {sum(len(r['levels']) for r in rows)} class memberships")
