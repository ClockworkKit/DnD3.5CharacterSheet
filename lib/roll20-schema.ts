import {z} from 'zod';

export const roll20ExportSchema=z.object({
 format:z.literal('roll20-dnd35-export'),version:z.number().int().positive(),exportedAt:z.string().max(100),
 character:z.object({id:z.string().min(1).max(100),name:z.string().max(160)}).passthrough(),
 attributes:z.array(z.object({id:z.string().max(100).optional(),name:z.string().min(1).max(500),current:z.unknown(),max:z.unknown().optional()}).passthrough()).max(20000),
 repeating:z.record(z.unknown()).optional(),resolvedCoreValues:z.record(z.unknown()).optional(),
}).passthrough().superRefine((value,ctx)=>{
 value.attributes.forEach((attribute,index)=>{if(!Object.hasOwn(attribute,'current'))ctx.addIssue({code:'custom',path:['attributes',index,'current'],message:'Attribute current value is required.'})});
});
export type Roll20Export=z.infer<typeof roll20ExportSchema>;
export const roll20ImportDataSchema=z.object({
 format:z.literal('roll20-dnd35-export'),version:z.number().int().positive(),exportedAt:z.string().max(100),sourceCharacterId:z.string().max(100),
 raw:z.unknown(),report:z.object({mapped:z.number().int().min(0),unmapped:z.array(z.string().max(500)),warnings:z.array(z.string().max(1000))}),
});
export type Roll20Report=z.infer<typeof roll20ImportDataSchema>['report'];
