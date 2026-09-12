"""Import the revised SRD class tables and psionic power reference (OGL 1.0a)."""
import re,html,json,sys
from pathlib import Path
src=Path(sys.argv[1]); root=Path(__file__).resolve().parents[1]
def plain(s):
 s=re.sub(r'</(?:p|li|tr|h\d|div|ul|ol|table)>','\n\n',s)
 s=re.sub(r'<br\s*/?>',' ',s)
 s=re.sub(r'</(?:td|th)>',' | ',s)
 s=html.unescape(re.sub('<[^>]+>','',s))
 return '\n\n'.join(re.sub(r'\s+',' ',x).strip(' |') for x in s.split('\n\n') if x.strip(' \n|'))
def number(s):
 m=re.search(r'[+-]?\d+',s);return int(m[0]) if m else 0
core={'barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','wizard'}
psi={'psion','psychic-warrior','soulknife','wilder'}
spellclasses={'bard':0,'cleric':0,'druid':0,'sorcerer':0,'wizard':0,'paladin':1,'ranger':1,'assassin':1,'blackguard':1}
classes=[]
for filename in ['character-classes-i.html','character-classes-ii.html','prestige-classes.html','psionic-classes.html']:
 raw=(src/filename).read_text(); hs=list(re.finditer(r'<h2 id="([^"]+)">(.*?)</h2>',raw,re.S))
 for i,h in enumerate(hs):
  cid=h[1];body=raw[h.end():hs[i+1].start() if i+1<len(hs) else raw.index('</body>')]
  die=re.search(r'<strong>Hit Die:</strong>\s*d(\d+)',body)
  if not die:continue
  tables=re.findall(r'<table\b[^>]*>.*?</table>',body,re.S)
  table=next((t for t in tables if re.search(r'Base(?:<[^>]+>|\s)*Attack',t)),None)
  if not table:raise ValueError('Missing table '+cid)
  headers=[plain(x) for x in re.findall(r'<th\b[^>]*>(.*?)</th>',table,re.S)]
  rows=[]
  for tr in re.findall(r'<tr\b[^>]*>(.*?)</tr>',table,re.S):
   cells=[plain(x) for x in re.findall(r'<td\b[^>]*>(.*?)</td>',tr,re.S)]
   if not cells or not re.match(r'^\d+(st|nd|rd|th)$',cells[0]) or len(cells)<6:continue
   row={'level':number(cells[0]),'bab':number(cells[1]),'fort':number(cells[2]),'ref':number(cells[3]),'will':number(cells[4]),'special':cells[5], 'extra':cells[6:]}
   if cid in spellclasses:
    row['slots']=[None]*10
    for n,v in enumerate(cells[6:]):
     if n+spellclasses[cid]>9:break
     row['slots'][n+spellclasses[cid]]=number(v) if re.match(r'^\d',v) else None
   if cid in {'psion','psychic-warrior','wilder','psionic-fist','war-mind'}:
    row['powerPoints']=number(cells[6]);row['powersKnown']=number(cells[7]);row['powerLevel']=number(cells[8])
   rows.append(row)
  if not rows:raise ValueError('No rows '+cid)
  skills=re.search(r'<h3[^>]*class-skills[^>]*>.*?</h3>\s*<p>(.*?)</p>',body,re.S)
  skillpoints=re.search(r'Skill Points at Each(?: Additional)? Level:</strong>\s*(\d+)',body)
  req=re.search(r'<h3[^>]*requirements[^>]*>.*?</h3>(.*?)(?=<h3)',body,re.S)
  alignment=re.search(r'<strong>Alignment:</strong>(.*?)</p>',body,re.S)
  directory='psionics' if filename.startswith('psionic') else 'basic-rules-and-legal'
  classes.append({'id':cid,'name':plain(h[2]),'kind':'Core' if cid in core else 'Psionic' if cid in psi else 'Prestige','hitDie':int(die[1]),'skillPoints':int(skillpoints[1]) if skillpoints else 2,'skills':plain(skills[1]) if skills else '', 'alignment':plain(alignment[1]) if alignment else '', 'requirements':plain(req[1]) if req else '', 'headers':headers[:len(rows[0]['extra'])+6], 'levels':rows,'source':'https://olimot.github.io/srd-v3.5/'+directory+'/'+filename+'#'+cid,'description':plain(body.replace(table,'',1))})
