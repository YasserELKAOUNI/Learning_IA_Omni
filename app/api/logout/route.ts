import {cookies} from 'next/headers';
import {sameOrigin,json,failure} from '@/lib/http';
export async function POST(req:Request){try{sameOrigin(req);(await cookies()).delete('omni_player');return json({ok:true});}catch(e){return failure(e);}}
