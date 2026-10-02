// Build offline, portable reference text from the existing library and reviewed notes.
// Run after updating source-detail-notes.ts or the class/race reference catalogs.
import fs from 'node:fs/promises';
import {classDetailNotes,raceDetailNotes} from '../lib/source-detail-notes.ts';
const read=async path=>JSON.parse(await fs.readFile(path,'utf8'));
const classes=await read('public/data/classes.json');
const races=await read('public/data/races.json');
const extras=await read('lib/ultimate-race-data.json');
const urls=await read('lib/race-source-urls.json');
const selected=['factotum','rogue','sorcerer','cleric','bard'];
const classRefs=Object.fromEntries(selected.map(id=>{
 const d=classes.find(d=>d.id===id);if(!d)throw Error('Missing class '+id);
 return [id,{book:id==='factotum'?'Dungeonscape, pp. 14–17':'Player’s Handbook / Revised 3.5 SRD',url:d.source,text:classDetailNotes[id]||d.description}];
}));
const raceRefs=Object.fromEntries([...races,...extras].filter(d=>raceDetailNotes[d.id]||/elf|elves/i.test(d.name)).map(d=>[d.id,{
 book:d.book,url:urls[d.id]||d.source,
 text:raceDetailNotes[d.id]||d.reference||[...d.traits,...(d.manualHandling||[]),...(d.parentSource?['Parent race rules: '+d.parentSource]:[])].join('\n\n'),
}]));
await fs.writeFile('lib/character-source-data.json',JSON.stringify({classes:classRefs,races:raceRefs},null,2)+'\n');
