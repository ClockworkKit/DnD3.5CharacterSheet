"""Import selected Ultimate SRD tables from a local HTML cache; never fetch other SRDs.

Usage: python scripts/import-ultimate-classes.py CACHE
Cache filenames replace '/' in each SRD path with '_'. menu.html is the site's
hometreemenufile.html. Existing IDs and non-class catalogs remain untouched.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(sys.argv[1])
ORIGIN = 'https://srd.dndtools.org/'

def plain(s):
    s = re.sub(r'<br\s*/?>', ' ', s, flags=re.I)
    s = re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', '', s))).strip()
    return s.replace('ï¿½', '—').replace('�', '—')

def number(s):
    m = re.search(r'[+-]?\d+', s)
    if not m:
        raise ValueError('Expected number: ' + s)
    return int(m[0])

def write(path, value):
    (ROOT/path).write_text((json.dumps(value, ensure_ascii=False, indent=2) if path=='lib/supplemental-class-data.json' else json.dumps(value, ensure_ascii=False, separators=(',', ':')))+'\n')

links = {}
for href, label in re.findall(r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', (CACHE/'menu.html').read_text(), re.S|re.I):
    if re.search(r'/classes/(base|prestige)', href):
        links.setdefault(plain(label), href)
aliases = {'psionic-fist': 'Fist of Zuoken', 'slayer': 'Illithid Slayer'}
old = {f: json.loads((ROOT/f).read_text()) for f in ['lib/class-data.json', 'lib/supplemental-class-data.json', 'public/data/classes.json']}
source_map = {c['id']: ORIGIN+links[aliases.get(c['id'], c['name'])] for c in old['public/data/classes.json']}
# Source paths are explicit and can also be reused by the original core importer.
for records in old.values():
    for c in records:
        previous = c['source']
        c['source'] = source_map[c['id']]
        if 'description' in c:
            c['description'] = c['description'].replace(previous, c['source'])

# Curated metadata; progression values and feature milestones come from the tables.
base = {
 'Battle Dancer': ('battle-dancer', None, 'Dances, unarmed damage, and conditional defenses require manual application.'),
 'Death Master': ('death-master', ('INT','prepared','arcane'), 'Undead minions, blood components, and lichdom require manual resolution; armor failure is shown unless a qualifying component removes it.'),
 'Jester': ('jester', ('CHA','spontaneous','arcane'), 'Choose known spells from the Jester list. Performance effects and conditional audacity require manual application. The Ultimate SRD lists Bestow Curse at both 3rd and 4th level; its Jester membership is omitted pending DM review.'),
 'Mountebank': ('mountebank', None, 'Dragon Compendium base class, distinct from the Complete Scoundrel prestige class. Infernal abilities and deceptive attack require manual resolution.'),
 "Sha'ir": ('shair', ('CHA','prepared','arcane'), 'Prepared slots track spells retrieved by the gen. Retrieval checks, travel time, spell expiry, and access to the nine listed divine domains require manual resolution; do not add a second daily slot pool.'),
 'Urban Druid': ('urban-druid', ('CHA','prepared','divine'), 'Urban companions, favored cities, urban shape, and alignment restrictions require manual resolution. Additional light armor needs DM approval.'),
 'Psychic Rogue': ('psychic-rogue', None, 'Choose powers from the Psychic Rogue list. Special abilities and conditional defenses require manual resolution.'),
 'Erudite': ('erudite', None, 'Standard Erudite; excludes spell-to-power variants. Track unique powers per power level each day using the class reference. Learning powers and discipline restrictions require manual review.'),
}
prestige = {
 'Abjurant Champion': ('abjurant-champion', 'Complete Mage', 'Abjurant armor, swift/extended abjurations, arcane boost, and martial arcanist require manual application.'),
 'Master Specialist': ('master-specialist', 'Complete Mage', 'Select a specialist school. School esoterica and expanded spellbook choices require manual resolution.'),
 'Unseen Seer': ('unseen-seer', 'Complete Mage', 'Choose advanced learning spells and the precision damage feature improved. Divination spell power changes caster level by school and requires manual adjustment.'),
 'Frenzied Berserker': ('frenzied-berserker', 'Complete Warrior', 'Frenzy modifiers, loss of control, and improved power attack require manual resolution; frenzy is not ordinary rage.'),
 'Warshaper': ('warshaper', 'Complete Warrior', 'Morphic benefits require a qualifying changed form; apply them manually only while eligible.'),
 'Occult Slayer': ('occult-slayer', 'Complete Warrior', 'Choose a bonded weapon; magical defense and reactive abilities require manual resolution.'),
 'Fist of the Forest': ('fist-of-the-forest', 'Complete Champion', 'Primal living, unarmored defenses, unarmed damage, and feral trance modifiers require manual resolution.'),
 'Dervish': ('dervish', 'Complete Warrior', 'Dance conditions, AC bonus, movement, and slashing-blade treatment require manual resolution.'),
}
profs = {
 'battle-dancer': (True, False, 'none', 'none', []),
 'death-master': (False, False, 'light', 'none', ['Club','Crossbow, light','Crossbow, heavy','Dagger','Scimitar','Scythe','Sickle','Quarterstaff']),
 'jester': (True, False, 'light', 'standard', ['Rapier','Sap','Sword, short','Shortbow','Shortbow, composite','Whip']),
 'mountebank': (True, False, 'light', 'none', []),
 'shair': (True, False, 'none', 'none', []),
 'urban-druid': (False, False, 'none', 'buckler', ['Club','Crossbow, light','Crossbow, heavy','Crossbow, hand','Crossbow, repeating light','Crossbow, repeating heavy','Dagger','Quarterstaff','Rapier','Sap','Sword, short']),
 'psychic-rogue': (True, False, 'light', 'none', ['Crossbow, hand','Rapier','Sap','Shortbow','Shortbow, composite','Sword, short']),
 'erudite': (False, False, 'none', 'none', ['Club','Dagger','Crossbow, heavy','Crossbow, light','Quarterstaff','Shortspear']),
 'occult-slayer': (True, True, 'heavy', 'standard', []),
}
new = []
known = json.loads((ROOT/'lib/spells-known.json').read_text())
for name in list(base)+list(prestige):
    cid = (base.get(name) or prestige[name])[0]
    path = links[name]
    raw = (CACHE/path.replace('/', '_')).read_text()
    paragraphs = [plain(p) for p in re.findall(r'<p\b[^>]*>(.*?)</p>', raw, re.S|re.I)]
    tables = re.findall(r'<table\b[^>]*>((?:(?!<table\b).)*?)</table>', raw, re.S|re.I)
    table = next(t for t in tables if 'Attack' in t and re.search(r'>\s*1st\s*<', t))
    headers = [plain(x) for x in re.findall(r'<th\b[^>]*>(.*?)</th>', table, re.S|re.I)]
    # Some Complete Mage tables use TD rather than TH for their headings.
    if not headers:
        first = re.search(r'<tr\b[^>]*>(.*?)</tr>', table, re.S|re.I)[1]
        headers = [plain(x) for x in re.findall(r'<td\b[^>]*>(.*?)</td>', first, re.S|re.I)]
    special_index = headers.index('Special')
    rows = []
    for tr in re.findall(r'<tr\b[^>]*>(.*?)</tr>', table, re.S|re.I):
        cells = [plain(x) for x in re.findall(r'<td\b[^>]*>(.*?)</td>', tr, re.S|re.I)]
        if not cells or not re.fullmatch(r'\d+(st|nd|rd|th)', cells[0]):
            continue
        extra = [v for i,v in enumerate(cells) if i>=5 and i!=special_index]
        row = dict(zip(['level','bab','fort','ref','will'], map(number,cells[:5])))
        row.update(special=cells[special_index] or '—', extra=extra)
        if name in base and base[name][1]:
            row['slots'] = [number(v) if re.match(r'^\d',v) else None for v in extra]+[None]*(10-len(extra))
        if cid in ['psychic-rogue','erudite']:
            row['powerPoints'] = number(extra[0]);row['powerLevel'] = number(extra[2])
            row['uniquePowers'] = number(extra[1]) if cid=='erudite' else None
            if cid!='erudite':
                del row['uniquePowers'];row['powersKnown'] = number(extra[1])
        rows.append(row)
    expected = 20 if name in base else 3 if cid=='fist-of-the-forest' else 5 if cid in ['abjurant-champion','warshaper','occult-slayer'] else 10
    assert [r['level'] for r in rows]==list(range(1,expected+1)), (name,rows)
    hit = next(p for p in paragraphs if p.startswith('Hit Die'))
    points = next(p for p in paragraphs if re.match('Skill Points at Each',p))
    skills = next(p for p in paragraphs if 'class skills' in p and (' are ' in p or ' includes ' in p))
    req = ''
    if name in prestige:
        section = re.search(r'<h[1-6][^>]*>\s*(?:ENTRY REQUIREMENTS|Requirements)\s*</h[1-6]>(.*?)(?=<h[1-6])',raw,re.S|re.I)
        if not section: raise ValueError('No requirements: '+name)
        req = '\n\n'.join(plain(p) for p in re.findall(r'<p\b[^>]*>(.*?)</p>',section[1],re.S|re.I))
        bullets = [plain(x) for x in re.findall(r'<li\b[^>]*>(.*?)</li>',section[1],re.S|re.I)]
        if bullets: req += ' ' + '; '.join(bullets)
    d = {'id':cid,'name':name,'kind':'Supplemental' if name in base else 'Prestige','hitDie':number(hit),'skillPoints':number(points.split(':',1)[1]),'skills':skills,'alignment':next((p.split(':',1)[1].strip() for p in paragraphs if p.startswith('Alignment:')),''),'requirements':req,'headers':[h for i,h in enumerate(headers) if i>=5 and i!=special_index],'levels':rows,'source':ORIGIN+path,'book':('Complete Psionic' if cid=='erudite' else 'Mind’s Eye' if cid=='psychic-rogue' else 'Dragon Compendium') if name in base else prestige[name][1], 'description':(base[name][2] if name in base else prestige[name][2])+' Base attack, saves, Hit Dice, class skills, feature milestones, and supported spell/power progression follow the Ultimate SRD table.'}
    if name in base and base[name][1]:
        ability,mode,kind = base[name][1];d['casting']={'ability':ability,'mode':mode,'type':kind,'list':'Sorcerer / Wizard' if cid=='shair' else name}
        d['headers']=[str(i) for i in range(len(rows[0]['extra']))]
        if cid in ['jester','shair']:
            kt=next(t for t in tables if t!=table and 'Spells Known' in t)
            kr={}
            for tr in re.findall(r'<tr\b[^>]*>(.*?)</tr>',kt,re.S|re.I):
                cells=[plain(x) for x in re.findall(r'<td\b[^>]*>(.*?)</td>',tr,re.S|re.I)]
                if cells and re.fullmatch(r'\d+(st|nd|rd|th)',cells[0]):kr[str(number(cells[0]))]=[number(v) if re.match(r'^\d',v) else 0 for v in cells[1:]]
            assert len(kr)==20;known[cid]=kr
    if cid in ['psychic-rogue','erudite']:d['manifesting']={'ability':'INT','levelOffset':0,'bonusPoints':0}
    simple,martial,armor,shields,weapons=profs.get(cid,(False,False,'none','none',[]))
    d['proficiencies']={'simple':simple,'martial':martial,'armor':armor,'shields':shields,'weapons':weapons}
    if cid=='urban-druid':d['proficiencies']['armors']=['Padded','Leather','Leather, studded']
    assert len(d['headers'])==len(rows[0]['extra']),(name,d['headers'])
    new.append(d);source_map[cid]=d['source']
for f, records in old.items(): write(f,records)
write('lib/ultimate-class-data.json',new)
write('lib/class-source-urls.json',source_map)
write('public/data/classes.json',[c for c in old['public/data/classes.json'] if c['id'] not in {d['id'] for d in new}]+new)
write('lib/spells-known.json',known)
print('Imported',len(new),'classes; mapped',len(source_map),'class sources.')
