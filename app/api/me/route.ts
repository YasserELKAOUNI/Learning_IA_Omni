import { identify,getSession,findPlayer,publicSession,ownPlayer } from '@/lib/session';
import { failure,json } from '@/lib/http';
export const dynamic='force-dynamic';
export async function GET(){try{const auth=await identify(),s=await getSession(auth.code);return json({session:publicSession(s),player:ownPlayer(findPlayer(s,auth.id))});}catch(e){return failure(e);}}
