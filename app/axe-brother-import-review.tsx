'use client';
import type {Character,Spell} from '@/lib/model';
import {axeBrotherImportEvidence,repairAxeBrotherImport} from '@/lib/roll20-cleric-review';
import {Btn} from './sheet-ui';
import {toast} from 'sonner';

export function AxeBrotherImportReview({c,spells,onRepair,disabled=false}:{c:Character,spells:Spell[],onRepair:(c:Character)=>void,disabled?:boolean}){
 if(c.roll20Import?.axeBrotherReview===1||!axeBrotherImportEvidence(c))return null;
 return <div className="subcard"><h3>Review Clangeddin cleric import</h3><p>This export identifies a cleric with Dwarf and Strength domains. If this character is an Axe Brother, confirm the campaign setup below.</p><p className="fine">Recover missing Cleric levels using the current character level, retain existing class levels, use full cleric spell progression, and share domain slots between Dwarf and Strength. Move recognized non-domain cleric spells and Silverbeard into ordinary slots. HP, preparations, spent uses, and the original export are kept. Custom spells and over-capacity preparations still need review. This changes casting overrides; export a backup first if you use house-rule progression.</p><Btn disabled={disabled||!spells.length} onClick={()=>{try{onRepair(repairAxeBrotherImport(c,spells));toast.success('Axe Brother import setup repaired; spent resources kept.')}catch(e){toast.error(e instanceof Error?e.message:'Could not repair this import.')}}}>Confirm Axe Brother, Dwarf + Strength</Btn></div>;
}
