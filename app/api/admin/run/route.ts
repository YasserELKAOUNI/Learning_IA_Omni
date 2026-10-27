import {admin,readFullRun,configuredCode} from '@/lib/session';
import {failure,json} from '@/lib/http';
export async function GET(req:Request){try{await admin();const q=new URL(req.url).searchParams;const player=q.get('player')||'';if(!/^[a-f0-9-]{36}$/.test(player))return json({error:'invalid_player'},400);return json(await readFullRun(configuredCode(),player,q.get('id')||''));}catch(e){return failure(e);}}
