import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseRepeating} from '../lib/roll20-import.ts';
const script=readFileSync(new URL('../roll20/export35.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function harness({attributes=[],duplicateName=false,name='Example',queryError=false}={}){
 const objects=[],created=[],messages=[];let handler;
 function object(type,id,properties){const o={type,id,properties:{...properties},get(k){return this.properties[k]},set(k,v){this.properties[k]=v}};objects.push(o);return o;}
 const character=object('character','C1',{name}),token=object('graphic','T1',{represents:'C1'});
 if(duplicateName)object('character','C2',{name});
 for(const [i,a] of attributes.entries())object('attribute',a.id||'A'+i,{...a,characterid:'C1'});
 object('ability','ability1',{characterid:'C1',name:'Custom button',action:'[[1d20]]',description:'raw',istokenaction:true});
 const shared=object('handout','shared',{name:'3.5e Export - '+name,inplayerjournals:'all',controlledby:'all',notes:'original'});
 vm.runInNewContext(script,{
  on:(event,fn)=>{if(event==='chat:message')handler=fn;},playerIsGM:id=>id==='GM',
  getObj:(type,id)=>objects.find(o=>o.type===type&&o.id===id),
  findObjs:query=>objects.filter(o=>Object.entries(query).every(([k,v])=>k==='type'?o.type===v:o.get(k)===v)),
  getAttrByName:(id,n,slot)=>{if(queryError&&n==='race')throw Error('test query failure');return objects.find(o=>o.type==='attribute'&&o.get('characterid')===id&&o.get('name')===n)?.get(slot)},
  createObj:(type,properties)=>{const o=object(type,'new'+created.length,properties);created.push(o);return o;},
  sendChat:(who,message)=>messages.push({who,message}),
 });
 const run=(content,more={})=>handler({type:'api',playerid:'GM',selected:[{_id:token.id}],content,...more});
 const exported=()=>{const notes=created.at(-1).get('notes');return JSON.parse(notes.replace(/^<pre>|<\/pre>$/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));};
 return {run,exported,created,messages,shared,character};
}

test('exporter requires GM, exact command, and unambiguous selected/name/id target',()=>{
 const h=harness();h.run('!export35 --selected',{playerid:'player'});h.run('!export35oops --selected');assert.equal(h.created.length,0);assert.equal(h.messages.length,0);
 h.run('!export35 --selected',{selected:[]});h.run('!export35 --selected',{selected:[{_id:'T1'},{_id:'T1'}]});assert.equal(h.created.length,0);
 h.run('!export35 --selected');h.run('!export35 --name "Example"');h.run('!export35 --id C1');assert.equal(h.created.length,3);
 const duplicate=harness({duplicateName:true});duplicate.run('!export35 --name "Example"');assert.equal(duplicate.created.length,0);assert.match(duplicate.messages.at(-1).message,/More than one/);
 duplicate.run('!export35 --id C1');assert.equal(duplicate.created.length,1);
});

test('exporter preserves current/max values, formulas, duplicate fields, abilities, and repeating metadata',()=>{
 const attributes=[
  {id:'a',name:'hp',current:0,max:20},{id:'b',name:'empty',current:'',max:''},{id:'c',name:'false',current:false,max:null},
  {id:'d',name:'formula',current:'@{str}+[[1d20]]',max:'0'},
  {id:'e',name:'_reporder_repeating_custom_section',current:'ROW_B,ROW_A',max:''},
  {id:'f',name:'repeating_custom_section_ROW_A_name',current:'A',max:''},
  {id:'g',name:'repeating_custom_section_ROW_B_name',current:'B',max:''},
  {id:'h',name:'repeating_custom_section_ROW_A_name',current:'duplicate',max:0},
  {id:'i',name:'repeating_weapon_-abcdefghijklmnopq_r_name',current:'Dagger',max:''},
  {id:'j',name:'html',current:'</pre><script>alert(1)</script> & <test>',max:''},
 ];
 const h=harness({attributes});h.run('!export35 --selected');const result=h.exported();
 assert.deepEqual(result.attributes,attributes);assert.deepEqual(result.repeating,plain(parseRepeating(attributes)));
 assert.equal(result.abilities[0].action,'[[1d20]]');assert.equal(result.character.id,'C1');assert.equal(result.version,1);
 assert.doesNotMatch(h.created[0].get('notes'),/<script>/);
});

test('each export creates a GM-only snapshot and cannot reuse or modify a shared handout',()=>{
 const h=harness({name:'Villain [[1d20]] <b>name</b>',queryError:true});h.run('!export35 --selected');h.run('!export35 --selected');
 assert.equal(h.created.length,2);assert.equal(h.shared.get('notes'),'original');assert.equal(h.shared.get('inplayerjournals'),'all');
 for(const handout of h.created){assert.equal(handout.get('inplayerjournals'),'');assert.equal(handout.get('controlledby'),'');}
 for(const {message} of h.messages){assert.match(message,/^\/w gm /);assert.doesNotMatch(message,/\[\[1d20\]\]|<b>name<\/b>/);}
 assert.ok(h.exported().limitations.some(s=>s.includes('Could not query race')));
});
