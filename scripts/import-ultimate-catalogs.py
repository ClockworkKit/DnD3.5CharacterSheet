"""Extract reviewable Ultimate SRD facts from cached HTML (BeautifulSoup 4).

Usage: python scripts/import-ultimate-catalogs.py work/srd
Source caches are not distributed; generated catalogs contain rules data, not lore.
"""
import sys, re, json
from pathlib import Path
from urllib.parse import urljoin, urldefrag, unquote
sys.path.insert(0, str(Path('work/python').resolve()))
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(sys.argv[1] if len(sys.argv)>1 else 'work/srd')
BASE = 'https://srd.dndtools.org/srd/races/races.html'
def text(s):
    if isinstance(s,str): s=BeautifulSoup(s,'html.parser')
    return re.sub(r'\s+',' ',s.get_text(' ',strip=True)).strip()
def save(path,data):
    (ROOT/path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
index=BeautifulSoup((CACHE/'races.html').read_text(encoding='utf8'),'html.parser')
entries={}
for a in index.select('a[href]'):
    url=urljoin(BASE,a['href'])
    if '/races/' not in url or '#' not in url: continue
    name=text(a)
    entries.setdefault(url,{'name':name,'source':url})
for filename in sorted({urldefrag(u)[0].split('/')[-1] for u in entries}):
    raw=(CACHE/filename).read_text(encoding='utf8')
    anchors=list(re.finditer(r'<a\b[^>]*(?:id|name)="[^"]+"[^>]*>',raw,re.I))
    indexed={unquote(urldefrag(u)[1]) for u in entries if '/'+filename+'#' in u}
    positions={value:m.start() for m in anchors for value in re.findall(r'(?:id|name)="([^"]+)"',m[0])}
    aliases={'azebloods':'azerbloods','doppelgangers':'dopplegangers','svirfneblin':'Svirfneblin','githyanki':'githtanki'}
    for wrong,right in aliases.items():
        if wrong not in positions and right in positions:positions[wrong]=positions[right]
    for url,e in entries.items():
        if '/'+filename+'#' not in url:continue
        anchor=unquote(urldefrag(url)[1]);start=positions.get(anchor)
        if start is None:
            e['error']='missing anchor';continue
        end=min([p for k,p in positions.items() if k in indexed and p>start]+[len(raw)])
        # An unindexed heading still terminates a creature's section.
        heads=list(re.finditer(r'<h3\b[^>]*>',raw[start:end],re.I))
        if heads and not text(raw[start:start+heads[0].start()]):
            start+=heads[0].start();heads=list(re.finditer(r'<h3\b[^>]*>',raw[start:end],re.I))[1:]
        if heads:end=min(end,start+heads[0].start())
        section=BeautifulSoup(raw[start:end],'html.parser')
        e['text']=text(section)
        e['rules']=[text(li) for li in section.find_all('li') if not li.find_parent('li')]
        e['headings']=[text(h) for h in section.find_all(re.compile('^h[3-6]$'))]
        e['file']=filename
save('work/race-sections.json',list(entries.values()))

monsters=[]
for filename in ['librismortisA-G.html','librismortisH-W.html']:
    raw=(CACHE/filename).read_text(encoding='utf8')
    heads=list(re.finditer(r'<h3>.*?</h3>',raw,re.S))
    for i,h in enumerate(heads):
        heading=BeautifulSoup(h[0],'html.parser');a=heading.find('a')
        if not a:continue
        name=text(heading).title();anchor=a.get('id',a.get('name'))
        soup=BeautifulSoup(raw[h.end():heads[i+1].start() if i+1<len(heads) else len(raw)],'html.parser')
        blocks=soup.select('.size-block')
        for n,block in enumerate(blocks):
            stats={};stop=blocks[n+1] if n+1<len(blocks) else None
            for nxt in block.next_elements:
                if nxt is stop:break
                if getattr(nxt,'attrs',{}).get('class') and 'stat-block' in nxt['class']:
                    line=text(nxt)
                    if ':' in line:
                        key,value=line.split(':',1)
                        if key in stats:break
                        stats[key.strip()]=value.strip()
            if 'Hit Dice' not in stats:continue
            monsters.append({'name':name+(' '+str(n+1) if len(blocks)>1 else ''),'source':'https://srd.dndtools.org/srd/monsters/monsters/lm/'+filename+'#'+anchor,'sizeType':text(block),'stats':stats,'templateExample':bool(soup.find(re.compile('^h[45]$'),string=re.compile('SAMPLE|Sample')))})
save('work/monster-blocks.json',monsters)
print(json.dumps({'raceEntries':len(entries),'missing':[e['source'] for e in entries.values() if e.get('error')],'monsterBlocks':len(monsters)}))
