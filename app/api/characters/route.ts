import {getDB} from '@/db';
import {owner,payload,failure,json} from '@/lib/character-store';
export async function GET(request:Request){try{
 const key=owner(request);
 const rows=await getDB().prepare('SELECT id,name,revision,updated_at FROM characters WHERE owner_id=? ORDER BY updated_at DESC').bind(key).all();
 return json({characters:rows.results});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const key=owner(request), {data}=await payload(request), id=crypto.randomUUID(),now=new Date().toISOString();
 await getDB().prepare('INSERT INTO characters (id,owner_id,name,data,revision,created_at,updated_at) VALUES (?,?,?,?,1,?,?)').bind(id,key,data.name,JSON.stringify(data),now,now).run();
 return json({id,revision:1,updated_at:now},201);
}catch(e){return failure(e);}}
