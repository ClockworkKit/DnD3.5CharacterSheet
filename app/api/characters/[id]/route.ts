import {getDB} from '@/db';
import {owner,payload,failure,json,RequestError,sameOrigin} from '@/lib/character-store';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){try{
 const key=owner(request),{id}=await context.params;
 const row=await getDB().prepare('SELECT id,data,revision,updated_at FROM characters WHERE id=? AND owner_id=?').bind(id,key).first<{id:string,data:string,revision:number,updated_at:string}>();
 if(!row)throw new RequestError('This character could not be found.',404);
 return json({...row,data:JSON.parse(row.data)});
}catch(e){return failure(e);}}
export async function PUT(request:Request,context:Context){try{
 const key=owner(request),{id}=await context.params,{data,revision}=await payload(request),now=new Date().toISOString();
 if(!revision)throw new RequestError('Reload the saved character before replacing it.');
 const result=await getDB().prepare('UPDATE characters SET name=?,data=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?').bind(data.name,JSON.stringify(data),now,id,key,revision).run();
 if(!result.meta.changes)throw new RequestError('This character changed in another tab, or was deleted. Export your current edits before reloading, or save them as a new character.',409);
 return json({id,revision:revision+1,updated_at:now});
}catch(e){return failure(e);}}
export async function DELETE(request:Request,context:Context){try{
 const key=owner(request),{id}=await context.params;sameOrigin(request);
 const {revision}=await request.json() as {revision:unknown};
 if(typeof revision!=='number'||!Number.isInteger(revision)||revision<1)throw new RequestError('A saved revision is required.');
 const result=await getDB().prepare('DELETE FROM characters WHERE id=? AND owner_id=? AND revision=?').bind(id,key,revision).run();
 if(!result.meta.changes)throw new RequestError('This character changed in another tab. Reload it before deleting.',409);
 return json({deleted:true});
}catch(e){return failure(e);}}
