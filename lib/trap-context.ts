import type {Character} from './model.ts';

/** Accept the historical plural without rewriting a player's saved context. */
export const isTrapSave=(value:string)=>value==='trap'||value==='traps';
/** The old plural context also enabled Dungeon Crasher AC. Preserve that fallback
 * until the player explicitly sets the separate incoming-trap control. */
export const isTrapAttack=(c:Character)=>c.automation.context.trapAttack??(c.automation.context.saveAgainst==='traps');
