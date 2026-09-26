"""Extract reference metadata from user-supplied Spells v6.01.pdf (Zook1shoe, 2013).
Usage: python scripts/import-spell-compendium.py /path/to/Spells-v6.01.pdf
Requires pypdfium2. Full spell prose is not included in the generated index.
Existing SRD and verified class-list entries take precedence at catalog build time.
"""
import json,re,sys
from pathlib import Path
import pypdfium2 as pdf
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1])
if source.suffix=='.txt': text=source.read_text(encoding='utf8')
else:
 doc=pdf.PdfDocument(str(source))
 text='\n'.join(f'PAGE {i+1}\n'+p.get_textpage().get_text_range() for i,p in enumerate(doc))
text=text.replace('\r','').replace('\ufffe','-').replace('’',"'").replace('‘',"'")
text=re.sub(r'\n+', '\n',text)
# A heading must be followed immediately by a school and a Level field.
def headings(text):
 lines=[line.strip() for line in text.splitlines()]
 for i,line in enumerate(lines):
  if not line.startswith('Level:') or i<2:continue
  school=lines[i-1]
  if not re.match(r'^(Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation|Universal)\b',school):continue
  head=lines[i-2]; j=i-2
  while '[' not in head and j>0 and i-j<6:
   j-=1;head=lines[j]+' '+head
  h=re.fullmatch(r'(.+?)\s*\[([^\]]+)\]',head)
  if not h:continue
  level=line[6:].strip();k=i+1
  while k<len(lines) and ':' not in lines[k] and not lines[k].startswith('PAGE '):
   level+=' '+lines[k];k+=1
  page=next((int(x[5:]) for x in reversed(lines[:i]) if re.fullmatch(r'PAGE \d+',x)),1)
  yield h[1],h[2],school,level,page

# Only published casting traditions already supported by this sheet. The compilation
# adds many inferred variant lists, which must not silently grant spell access.
classes={'Bard','Cleric','Druid','Paladin','Ranger','Sorcerer/Wizard','Wizard','Sorcerer','Assassin','Blackguard','Beguiler','Dread Necromancer','Duskblade','Hexblade','Warmage','Wu Jen','Shugenja','Spellthief'}
rows=[]; rejected=[]
for name,book,school,level_text,page in headings(text):
 name=re.sub(r'^PAGE \d+ ', '',name)
 if name=="Kelgore's Fire Mist":name="Kelgore's Fire Bolt"
 levels={}
 for entry in level_text.split(','):
  m=re.fullmatch(r'\s*(.+?)\s+(\d)\s*',entry)
  if m and m[1] in classes:levels['Sorcerer / Wizard' if m[1]=='Sorcerer/Wizard' else m[1]]=int(m[2])
 if not levels:continue
 if len(name)>160 or len(book)>480 or len(school)>160:
  rejected.append(name);continue
 rows.append({'name':name,'school':school,'levels':levels,'book':book,'page':page})
rows.sort(key=lambda s:(s['name'].lower(),s['book']))
(root/'lib/compendium-spell-index.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
print(json.dumps({'indexed':len(rows),'rejected':rejected,'sample':rows[:5]}))
