import {characterSchema} from './model.ts';
export class RequestError extends Error { status:number;constructor(message:string,status=400){super(message);this.status=status;} }
export function owner(request:Request){
 const id=request.headers.get('oai-authenticated-user-id');
 const email=request.headers.get('oai-authenticated-user-email');
 if(!id&&!email)throw new RequestError('Sign in to save and load your characters.',401);
 return id?'id:'+id:'email:'+email!.toLowerCase();
}
export function sameOrigin(request:Request){
 const origin=request.headers.get('origin');
 if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==new URL(request.url).origin))throw new RequestError('Please save from the character sheet itself.',403);
 if(!request.headers.get('content-type')?.includes('application/json'))throw new RequestError('A JSON character is required.',415);
}
export async function payload(request:Request){
 sameOrigin(request);
 if(Number(request.headers.get('content-length')||0)>1000000)throw new RequestError('This character is too large to save. Export a backup and shorten very long notes.',413);
 const raw=await request.text();
 if(raw.length>1000000)throw new RequestError('This character is too large to save.',413);
 let parsed;try{parsed=JSON.parse(raw);}catch{throw new RequestError('That character file is not valid JSON.');}
 const result=characterSchema.safeParse(parsed.data);
 if(!result.success)throw new RequestError('Check the character fields: '+result.error.issues.slice(0,3).map(x=>x.path.join('.')+' '+x.message).join('; '));
 const revision=parsed.revision;
 if(revision!==undefined&&(!Number.isInteger(revision)||revision<1))throw new RequestError('Invalid saved revision.');
 return {data:result.data,revision:revision as number|undefined};
}
export function failure(e:unknown){if(e instanceof RequestError)return Response.json({error:e.message},{status:e.status,headers:{'Cache-Control':'no-store'}});console.error('Character storage request failed',e instanceof Error?e.message:'Unknown');return Response.json({error:'Character saving is temporarily unavailable. Your edits are still on this page; retry saving or export a backup.'},{status:503,headers:{'Cache-Control':'no-store'}});}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
