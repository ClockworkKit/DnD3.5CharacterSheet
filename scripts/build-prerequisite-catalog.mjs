// A compact index for prerequisites needing feat categories or known spell schools.
// Source text remains in the existing SRD and supplemental catalogs.
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {expandSpellCatalog} from '../lib/spell-catalog.ts';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
export function buildPrerequisiteCatalog(){
 const spells=expandSpellCatalog(read('public/data/spells.json'),read('public/data/supplemental-spells.json'));
 const feats=read('public/data/feats.json').map(({id,name,category,prerequisites,repeatable,specialConditions,tags})=>({id,name,category,prerequisites,repeatable,specialConditions,tags}));
 writeFileSync(new URL('../lib/prerequisite-catalog.json',import.meta.url),JSON.stringify({feats,spells:spells.map(s=>({id:s.id,name:s.name,school:s.school.split(/[ (]/)[0],levels:s.levels}))})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)buildPrerequisiteCatalog();
