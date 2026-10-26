import {z} from 'zod';

const id=z.string().trim().min(1).max(80);
const entryId=z.string().trim().min(1).max(100);
const approval=z.object({classId:id,gm:z.string().trim().min(1).max(160),reason:z.string().trim().min(1).max(2000)}).strict();
export const gestaltBonusMethodSchema=z.enum(['printed-table-v1','fractional-v1']);
export type GestaltBonusMethod=z.infer<typeof gestaltBonusMethodSchema>;
/** Explicit, versioned data only. Never infer paired levels from old class totals. */
export const gestaltProgressionSchema=z.object({
 version:z.literal(1),
 bonusMethod:gestaltBonusMethodSchema.default('printed-table-v1'),
 levels:z.array(z.object({id,left:entryId,right:entryId,approvals:z.array(approval).max(2).default([])}).strict()).min(1).max(100),
}).strict().superRefine((plan,ctx)=>{
 const seen=new Set<string>();
 plan.levels.forEach((row,i)=>{
  if(seen.has(row.id))ctx.addIssue({code:'custom',path:['levels',i,'id'],message:'Gestalt level IDs must be unique.'});
  seen.add(row.id);
  if(row.left===row.right)ctx.addIssue({code:'custom',path:['levels',i],message:'Choose two different classes for a gestalt level.'});
  if(new Set(row.approvals.map(a=>a.classId)).size!==row.approvals.length)ctx.addIssue({code:'custom',path:['levels',i,'approvals'],message:'Record each combination-class approval once.'});
 });
});
export type GestaltProgression=z.infer<typeof gestaltProgressionSchema>;
