/* Roll20 Mod/API script. Install in Game Settings → Mod (API) Scripts.
 * Field names: Roll20/roll20-character-sheets, D&D_3-5/charsheet_3-5.html.
 * Version 1 exports retain raw Attribute objects; formulas are never evaluated.
 */
(function(){
  'use strict';
  var CORE=['character_name','race','racetype','playername','alignment','deity','expcurrent','level','size','age','gender','height','weight','skin','eyes','hair','homeland','languages','classabilities','racialabilities','feats','hitpoints','hitpoints_max','temphp','nonlethaldamage','speed','init','initmiscmod','inittempmod','bab','grapple','grapplemiscmod','grappletempmod','armorclass','acitembonus','acitemdex','armorworn','shieldworn','shieldbonus','armorcheckpenalty','acitemcheckpenalty','shieldcheckpenalty','acitemspellfailure','shieldspellfailure','arcanespellfailure','armorclassnaturalarmor','armorclassdodgemod','armorclassdeflectionmod','armorclassmiscmod','spellresistance','damagereduction','copper','silver','gold','platinum','arcanecasterlevel','arcanecastingstat','divinecasterlevel','divinecastingstat','spellpen','manifesterlevel','powerpoints','powerpoints_max','tempBonusEnabled'];
  ['str','dex','con','int','wis','cha'].forEach(function(a){['','-base','-misc','-equi','-temp','-action'].forEach(function(s){CORE.push(a+s);});});
  ['fortitude','reflex','will'].forEach(function(a){['','base','magicmod','miscmod','tempmod','actionmod','epicsavemod'].forEach(function(s){CORE.push(a+s);});});
  ['appraise','balance','bluff','climb','concentration','decipherscript','diplomacy','disabledevice','disguise','escapeartist','forgery','gatherinformation','handleanimal','heal','hide','intimidate','jump','knowarcana','knowengineer','knowdungeon','knowgeography','knowhistory','knowlocal','knownature','knownobility','knowpsionic','knowreligion','knowplanes','listen','movesilently','openlock','ride','search','sensemotive','sleightofhand','spellcraft','spot','survival','swim','tumble','usemagicdevice','userope'].forEach(function(a){['','ranks','miscmod','tempmod','classskill'].forEach(function(s){CORE.push(a+s);});});
  for(var i=1;i<=10;i++){CORE.push('class'+i,'level'+i);}
  for(var level=0;level<=9;level++){CORE.push('arcanespells'+level,'divinespells'+level);}
  function html(value){return String(value===undefined?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function chat(value){return html(value).replace(/[\[\]{}\r\n]/g,function(s){return '&#'+s.charCodeAt(0)+';';});}
  function args(s){var out=[],m,rx=/"([^"\\]*(?:\\.[^"\\]*)*)"|(\S+)/g;while((m=rx.exec(s)))out.push(m[1]!==undefined?m[1].replace(/\\(["\\])/g,'$1'):m[2]);return out;}
  function characterFrom(msg){
    var a=args(msg.content),mode=a[1],value=a[2];
    if(mode==='--selected'&&a.length===2){
      if(!msg.selected||msg.selected.length!==1)throw Error('Select exactly one token that represents a character.');
      var token=getObj('graphic',msg.selected[0]._id);
      if(!token||!token.get('represents'))throw Error('Select a token that represents a character.');
      return getObj('character',token.get('represents'));
    }
    if(mode==='--id'&&value&&a.length===3)return getObj('character',value);
    if(mode==='--name'&&value&&a.length===3){
      var hits=findObjs({type:'character',name:value});
      if(hits.length===1)return hits[0];
      if(hits.length>1)throw Error('More than one character has that name. Use --id.');
      throw Error('Character not found. Check the exact name or use --id.');
    }
    throw Error('Use !export35 --selected, --name "Character Name", or --id CHARACTER_ID.');
  }
  function groupAttributes(attributes){
    var groups=Object.create(null),orders=Object.create(null);
    attributes.forEach(function(a){if(a.name.indexOf('_reporder_repeating_')===0&&typeof a.current==='string')orders[a.name.slice(20)]=a.current.split(',').filter(Boolean);});
    attributes.forEach(function(a){
      if(a.name.indexOf('repeating_')!==0)return;
      var match=null;
      Object.keys(orders).sort(function(a,b){return b.length-a.length;}).some(function(section){
        var prefix='repeating_'+section+'_';if(a.name.indexOf(prefix)!==0)return false;
        var rest=a.name.slice(prefix.length),row=orders[section].filter(function(id){return rest.indexOf(id+'_')===0;})[0];
        if(row){match=[a.name,section,row,rest.slice(row.length+1)];return true;}return false;
      });
      match=match||a.name.match(/^repeating_([^_]+)_(-[A-Za-z0-9_-]{19})_(.+)$/)||a.name.match(/^repeating_([^_]+)_([^_]+)_(.+)$/);
      if(!match)return;
      var section=match[1],rowId=match[2],field=match[3];
      var group=groups[section]||(groups[section]={section:section,rows:Object.create(null)});
      var row=group.rows[rowId]||(group.rows[rowId]={rowId:rowId,fields:Object.create(null)});
      (row.fields[field]||(row.fields[field]=[])).push({name:field,current:a.current,max:a.max,attributeId:a.id,originalName:a.name});
    });
    Object.keys(orders).forEach(function(section){if(!groups[section])return;var rows=groups[section].rows,sorted=Object.create(null);orders[section].concat(Object.keys(rows)).forEach(function(id){if(rows[id])sorted[id]=rows[id];});groups[section].rows=sorted;});
    return groups;
  }
  function exportCharacter(ch){
    var raw=findObjs({type:'attribute',characterid:ch.id}).map(function(a){return {id:a.id,name:a.get('name'),current:a.get('current'),max:a.get('max')};});
    var resolved=Object.create(null),limitations=['Sheet defaults without instantiated Attribute objects are included only for the known core names. getAttrByName may return formulas; these are preserved without execution.'];
    CORE.forEach(function(name){try{var value=getAttrByName(ch.id,name,'current'),max=getAttrByName(ch.id,name,'max');if(value!==undefined)resolved[name]=value;if(max!==undefined)resolved[name+'_max']=max;}catch(e){limitations.push('Could not query '+name+': '+e.message);}});
    var abilities=findObjs({type:'ability',characterid:ch.id}).map(function(a){return {id:a.id,name:a.get('name'),action:a.get('action'),description:a.get('description'),istokenaction:a.get('istokenaction')};});
    return {format:'roll20-dnd35-export',version:1,exportedAt:new Date().toISOString(),character:{id:ch.id,name:ch.get('name')},attributes:raw,abilities:abilities,repeating:groupAttributes(raw),resolvedCoreValues:resolved,limitations:limitations};
  }
  on('chat:message',function(msg){
    if(msg.type!=='api'||!/^!export35(?:\s|$)/.test(msg.content)||!playerIsGM(msg.playerid))return;
    try{
      var ch=characterFrom(msg);if(!ch)throw Error('Character not found.');
      var data=exportCharacter(ch);
      // Always create a private snapshot. Never reuse a possibly shared handout by name.
      var title='3.5e Export - '+ch.get('name')+' - '+data.exportedAt;
      var h=createObj('handout',{name:title,inplayerjournals:'',controlledby:''});
      if(!h)throw Error('Could not create the export handout.');
      h.set('notes','<pre>'+html(JSON.stringify(data,null,2))+'</pre>');
      var rows=Object.keys(data.repeating).reduce(function(n,s){return n+Object.keys(data.repeating[s].rows).length;},0);
      sendChat('export35','/w gm Exported '+chat(ch.get('name'))+': '+data.attributes.length+' attributes and '+rows+' repeating rows. Open handout: '+chat(title));
    }catch(e){sendChat('export35','/w gm <b>Export failed:</b> '+chat(e.message));}
  });
}());
