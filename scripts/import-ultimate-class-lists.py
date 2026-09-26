"""Add new class list memberships from cached Ultimate SRD HTML; keep spell rules intact."""
import json,re,html,sys,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parents[1];cache=Path(sys.argv[1])
def plain(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>','',s))).strip().rstrip(':')
def key(s):return ' '.join(sorted(re.findall(r'[a-z0-9]+',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())))
def sections(path):
 text=(cache/path.replace('/','_')).read_text();heads=list(re.finditer(r'<h5[^>]*>(.*?)</h5>',text,re.S|re.I))
 for i,h in enumerate(heads):
  level=re.match(r'(\d)',plain(h[1]));
  if not level:continue
  section=text[h.end():heads[i+1].start() if i+1<len(heads) else len(text)]
  rows=[]
  for tr in re.findall(r'<tr\b[^>]*>(.*?)</tr>',section,re.S|re.I):
   cells=re.findall(r'<td\b[^>]*>(.*?)</td>',tr,re.S|re.I)
   if len(cells)==3 and any('<a ' in cell for cell in cells):rows.append([plain(c) for c in cells])
  yield int(level[1]),rows
pages=json.loads((root/'lib/supplemental-spell-lists.json').read_text())
for cid,stem in [('death-master','deathMaster'),('jester','jester'),('urban-druid','urbanDruid')]:
 pages=[p for p in pages if p['id']!=cid]
 path='srd/magic/spells/classSpellLists/'+stem+'Spells.html'
 for level,rows in sections(path):
  # The source lists Bestow Curse twice for Jester (3rd and 4th); leave it for DM review.
  if cid=='jester':rows=[r for r in rows if r[1]!='Bestow Curse']
  entries=[dict(name=name,book=book,school='',components='',castingTime='',range='',duration='') for book,name,description in rows]
  pages.append(dict(id=cid,level=level,total=len(entries),source='https://srd.dndtools.org/'+path,entries=entries))
(root/'lib/supplemental-spell-lists.json').write_text(json.dumps(pages,ensure_ascii=False,separators=(',',':'))+'\n')
powers=json.loads((root/'public/data/powers.json').read_text());bykey={key(p['name']):p for p in powers}
matched=[];missing=[]
for level,rows in sections('srd/magic/psionics/classPowerLists/psionicPsychicRogueList.html'):
 for name,desc,book in rows:
  p=bykey.get(key(name))
  if p:
   p['levels']['Psychic Rogue']=level
   p['levelText']=', '.join(k+' '+str(v) for k,v in p['levels'].items())
   matched.append(dict(id=p['id'],level=level))
  else:missing.append(dict(name=name,level=level))
(root/'lib/psychic-rogue-power-list.json').write_text(json.dumps(dict(source='https://srd.dndtools.org/srd/magic/psionics/classPowerLists/psionicPsychicRogueList.html',entries=matched,unbundled=missing),ensure_ascii=False,indent=2)+'\n')
(root/'public/data/powers.json').write_text(json.dumps(powers,ensure_ascii=False,separators=(',',':'))+'\n')
print('New spell lists:',[(cid,sum(p['total'] for p in pages if p['id']==cid)) for cid in ['death-master','jester','urban-druid']]);print('Psychic Rogue:',len(matched),'bundled;',missing,'require custom entries')
