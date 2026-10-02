// Explicit maintenance operation; normal builds and tests never access the network.
import fs from 'node:fs/promises';
const base='https://srd.dndtools.org/srd/races/races.html';
await fs.mkdir('work/srd',{recursive:true});
async function download(url){const r=await fetch(url);if(!r.ok)throw Error(url+' '+r.status);const text=await r.text();await fs.writeFile('work/srd/'+new URL(url).pathname.split('/').pop(),text);return text;}
const index=await download(base);
const urls=new Set([...index.matchAll(/href="([^"#]+\.html)(?:#[^"]*)?"/g)].map(m=>new URL(m[1],base).href).filter(u=>u.includes('/races/races')&&u!==base));
for(const url of urls)await download(url);
for(const part of ['A-G','H-W'])await download('https://srd.dndtools.org/srd/monsters/monsters/lm/librismortis'+part+'.html');
console.log('Source cache ready. Run import-ultimate-catalogs.py, then both catalog builders.');
