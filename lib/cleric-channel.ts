import type {Character} from './model.ts';
import {normalizedAlignment} from './alignment-values.ts';
import {deityAlignmentValue} from './deity-alignment.ts';

export function alignmentChannel(alignment:string){
 const value=alignment.toLowerCase().trim();
 if(/^(?:[lnc]g|(?:lawful |neutral |chaotic )?good)$/.test(value))return 'cure';
 if(/^(?:[lnc]e|(?:lawful |neutral |chaotic )?evil)$/.test(value))return 'inflict';
 return undefined;
}

/** PHB/SRD Cleric: neutral clerics follow a good/evil deity's channel.
 * Unrecognized alignment is not evidence of neutrality. Reading never rewrites
 * the saved neutral choice, which may predate the currently recorded patron.
 */
export function clericChannelState(c:Pick<Character,'alignment'|'deity'|'deityAlignment'|'clericChannel'>){
 const own=alignmentChannel(c.alignment);
 const neutral=normalizedAlignment(c.alignment)?.endsWith('neutral')??false;
 const patron=neutral?alignmentChannel(deityAlignmentValue(c)):undefined;
 const fixed=own??patron;
 return {fixed,channel:fixed??c.clericChannel,source:own?'character':patron?'deity':'choice',
  savedConflict:!!fixed&&!!c.clericChannel&&fixed!==c.clericChannel};
}
