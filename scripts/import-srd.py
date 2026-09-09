"""Convert the OGL 3.5 SRD HTML mirror into plain-text reference data.
Usage: python scripts/import-srd.py /path/to/srd-source
Source: https://github.com/olimot/srd-v3.5 (master)
"""
import sys, re, json, html
from pathlib import Path

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'public' / 'data'
out.mkdir(parents=True, exist_ok=True)
def plain(value):
    value = re.sub(r'</(?:p|li|tr|h\d|div|ul|ol|table)>', '\n\n', value)
    value = re.sub(r'<br\s*/?>', '\n', value)
    value = re.sub(r'</(?:td|th)>', ' | ', value)
    value = html.unescape(re.sub(r'<[^>]+>', '', value))
    return '\n\n'.join(re.sub(r'\s+', ' ', x).strip(' |') for x in value.split('\n\n') if x.strip(' \n|'))

classes = {'Brd':'Bard', 'Clr':'Cleric', 'Drd':'Druid', 'Pal':'Paladin', 'Rgr':'Ranger', 'Sor/Wiz':'Sorcerer / Wizard', 'Wiz':'Wizard'}
spells = []
for file in sorted((source/'spells').glob('spells-*.html')):
    raw = file.read_text()
    headers = list(re.finditer(r'<h2 id="([^"]+)">(.*?)</h2>', raw, re.S))
    for i, h in enumerate(headers):
        block = raw[h.end():headers[i+1].start() if i+1<len(headers) else raw.index('</body>')]
        meta = {}
        for p in re.finditer(r'<p>\s*<strong>([^<]+):</strong>(.*?)</p>', block, re.S):
            meta[plain(p.group(1))] = plain(p.group(2))
        if 'Level' not in meta:
            if '(Spell Name)' in plain(h.group(2)): continue
            raise ValueError('Missing spell level: '+h.group(1))
        levels = {classes.get(m.group(1).strip(),m.group(1).strip()):int(m.group(2)) for m in re.finditer(r'([A-Za-z/ ]+)\s+(\d)',meta['Level'])}
        if not levels: raise ValueError('Unparsed levels: '+meta['Level'])
        school = re.search(r'<p>(.*?)</p>',block,re.S)
        desc = re.sub(r'<p>\s*<strong>([^<]+):</strong>.*?</p>', '', block, flags=re.S)
        if school: desc=desc.replace(school.group(0),'',1)
        spells.append({'id':h.group(1),'name':plain(h.group(2)), 'school':plain(school.group(1)) if school else '', 'levels':levels,
          'levelText':meta['Level'],'components':meta.get('Components','See description'), 'castingTime':meta.get('Casting Time','See description'),
          'range':meta.get('Range','See description'),'target':meta.get('Target',meta.get('Targets',meta.get('Area',meta.get('Effect','See description')))),
          'duration':meta.get('Duration','See description'),'save':meta.get('Saving Throw','See description'),'resistance':meta.get('Spell Resistance','See description'),
          'description':plain(desc),'source':'https://olimot.github.io/srd-v3.5/spells/'+file.name+'#'+h.group(1)})
spells.sort(key=lambda x:x['name'].lower())
assert len(spells)>550 and len({s['id'] for s in spells})==len(spells)
(out/'spells.json').write_text(json.dumps(spells,ensure_ascii=False,separators=(',',':')))
raw=(source/'basic-rules-and-legal/feats.html').read_text()
headers=list(re.finditer(r'<h3 id="([^"]+)">(.*?)</h3>',raw,re.S))
feats=[]
for i,h in enumerate(headers):
    name=plain(h.group(2))
    if '[' not in name or h.group(1)=='feat-name':continue
    block=raw[h.end():headers[i+1].start() if i+1<len(headers) else raw.index('</body>')]
    feats.append({'id':h.group(1),'name':name,'description':plain(block),'source':'https://olimot.github.io/srd-v3.5/basic-rules-and-legal/feats.html#'+h.group(1)})
(out/'feats.json').write_text(json.dumps(feats,ensure_ascii=False,separators=(',',':')))
legal=(source/'basic-rules-and-legal/legal-information.html').read_text()
legal=legal[legal.index('<body>')+6:legal.index('</body>')]
notice='Barrow Ledger: SRD reference data\n\nThe spell and feat reference text and derived game mechanics are Open Game Content, provided under the Open Game License version 1.0a below. Character names, user notes, and the Barrow Ledger visual design are not designated Open Game Content.\n\nTranscribed from https://github.com/olimot/srd-v3.5 on 2026-09-08.\n\n'
(out/'OPEN-GAME-LICENSE.txt').write_text(notice+plain(legal)+'\n')
print(json.dumps({'spells':len(spells),'feats':len(feats),'classes':sorted(set(k for s in spells for k in s['levels']))}))
