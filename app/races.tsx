'use client';
import {assetUrl} from '@/lib/deployment';
import {useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {abilityKeys} from '@/lib/model';
import {raceCatalog,findRace,selectRace,copyRacialTraits,racialAbility,effectiveScore,racialPowerPoints,type RaceDefinition} from '@/lib/ancestry';
import {signed} from '@/lib/rules';
import {powerReserve} from '@/lib/psionics';
import {F,N,Choice,Check,Btn,Section,Stat,type SheetProps} from './sheet-ui';
import {toast} from 'sonner';
const adjustments=(r:RaceDefinition)=>Object.entries(r.abilities).map(([a,n])=>a+' '+signed(n!)).join(' · ')||'No ability adjustments';
export function Races({c,edit,confirm}:SheetProps){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[group,setGroup]=useState('all'),[preview,setPreview]=useState<RaceDefinition|null>(null);
 const [abilities,setAbilities]=useState(false),[traits,setTraits]=useState(false),[body,setBody]=useState(false),[languages,setLanguages]=useState(true),[speedBonus,setSpeedBonus]=useState(0);
 const [refs,setRefs]=useState<RaceDefinition[]>([]),[error,setError]=useState('');
 const race=findRace(c.ancestry.raceId),reserve=powerReserve(c);const classLevels=c.classLevels.length?c.classLevels.reduce((n,e)=>n+e.level,0):Math.max(0,c.level-c.ancestry.racialHitDice);const totalHD=classLevels+c.ancestry.racialHitDice;const ecl=totalHD+(c.ancestry.ignoreLevelAdjustment?0:c.ancestry.levelAdjustment);
 const matches=raceCatalog.filter(r=>(group==='all'||r.group===group)&&(r.name+' '+r.type+' '+r.book).toLowerCase().includes(query.toLowerCase()));
 async function loadReference(){if(refs.length)return;try{setError('');const res=await fetch(assetUrl('data/races.json'));if(!res.ok)throw new Error();setRefs(await res.json() as RaceDefinition[])}catch{setError('Full reference text could not be loaded. The race summary remains available.')}}
 function review(r:RaceDefinition){setPreview(r);setAbilities(c.ancestry.abilityAdjustments);setTraits(c.ancestry.traitBonuses);setBody(false);setLanguages(true);setSpeedBonus(race?Math.max(0,c.speed-race.speed):0);void loadReference();}
 const full=refs.find(r=>r.id===preview?.id);
 return <>
 <Section title="Race & racial traits" action={<Btn className="primary" onClick={()=>{setPreview(null);setOpen(true)}}>Browse races</Btn>}>
 <F label="Race name on the sheet" value={c.race} onChange={v=>edit(d=>{d.race=v})}/>
 {!race?<div className="empty-note"><h3>Choose a race to attach its traits</h3><p>Your current scores and bonuses stay as entered until you choose which racial adjustments to apply.</p><Btn onClick={()=>setOpen(true)}>Open the race library</Btn></div>:<>
 <div className="race-heading"><div><h3>{race.name}</h3><p className="muted">{race.type} · {race.vision}</p></div><Btn onClick={()=>{review(race);setOpen(true)}}>Race reference</Btn></div>
 <p className="race-adjustments">{adjustments(race)}</p>
 <Check label="Add racial ability adjustments to my score fields" checked={c.ancestry.abilityAdjustments} onChange={v=>edit(d=>{d.ancestry.abilityAdjustments=v})}/><p className="fine">When enabled, enter scores before racial adjustments on Sheet. Leave this off if your score fields already include them.</p>
 <Check label="Add the listed racial skill, save, natural armor, dodge, grapple, and power-point bonuses" checked={c.ancestry.traitBonuses} onChange={v=>edit(d=>{d.ancestry.traitBonuses=v})}/><p className="fine">These bonuses are added separately from Misc. Hide also includes the current size modifier. Conditional bonuses, spell resistance, plating, and spell-like abilities use the trait notes below.</p>
 <Table className="race-score-table"><TableHeader><TableRow><TableHead>Ability</TableHead><TableHead>Score field</TableHead><TableHead>Race</TableHead><TableHead>Adjustment</TableHead><TableHead>Total</TableHead></TableRow></TableHeader><TableBody>{abilityKeys.map(a=><TableRow key={a}><TableCell>{a}</TableCell><TableCell>{c.scores[a]}</TableCell><TableCell>{signed(racialAbility(c,a))}</TableCell><TableCell>{signed(c.temps[a])}</TableCell><TableCell><strong>{effectiveScore(c,a)}</strong></TableCell></TableRow>)}</TableBody></Table>
 <div className="race-traits">{race.traits.map((t,i)=><p key={i}>{t}</p>)}</div>
 <div className="button-row"><Btn onClick={()=>{edit(d=>copyRacialTraits(d));toast.success('Racial trait reference updated in Feats.')}}>Add / update traits in Feats</Btn><Btn className="quiet danger" onClick={()=>confirm('Detach race reference?','Turn off racial bonuses and remove the attached reference. Keep the race name, entered scores, size, speed, languages, and other notes.',()=>edit(d=>{d.ancestry={...d.ancestry,raceId:'',abilityAdjustments:false,traitBonuses:false,racialHitDice:0,levelAdjustment:0};d.features=d.features.filter(f=>f.id!=='race-reference')}))}>Detach reference</Btn></div>
 <p className="fine">After changing ability adjustments, review maximum HP, bonus spell slots, daily class resources, and class-feature bonuses. Those values are entered separately.</p>
 </>}
 </Section>
 <Section title="Level adjustment & racial Hit Dice">
 <div className="stats"><Stat label="Class levels" value={classLevels}/><Stat label="Total Hit Dice" value={totalHD}/><Stat label="Effective level" value={ecl}/></div>
 <div className="fields two"><N label="Racial Hit Dice" value={c.ancestry.racialHitDice} min={0} max={30} onChange={v=>edit(d=>{d.ancestry.racialHitDice=v})}/><N label="Level adjustment" value={c.ancestry.levelAdjustment} min={0} max={30} onChange={v=>edit(d=>{d.ancestry.levelAdjustment=v})}/></div>
 <Check label="Ignore level adjustment for this character (house rule)" checked={c.ancestry.ignoreLevelAdjustment} onChange={v=>edit(d=>{d.ancestry.ignoreLevelAdjustment=v})}/>
 <p className="fine">Effective character level = class levels + racial Hit Dice + level adjustment. Level adjustment adds no hit points, feats, skill points, or caster levels. Classes → Apply class totals includes the racial Hit Dice of gnolls and lizardfolk in level, BAB, saves, and hit dice. Allocate their HP, skills, and feats separately.</p>
 {racialPowerPoints(c)>0&&<><h3 className="race-subtitle">Racial power points</h3><p className="fine">{racialPowerPoints(c)} racial points contribute to your shared reserve: {reserve.remaining} of {reserve.max} remaining. Racial points do not grant a manifester level.</p><N label="PP spent on racial abilities" value={c.ancestry.powerPointsSpent} min={0} max={10000} onChange={v=>edit(d=>{d.ancestry.powerPointsSpent=v})}/></>}
 <F label="Subrace, racial choices, or house rules" value={c.ancestry.notes} onChange={v=>edit(d=>{d.ancestry.notes=v})} area placeholder="Chosen dromite energy, optional racial variant, altered level adjustment…"/>
 </Section>
 <Section title="Race library" note="7 core races · 28 additional races and subraces"><div className="button-row">{['Core','Subraces','Monstrous','Planetouched','Psionic','Other books'].map(g=><Btn key={g} onClick={()=>{setGroup(g);setPreview(null);setOpen(true)}}>{g}</Btn>)}</div><p className="fine">For a race from another book or a homebrew race, enter its name above, add custom Racial traits in Feats, and record adjustments directly on Sheet.</p></Section>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="ledger-modal reference-modal"><DialogHeader><DialogTitle>{preview?preview.name:'Choose a race'}</DialogTitle><DialogDescription>{preview?preview.book:'Core 3.5 races, common subraces, and popular additional options.'}</DialogDescription></DialogHeader>
 {!preview?<><div className="fields two"><F label="Find a race" value={query} onChange={setQuery} placeholder="Dwarf, Tiefling, Changeling…"/><Choice label="Race group" value={group} onChange={setGroup} options={[[ 'all','All races'],'Core','Subraces','Monstrous','Planetouched','Psionic','Other books']}/></div><div className="catalog-list">{matches.map(r=><div className="catalog-row" key={r.id}><div><button className="spell-title" onClick={()=>review(r)}>{r.name}</button><p className="fine">{adjustments(r)}<br/>{r.size} · {r.speed} ft. · LA +{r.la}{r.rhd?' · '+r.hitDice:''}</p></div><Btn onClick={()=>review(r)}>Review</Btn></div>)}{!matches.length&&<p className="empty-note">No races match your search.</p>}</div></>:<>
 <Btn className="quiet" onClick={()=>setPreview(null)}>Back to race list</Btn>
 <p className="race-adjustments">{adjustments(preview)}</p><dl className="spell-metadata">{[['Type',preview.type],['Size / land speed',preview.size+' / '+preview.speed+' ft.'],['Vision',preview.vision],['Racial HD / adjustment',preview.hitDice+' / LA +'+preview.la],['Automatic languages',preview.languages.join(', ')],['Favored class',preview.favoredClass]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
 <div className="race-traits">{preview.traits.map((t,i)=><p key={i}>{t}</p>)}</div>
 <details><summary>Bonuses this sheet can add</summary><p className="fine">{[...Object.entries(preview.skills).map(([k,n])=>k+' '+signed(n)),...Object.entries(preview.saves).map(([k,n])=>k+' save '+signed(n!)),...(preview.natural?['Natural armor +'+preview.natural]:[]),...(preview.dodge?['Dodge AC +'+preview.dodge]:[]),...(preview.grapple?['Powerful build grapple +'+preview.grapple]:[]),...(preview.powerPoints?['Racial PP +'+preview.powerPoints]:[])].join(' · ')||'No unconditional bonuses beyond abilities and size.'} Hide gains its size adjustment when trait bonuses are enabled.</p></details>
 {preview.openGame?<details><summary>Full SRD reference</summary>{error?<p className="error-text">{error} <Btn onClick={()=>void loadReference()}>Retry</Btn></p>:<p className="reference-text">{full?.reference||'Loading reference…'}</p>}</details>:<p className="fine">Concise book summary. Consult the source for complete traits, restrictions, and optional feats.</p>}
 <a className="source-link" href={preview.source} target="_blank" rel="noreferrer">Read race source</a>
 <div className="race-apply"><h3>Use this race on your sheet</h3><Check label="Add its ability adjustments (my score fields exclude them)" checked={abilities} onChange={setAbilities}/><Check label="Add its listed trait bonuses (my Misc. fields exclude them)" checked={traits} onChange={setTraits}/><Check label={'Set size to '+preview.size+' and base land speed to '+preview.speed+' ft.'} checked={body} onChange={setBody}/>{body&&<N label="Additional land speed from class or effects (ft.)" value={speedBonus} min={-100} max={1000} onChange={setSpeedBonus}/>}<Check label="Add automatic languages to my known languages" checked={languages} onChange={setLanguages}/><p className="fine">Applies one race at a time; repeated selection does not stack bonuses. Keep automatic adjustments off if they are already included in your entries. Review weapon damage dice after a size change.</p><Btn className="primary" onClick={()=>{edit(d=>selectRace(d,preview.id,{abilities,traits,body,languages,speedBonus}));setOpen(false);toast.success(preview.name+' attached. Racial traits are also in Feats.')}}>Use {preview.name}</Btn></div>
 </>}
 </DialogContent></Dialog>
 </>;
}
