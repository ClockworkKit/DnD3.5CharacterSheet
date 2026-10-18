"""Extract spell metadata and reference text from user-supplied Spells v6.01.pdf.

Usage: python scripts/import-spell-compendium.py /path/to/Spells-v6.01.pdf
Requires pypdfium2. Existing SRD and verified class-list entries take precedence
at catalog build time.
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
text=text.replace('\r','').replace('\ufffe','-').replace('’',"'").replace('‘',"'").replace('\ufffd',"'").replace('`',"'")
text=re.sub(r'\n+', '\n',text)
lines=[re.sub(r'\s+',' ',line).strip() for line in text.splitlines()]
fields={'Components':'components','Casting Time':'castingTime','Range':'range','Target':'target',
        'Effect':'effect','Area':'area','Duration':'duration','Saving Throw':'save',
        'Spell Resistance':'resistance'}
school_re=r'^(Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation|Universal)\b'

def detail_value(value,fallback='Not listed in the compilation.'):
 value=re.sub(r'\s+',' ',value).strip()
 return value or fallback

def parse_heading(i):
 if not lines[i].startswith('Level:') or i<2:return None
 school=lines[i-1]
 if not re.match(school_re,school):return None
 head=lines[i-2];j=i-2
 while '[' not in head and j>0 and i-j<6:
  j-=1;head=lines[j]+' '+head
 h=re.fullmatch(r'(.+?)\s*\[([^\]]+)\]',head)
 if not h:return None
 level=lines[i][6:].strip();k=i+1
 while k<len(lines) and ':' not in lines[k] and not lines[k].startswith('PAGE '):
  level+=' '+lines[k];k+=1
 page=next((int(x[5:]) for x in reversed(lines[:i]) if re.fullmatch(r'PAGE \d+',x)),1)
 return {'name':h[1],'book':h[2],'school':school,'level':level,'page':page,'start':j}

def headings():
 found=[]
 for i in range(len(lines)):
  item=parse_heading(i)
  if item:found.append(item)
 for index,item in enumerate(found):
  end=found[index+1]['start'] if index+1<len(found) else len(lines)
  block=lines[item['start']:end];values={};last_field=-1
  for offset,line in enumerate(block):
   match=re.match(r'^(Components|Casting Time|Range|Target|Effect|Area|Duration|Saving Throw|Spell Resistance):\s*(.*)$',line)
   if match:
    values[fields[match[1]]]=[match[2]];last_field=offset
  details={key:detail_value(value[0]) for key,value in values.items()}
  description=[line for line in block[last_field+1:] if not line.startswith('PAGE ') and not line.startswith('-')]
  details['target']=details.get('target') or details.get('effect') or 'Not listed in the compilation.'
  details['description']=detail_value(' '.join(description),'The compilation does not include an effect description for this entry.')
  details.pop('effect',None);details.pop('area',None)
  item['details']=details
  yield item

# Only published casting traditions already supported by this sheet. The compilation
# adds many inferred variant lists, which must not silently grant spell access.
classes={'Bard','Cleric','Druid','Paladin','Ranger','Sorcerer/Wizard','Wizard','Sorcerer','Assassin','Blackguard','Beguiler','Dread Necromancer','Duskblade','Hexblade','Warmage','Wu Jen','Shugenja','Spellthief'}
rows=[];rejected=[]
for entry in headings():
 name,book,school,level_text,page=entry['name'],entry['book'],entry['school'],entry['level'],entry['page']
 name=re.sub(r'^PAGE \d+ ', '',name)
 if name=="Kelgore's Fire Mist":name="Kelgore's Fire Bolt"
 levels={}
 for value in level_text.split(','):
  match=re.fullmatch(r'\s*(.+?)\s+(\d)\s*',value)
  if match and match[1] in classes:levels['Sorcerer / Wizard' if match[1]=='Sorcerer/Wizard' else match[1]]=int(match[2])
 if not levels:continue
 if len(name)>160 or len(book)>480 or len(school)>160:
  rejected.append(name);continue
 rows.append({'name':name,'school':school,'levels':levels,'book':book,'page':page,'details':entry['details']})
rows.sort(key=lambda s:(s['name'].lower(),s['book']))
(root/'lib/compendium-spell-index.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
print(json.dumps({'indexed':len(rows),'rejected':rejected,'sample':rows[:2]}))
