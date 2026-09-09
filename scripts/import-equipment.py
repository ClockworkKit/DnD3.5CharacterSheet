"""Import the OGL revised-SRD equipment tables, retaining source links."""
import re,html,json,sys
from pathlib import Path
src=Path(sys.argv[1]);root=Path(__file__).resolve().parents[1]
def plain(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>','',re.sub(r'<sup.*?</sup>','',s,flags=re.S)))).strip()
def num(s,default=0):
 m=re.search(r'[+−–-]?\d+(?:/\d+)?',s.replace(',',''))
 if not m:return default
 x=m[0].replace('–','-').replace('−','-');a=x.split('/');return float(a[0])/float(a[1]) if len(a)>1 else int(x)
def slug(s):return re.sub('[^a-z0-9]+','-',s.lower()).strip('-')
items=[];category='';group=''
for t in re.findall(r'<table\b.*?</table>',(src/'equipment.html').read_text(),re.S):
 text=plain(t)[:150]
 if 'Table: Weapons' in text:
  for tr in re.findall(r'<tr\b.*?</tr>',t,re.S):
   c=[plain(v) for v in re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>',tr,re.S)]
   if not c:continue
   if c[0] in ['Simple Weapons','Martial Weapons','Exotic Weapons']:category=c[0].split()[0].lower();continue
   if len(c)==1:group=c[0];continue
   if len(c)!=8 or not re.match(r'\d',c[3]):continue
   name=c[0];id='weapon-'+slug(name);damage=c[3].split('/')[0];small=c[2].split('/')[0]
   items.append(dict(id=id,name=name,kind='weapon',category=category,weight=num(c[6]),price=num(c[1])*(.1 if 'sp' in c[1] else 1),damage=damage,small=small,threat=num(c[4],20) if '–' in c[4] else 20,multiplier=int(re.search(r'x(\d)',c[4])[1]) if 'x' in c[4] else 2,range=num(c[5]),ranged=group=='Ranged Weapons',thrown=(num(c[5])>0 and group!='Ranged Weapons') or name in ['Dart','Javelin','Bolas','Shuriken (5)'],hands='light' if 'Light' in group or 'Unarmed' in group else 'two' if 'Two-Handed' in group else 'one',damageType=c[7],double='/' in c[3]))
 if 'Table: Armor and Shields' in text:
  for tr in re.findall(r'<tr\b.*?</tr>',t,re.S):
   c=[plain(v) for v in re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>',tr,re.S)]
   if not c:continue
   if c[0] in ['Light armor','Medium armor','Heavy armor','Shields','Extras']:category=c[0].split()[0].lower();continue
   if len(c)!=9 or not c[2].startswith('+'):continue
   items.append(dict(id='armor-'+slug(c[0]),name=c[0],kind='shield' if category=='shields' else 'armor',category=category,price=num(c[1]),armor=num(c[2]),dexCap=num(c[3],100),checkPenalty=num(c[4]),spellFailure=num(c[5]),weight=num(c[8])))
for x in items:x['source']='https://olimot.github.io/srd-v3.5/basic-rules-and-legal/equipment.html'
assert len(items)>80
(root/'lib/equipment-data.json').write_text(json.dumps(items,ensure_ascii=False,separators=(',',':')))
# Known-spell tables are separate from daily-slot tables.
known={}
for f in Path(sys.argv[2]).glob('*.html'):
 for t in re.findall(r'<table\b.*?</table>',f.read_text(),re.S):
  title=plain(t)[:150]
  m=re.search(r'(Bard|Sorcerer|Assassin) Spells Known',title)
  if not m:continue
  rows={}
  for tr in re.findall(r'<tr\b.*?</tr>',t,re.S):
   c=[plain(v) for v in re.findall(r'<td\b[^>]*>(.*?)</td>',tr,re.S)]
   if c and re.match(r'^\d+(st|nd|rd|th)$',c[0]):rows[str(num(c[0]))]=([0] if m[1]=='Assassin' else [])+[num(v) for v in c[1:]]
  known[m[1].lower()]=rows
(root/'lib/spells-known.json').write_text(json.dumps(known,separators=(',',':')))
print({'equipment':len(items),'spellsKnown':list(known)})
