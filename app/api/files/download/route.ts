import {identify,admin,configuredCode,AppError} from '@/lib/session';
import {failure} from '@/lib/http';
import {fileBytes} from '@/lib/uploads';
export async function GET(req:Request){try{const q=new URL(req.url).searchParams;let playerId='',code=configuredCode();if(q.get('admin')==='1')await admin();else{const a=await identify();playerId=a.id;code=a.code;}const {record,bytes}=await fileBytes(code,q.get('id')||'');if(playerId&&record.playerId!==playerId)throw new AppError('forbidden',403);return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(record.name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return failure(e);}}
