"""Build supplemental list memberships and clearly labeled reference-only entries.

Input is the checked, paginated class spell index, not scraped book prose.
Run again after regenerating the SRD catalog.
"""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=json.loads((root/'public/data/spells.json').read_text())
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
rows=sorted(result.values(),key=lambda r:r['id'])
(root/'public/data/supplemental-spells.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n')
print(f"{len(rows)} spell identities; {sum('spell' in r for r in rows)} new reference entries; {sum(len(r['levels']) for r in rows)} class memberships")
