import { getSession,publicSession,configuredCode } from '@/lib/session';
import { failure,json } from '@/lib/http';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const code=new URL(req.url).searchParams.get('code')?.toUpperCase()||configuredCode();return json(publicSession(await getSession(code)));}catch(e){return failure(e);}}
