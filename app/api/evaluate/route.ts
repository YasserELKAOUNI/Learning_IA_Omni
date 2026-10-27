import { identify,evaluate } from '@/lib/session';
import { body,failure,json,sameOrigin,textField } from '@/lib/http';
import { getLevel } from '@/lib/catalog';
export const maxDuration=120;
export async function POST(req:Request){try{sameOrigin(req);const auth=await identify(),b=await body(req),level=getLevel(String(b.level));if(!level)return json({error:'invalid_level'},400);return json(await evaluate(auth.code,auth.id,level.id,textField(b.prompt),typeof b.role==='string'?b.role.slice(0,500):''));}catch(e){return failure(e);}}
