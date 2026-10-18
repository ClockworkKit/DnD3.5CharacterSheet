'use client';
import {hasAlternateFeature} from '@/lib/alternate-features';
import {Check,Btn,type SheetProps} from './sheet-ui';

export function AlternateCombatContext({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const x=c.automation.context;
 const set=(patch:Partial<typeof x>)=>edit(d=>Object.assign(d.automation.context,patch));
 const options=[
  hasAlternateFeature(c,'rogue-lightbringer-strike')&&<Check key="lightbringerStrike" label="Lightbringer Strike: half sneak attack when flanking an immune target" checked={x.lightbringerStrike} onChange={v=>set({lightbringerStrike:v})}/>,
  hasAlternateFeature(c,'rogue-penetrating-strike')&&<Check key="penetratingStrike" label="Penetrating Strike: half sneak attack when flanking an immune target" checked={x.penetratingStrike} onChange={v=>set({penetratingStrike:v})}/>,
  hasAlternateFeature(c,'rogue-disruptive-attack')&&<Check key="disruptiveAttack" label="Disruptive Attack: trade sneak attack for -5 target AC" checked={x.disruptiveAttack} onChange={v=>set({disruptiveAttack:v})}/>,
  hasAlternateFeature(c,'monk-holy-strike')&&<Check key="holyStrike" label="Holy Strike: extra 1d6 against an evil target" checked={x.holyStrike} onChange={v=>set({holyStrike:v})}/>
 ].filter(Boolean);
 if(!options.length)return null;
 return <details className="combat-context"><summary>Alternate feature combat triggers</summary><div className="context-checks">{options}</div><p className="fine">These controls appear only for selected alternate features. Flanking, target immunity, target flat-footed status, target alignment, weapon type, and sneak-attack eligibility still determine whether the selected effect applies.</p><Btn onClick={()=>set({lightbringerStrike:false,penetratingStrike:false,disruptiveAttack:false,holyStrike:false})}>Clear alternate feature triggers</Btn></details>;
}
