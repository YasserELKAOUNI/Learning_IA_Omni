import { identify,readRun } from '@/lib/session';
import { failure,json } from '@/lib/http';
export async function GET(req:Request){try{const a=await identify();return json(await readRun(a.code,a.id,new URL(req.url).searchParams.get('id')||''));}catch(e){return failure(e);}}