classes.sort(key=lambda x:({'Core':0,'Psionic':1,'Prestige':2}[x['kind']],x['name']))
assert len(classes)==39,len(classes)
# Curated supplemental entries are not part of the SRD HTML source.
existing=json.loads((root/'public/data/classes.json').read_text())
classes += [c for c in existing if c['id']=='factotum']
supplemental=json.loads((root/'lib/supplemental-class-data.json').read_text())
(root/'public/data/classes.json').write_text(json.dumps(classes+supplemental,ensure_ascii=False,separators=(',',':')))
(root/'lib/class-data.json').write_text(json.dumps([{k:v for k,v in c.items() if k!='description'} for c in classes],ensure_ascii=False,separators=(',',':')))
powers=[]
for file in sorted(src.glob('psionic-powers-*.html')):
 raw=file.read_text();hs=list(re.finditer(r'<h2 id="([^"]+)">(.*?)</h2>',raw,re.S))
 for i,h in enumerate(hs):
  body=raw[h.end():hs[i+1].start() if i+1<len(hs) else raw.index('</body>')]
  meta={plain(k):plain(v) for k,v in re.findall(r'<p>\s*<strong>([^<]+):</strong>(.*?)</p>',body,re.S)}
  if 'Level' not in meta:continue
  school=re.search(r'<p>(.*?)</p>',body,re.S)
  desc=re.sub(r'<p>\s*<strong>(?:Level|Display|Manifesting Time|Range|Target|Targets|Area|Effect|Duration|Saving Throw|Power Resistance|Power Points):</strong>.*?</p>','',body,flags=re.S)
  if school:desc=desc.replace(school[0],'',1)
  levels={m[1].strip().title():int(m[2]) for m in re.finditer(r'([A-Za-z/ -]+)\s+(\d)',meta['Level'])}
  powers.append({'id':h[1],'name':plain(h[2]),'school':plain(school[1]) if school else '', 'levels':levels,'levelText':meta['Level'],'cost':number(meta.get('Power Points','1')),'display':meta.get('Display','See description'),'manifesting':meta.get('Manifesting Time','See description'),'range':meta.get('Range','See description'),'target':meta.get('Target',meta.get('Area',meta.get('Effect','See description'))),'duration':meta.get('Duration','See description'),'save':meta.get('Saving Throw','None'),'resistance':meta.get('Power Resistance','See description'),'description':plain(desc),'source':'https://olimot.github.io/srd-v3.5/psionics/'+file.name+'#'+h[1]})
powers.sort(key=lambda x:x['name']);assert len(powers)>250
(root/'public/data/powers.json').write_text(json.dumps(powers,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'classes':len(classes),'core':len([c for c in classes if c['kind']=='Core']),'psionic':len([c for c in classes if c['kind']=='Psionic']),'prestige':len([c for c in classes if c['kind']=='Prestige']),'powers':len(powers)}))
for c in classes:
 if c['id'] in ['bard','cleric','monk','psion','psychic-warrior','assassin','war-mind']:print(c['name'],c['levels'][2])
# The prestige class lists supplement levels omitted from alphabetical spell entries.
spells_path=root/'public/data/spells.json';spells=[s for s in json.loads(spells_path.read_text()) if s['id']!='corrupt-weapon']
prestige=(src/'prestige-classes.html').read_text()
def normalize(name):
 name=name.lower().replace('’',"'").strip(' .,*')
 if ', ' in name:
  first,last=name.split(', ',1);name=last+' '+first
 return re.sub(r'[^a-z0-9]','',name)
byname={normalize(s['name']):s for s in spells}
if not any(s['id']=='corrupt-weapon' for s in spells):
 bless=next(s for s in spells if s['id']=='bless-weapon')
 corrupt={**bless,'id':'corrupt-weapon','name':'Corrupt Weapon','levels':{'Blackguard':1},'levelText':'Blackguard 1','description':'This is the counterpart of Bless Weapon, improving a weapon against good foes. Use the following reversed effects.\n\n'+re.sub(r'\b(evil|good)\b',lambda m: 'evil' if m[0].lower()=='good' else 'good',bless['description'],flags=re.I),'source':'https://olimot.github.io/srd-v3.5/basic-rules-and-legal/prestige-classes.html#corrupt-weapon'}
 spells.append(corrupt);byname[normalize(corrupt['name'])]=corrupt
for cid,label in [('assassin','Assassin'),('blackguard','Blackguard')]:
 section=re.search(r'<h3 id="'+cid+r'-spell-list">.*?</h3>(.*?)(?=<h[23])',prestige,re.S)[1]
 for level,names in re.findall(r'(\d)(?:st|nd|rd|th) Level:\s*<i\s*>(.*?)</i\s*>',section,re.S):
  for name in plain(names).split(','):
   key=normalize(name)
   if key=='protectionfromelements':key='protectionfromenergy'
   if key not in byname:raise ValueError('Unknown prestige spell '+name)
   spell=byname[key];spell['levels'][label]=int(level)
   if label not in spell['levelText']:spell['levelText']+=', '+label+' '+level
spells.sort(key=lambda x:x['name'].lower());spells_path.write_text(json.dumps(spells,ensure_ascii=False,separators=(',',':')))
print('Prestige spell lists:',{name:len([s for s in spells if name in s['levels']]) for name in ['Assassin','Blackguard']})
