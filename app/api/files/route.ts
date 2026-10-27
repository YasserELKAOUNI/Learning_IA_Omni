import {identify,getSession} from '@/lib/session';
import {json,failure,sameOrigin} from '@/lib/http';
import {receiveFile,MAX_FILE_BYTES} from '@/lib/uploads';
export const maxDuration=60;
export async function GET(){try{const a=await identify(),s=await getSession(a.code);return json({files:(s.uploads??[]).filter(f=>f.playerId===a.id&&f.ready)});}catch(e){return failure(e);}}
export async function POST(req:Request){try{sameOrigin(req);const a=await identify();if(Number(req.headers.get('content-length'))>MAX_FILE_BYTES+65536)return json({error:'file_size'},413);const form=await req.formData(),file=form.get('file');if(!(file instanceof File))return json({error:'file_missing'},400);return json(await receiveFile(a.code,a.id,file));}catch(e){return failure(e);}}
