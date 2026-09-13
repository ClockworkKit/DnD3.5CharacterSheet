// A compact index for prerequisites needing feat categories or known spell schools.
// Source text remains in the existing SRD and supplemental catalogs.
import {readFileSync,writeFileSync} from 'node:fs';
import {expandSpellCatalog} from '../lib/spell-catalog.ts';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const spells=expandSpellCatalog(read('public/data/spells.json'),read('public/data/supplemental-spells.json'));
writeFileSync(new URL('../lib/prerequisite-catalog.json',import.meta.url),JSON.stringify({feats:read('public/data/feats.json').map(({id,name})=>({id,name})),spells:spells.map(s=>({id:s.id,name:s.name,school:s.school.split(/[ (]/)[0],levels:s.levels}))})+'\n');
