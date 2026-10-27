import {cookies} from 'next/headers';
import {safeEqual,credential,cookieOptions,AppError} from '@/lib/session';
import {body,failure,json,sameOrigin} from '@/lib/http';
export async function POST(req:Request){try{sameOrigin(req);const b=await body(req);if(!process.env.ADMIN_KEY||typeof b.key!=='string'||!safeEqual(b.key,process.env.ADMIN_KEY))throw new AppError('admin_required',401);(await cookies()).set('omni_admin',credential({kind:'admin',exp:Date.now()+7*86400_000}),cookieOptions);return json({ok:true});}catch(e){return failure(e);}}
