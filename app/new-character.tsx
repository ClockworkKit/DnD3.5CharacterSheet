'use client';
import {useState} from 'react';
import {Dices} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {abilityKeys,abilityNames,type Character} from '@/lib/model';
import {raceCatalog,findRace} from '@/lib/ancestry';
import {baseClasses} from '@/lib/classes';
import {signed} from '@/lib/rules';
import {abilityMethods,blankScores,startingAssignment,rollAbilityScores,assignedScores,assignAbilityRoll,startingAbilityScores,createPlayerCharacter,type AbilityMethod,type AbilityRoll} from '@/lib/character-creation';
import {F,N,Choice,Btn} from './sheet-ui';

export function NewCharacterDialog({open,onOpenChange,busy,onCreate}:{open:boolean,onOpenChange:(open:boolean)=>void,busy:boolean,onCreate:(character:Character)=>Promise<boolean>}){
  const [name,setName]=useState(''),[kind,setKind]=useState('Fighter'),[raceId,setRaceId]=useState('human'),[level,setLevel]=useState(1);
  const [method,setMethod]=useState<AbilityMethod>('4d6-drop-lowest'),[rolls,setRolls]=useState<AbilityRoll[]>([]),[assignment,setAssignment]=useState(startingAssignment),[manual,setManual]=useState(blankScores);
  const [error,setError]=useState(''),[creating,setCreating]=useState(false);
  const ready=method==='manual'||rolls.length===6,scores=method==='manual'||!ready?manual:assignedScores(rolls,assignment),totals=startingAbilityScores(scores,raceId),race=findRace(raceId);
  function chooseMethod(value:string){const next=value as AbilityMethod;if(next===method)return;if(next==='manual')setManual({...scores});setMethod(next);setRolls([]);setAssignment(startingAssignment());setError('')}
  function rollScores(){try{if(method==='manual')return;setRolls(rollAbilityScores(method));setAssignment(startingAssignment());setError('')}catch(e){setError(e instanceof Error?e.message:'Could not roll ability scores.')}}
  async function create(){if(creating||busy||!ready)return;setCreating(true);setError('');try{
    const character=createPlayerCharacter({name,kind,level,raceId,scores,method,rolls,assignment});
    if(await onCreate(character)){onOpenChange(false);setName('');setRolls([]);setAssignment(startingAssignment());setManual(blankScores())}
    else setError('Your open character could not be saved. Close this window to review the save warning, then try again.');
  }catch(e){setError(e instanceof Error?e.message:'Could not create this character.')}finally{setCreating(false)}}
  return <Dialog open={open} onOpenChange={value=>{if(!creating)onOpenChange(value)}}><DialogContent className="ledger-modal creation-modal"><DialogHeader><DialogTitle>A new adventurer</DialogTitle><DialogDescription>Choose your character’s starting abilities, race, and class.</DialogDescription></DialogHeader>
    <fieldset className="sheet-fieldset" disabled={busy||creating}>
      <F label="Character name" value={name} onChange={setName} placeholder="Your adventurer’s name"/>
      <div className="fields three"><Choice label="Race" value={raceId} onChange={setRaceId} options={raceCatalog.map(r=>[r.id,r.name])}/><Choice label="Starting class" value={kind} onChange={setKind} options={baseClasses.map(d=>d.name)}/><N label="Starting class level" value={level} min={1} max={20} onChange={value=>setLevel(Math.floor(value))}/></div>
      <p className="fine">{race?.vision} · LA +{race?.la}{race?.rhd?' · '+race.hitDice:''}</p>
      <section className="creation-abilities" aria-labelledby="starting-abilities"><h3 id="starting-abilities">Ability scores</h3><Choice label="Generation method" value={method} onChange={chooseMethod} options={abilityMethods}/>
        {method!=='manual'&&<><Btn className="primary" onClick={rollScores}><Dices size={18}/>{rolls.length?'Reroll all six scores':'Roll six scores'}</Btn><p className="fine creation-hint">{method==='4d6-drop-lowest'?'Roll four six-sided dice for each score and drop one lowest die.':'Roll three six-sided dice for each score and add them together.'} Assign the results to any abilities.</p></>}
        {rolls.length===6&&<div className="generation-rolls" aria-live="polite">{rolls.map((roll,index)=><div className="generation-roll" key={index}><span>Roll {index+1}</span><strong>{roll.total}</strong><div className="generation-dice" aria-label={'Dice '+roll.dice.map((n,i)=>n+(i===roll.droppedIndex?' dropped':'')).join(', ')}>{roll.dice.map((n,i)=>i===roll.droppedIndex?<del key={i} title="Dropped die">{n}</del>:<span key={i}>{n}</span>)}</div></div>)}</div>}
        {ready&&<><div className="creation-score-grid">{abilityKeys.map((ability,index)=><div className="creation-score" key={ability}>{method==='manual'?<N label={abilityNames[ability]+' base'} value={manual[ability]} min={1} max={100} onChange={value=>setManual(previous=>({...previous,[ability]:Math.floor(value)}))}/>:<Choice label={abilityNames[ability]} value={String(assignment[index])} onChange={value=>setAssignment(previous=>assignAbilityRoll(previous,index,Number(value)))} options={rolls.map((roll,i)=>[String(i),'Roll '+(i+1)+' · '+roll.total])}/>}
          <div className="creation-score-total"><strong>{totals[ability]}</strong><span>Total · modifier {signed(Math.floor((totals[ability]-10)/2))}</span></div><p className="fine">Base {scores[ability]} · Race {signed(totals[ability]-scores[ability])}</p>
        </div>)}</div><p className="fine">Racial adjustments are applied once. {method!=='manual'&&'Choosing a roll already assigned to another ability swaps the two. '}Starting scores{method!=='manual'?' and dice':''} are recorded in Notes.</p></>}
      </section>
      <p className="fine">HP, skill points, and spell slots use these abilities. Choose equipment, feats, skills, spells, and any level-based ability increases on the sheet.</p>
      {error&&<p className="error-box" role="alert">{error}</p>}
      <div className="creation-actions"><Btn onClick={()=>onOpenChange(false)}>Cancel</Btn><Btn className="primary" disabled={!ready||busy||creating} onClick={()=>void create()}>{creating?'Creating…':'Create character'}</Btn></div>
    </fieldset>
  </DialogContent></Dialog>;
}
