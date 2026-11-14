'use client';
import {Choice} from './sheet-ui';
import {alignmentChoices,type alignmentCodes} from '@/lib/alignment-values';
import {deityAlignmentValue,type DeityIdentity} from '@/lib/deity-alignment';
import type {Character} from '@/lib/model';

export function DeityAlignmentChoice({c,onChange}:{c:DeityIdentity;onChange:(value:Character['deityAlignment'])=>void}){
 if(!c.deity.trim())return null;
 return <Choice label="Deity alignment" value={deityAlignmentValue(c)||'unknown'} options={[[ 'unknown','Not recorded — verify from source'],...alignmentChoices]} onChange={value=>onChange(value==='unknown'?undefined:{deity:c.deity.trim(),alignment:value as typeof alignmentCodes[number]})}/>;
}
