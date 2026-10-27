import { cookies } from 'next/headers';
import { join,credential,cookieOptions } from '@/lib/session';
import { body,failure,json,sameOrigin } from '@/lib/http';
export async function POST(req:Request){try{sameOrigin(req);const b=await body(req);const auth=await join(String(b.code??'').trim().toUpperCase(),String(b.name??'').trim());(await cookies()).set('omni_player',credential({...auth,exp:Date.now()+7*86400_000}),cookieOptions);return json({ok:true});}catch(e){return failure(e);}}
