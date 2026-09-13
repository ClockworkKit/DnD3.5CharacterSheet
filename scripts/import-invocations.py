"""Import factual invocation metadata; descriptions remain linked to the source.
Requires lxml. Run from the repository root.
"""
import json,re,urllib.request,urllib.parse
from lxml import html
ROOT='https://srd.dndtools.org/srd/magic/invocations/'
cache={}
def page(url):
 if url not in cache: cache[url]=html.fromstring(urllib.request.urlopen(url,timeout=60).read())
 return cache[url]
def normal(s):return re.sub(r'[^a-z0-9]','',urllib.parse.unquote(s).lower().replace('’',"'"))
rows=[]
for cls,path in [('warlock','warlockInvocations.html'),('dragonfire-adept','dragonShamanInvocations.html')]:
 url=ROOT+'classInvocationLists/'+path
 for a in page(url).xpath('//tr/td/a[@href]'):
  name=' '.join(a.text_content().split());src=urllib.parse.urljoin(url,a.get('href'));base,fragment=urllib.parse.urldefrag(src)
  d=page(base);anchors=d.xpath('//a[@name]');match=next((e for e in anchors if normal(e.get('name'))==normal(fragment)),None)
  if match is None:match=next((e for e in anchors if normal(e.getparent().text_content())==normal(name)),None)
  if match is None:raise ValueError((name,src))
  h=match.getparent();parts=[]
  for e in h.itersiblings():
   if e.tag=='h6':break
   parts.append(' '.join(e.text_content().split()))
  text=' '.join(parts);m=re.search(r'(Least|Lesser|Greater|Dark)\s*;\s*(\d)',text,re.I)
  if not m:raise ValueError((name,text[:150]))
  grade=m[1].lower();level=int(m[2]);category='essence' if 'eldritch essence' in text[:180].lower() else 'shape' if 'blast shape' in text[:180].lower() else 'other'
  src=base+'#'+urllib.parse.quote(urllib.parse.unquote(match.get('name')),safe='')
  rows.append(dict(id=cls+':'+re.sub('[^a-z0-9]+','-',name.lower()).strip('-'),name=name,classId=cls,grade=grade,level=level,category=category,source=src))
rows.sort(key=lambda x:(x['classId'],x['name']))
with open('public/data/invocations.json','w') as f:json.dump(rows,f,indent=2,ensure_ascii=False);f.write('\n')
print(len(rows),'invocation memberships imported')
