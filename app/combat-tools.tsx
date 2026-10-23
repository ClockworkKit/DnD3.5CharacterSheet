'use client';
import {lazy,Suspense,useState,type ReactNode} from 'react';
import type {Spell,Feat} from '@/lib/model';
import {combatToolSections} from '@/lib/combat-tools';
import {Btn,Section,type SheetProps} from './sheet-ui';
import {ClassSystems} from './class-systems';
import {AlternateRuleControls} from './alternate-rule-controls';
import {RacialAbilities} from './racial-abilities';
import {Features} from './features';
import {Gear,SkillsView} from './character-views';
import {ClassAbilityNumbers} from './class-ability-numbers';
const Magic=lazy(()=>import('./magic').then(m=>({default:m.Magic})));

function CombatTool({title,children}:{title:string,children:ReactNode}){
 const [open,setOpen]=useState(false);
 return <details className="combat-context" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{title}</summary>{open&&children}</details>;
}

export function CombatTools(props:SheetProps&{spells:Spell[],feats:Feat[],referenceError:string,retry:()=>void}){
 const sections=combatToolSections(props.c);
 return <Section title="Combat tools" note="These are the same controls and resources as the other tabs. Expand only what you need; closing a panel never restores spent uses.">
  {sections.magic&&<CombatTool title="Spells, powers & Factotum actions"><Suspense fallback={<p>Loading magic…</p>}><Magic {...props}/></Suspense></CombatTool>}
  {(sections.martial||sections.alternateIds.length>0)&&<CombatTool title="Martial & alternate-feature actions">
   {sections.martial&&<ClassSystems {...props} scope="class"/>}
   {sections.alternateIds.map(id=><AlternateRuleControls key={id} {...props} id={id}/>)}
  </CombatTool>}
  <CombatTool title="Class numbers, turning & daily feature uses"><ClassAbilityNumbers {...props}/><Features {...props}/>{props.referenceError&&<div className="error-box">{props.referenceError}<Btn onClick={props.retry}>Retry library</Btn></div>}</CombatTool>
  <CombatTool title="Racial abilities & environment"><RacialAbilities {...props}/></CombatTool>
  <CombatTool title="Equipment, armor & consumables"><Gear {...props}/></CombatTool>
  <CombatTool title="Skills & combat checks"><SkillsView {...props}/></CombatTool>
 </Section>;
}
