// Explicit maintenance operation; normal builds and tests never access the network.
import fs from 'node:fs/promises';

const base='https://srd.dndtools.org/';
const source=JSON.parse(await fs.readFile(new URL('../lib/alternate-feature-data.json',import.meta.url),'utf8'));
const pages=[...new Set(source.map(row=>row.source.split('#')[0]))];

function decode(value){
 return value.replace(/&#(x?[0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex[0].toLowerCase()==='x'?hex.slice(1):hex,hex[0].toLowerCase()==='x'?16:10))).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'\"').replace(/&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function text(fragment){return decode(fragment.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());}
function paragraphs(page,anchor){
 const escaped=anchor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const marker=new RegExp(`<a\\b[^>]*(?:id|name)=["']${escaped}["'][^>]*>`,'i');
 const match=marker.exec(page);if(!match)throw Error('Missing source anchor: '+anchor);
 const next=page.slice(match.index+match[0].length).search(/<a\b[^>]*(?:id|name)=["'][^"']+["'][^>]*>/i);
 const section=page.slice(match.index,next<0?page.length:match.index+match[0].length+next);
 return [...section.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>text(m[1])).filter(Boolean);
}
function summary(rows){
 const preferred=rows.findIndex(row=>/^(?:Benefit|Benefits|Effect|Effects|Gain|Special|Description)\s*:/i.test(row));
 const selected=preferred>=0?rows.slice(preferred):rows.filter(row=>!/^\s*(?:Class|Level|Replaces|Prerequisite|Special Requirement)\s*:/i.test(row));
 const clean=selected.join(' ').replace(/^(?:Benefit|Benefits|Effect|Effects|Gain|Special|Description)\s*:\s*/i,'').trim();
 if(!clean)return 'Record the feature’s effect in Rule notes; this entry is a reference collection rather than a single automatic ability.';
 const sentences=clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[clean];let out='';
 for(const sentence of sentences){if((out+' '+sentence).trim().length>900)break;out=(out+' '+sentence).trim();}
 return out||clean.slice(0,900).trim();
}

const html=new Map(await Promise.all(pages.map(async url=>{const response=await fetch(new URL(url,base));if(!response.ok)throw Error(url+' '+response.status);return [url,await response.text()];})));
const effects={};
for(const row of source){const [url,anchor]=row.source.split('#');effects[row.id]=summary(paragraphs(html.get(url),anchor));}
await fs.writeFile(new URL('../lib/alternate-feature-effects.json',import.meta.url),JSON.stringify(effects,null,2)+'\n');
console.log(`Built ${Object.keys(effects).length} alternate-feature effect summaries from ${pages.length} source pages.`);
