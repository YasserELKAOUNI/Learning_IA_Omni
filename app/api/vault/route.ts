import {randomUUID} from 'node:crypto';
import {identify,getSession,findPlayer,change,attackVault,AppError} from '@/lib/session';
import {body,failure,json,sameOrigin,textField} from '@/lib/http';
export const maxDuration=45;
export async function GET(){try{const a=await identify(),s=await getSession(a.code);return json({open:s.bonusOpen,vaults:s.players.filter(p=>p.vault).map(p=>({id:p.id,name:p.name,broken:p.vault!.brokenBy.length,alreadyBroken:p.vault!.brokenBy.includes(a.id)})),defense:findPlayer(s,a.id).vault?.defense??''});}catch(e){return failure(e);}}
export async function PUT(req:Request){try{sameOrigin(req);const a=await identify(),b=await body(req),defense=textField(b.defense,3000);await change(a.code,s=>{if(!s.bonusOpen)throw new AppError('bonus_closed',403);const p=findPlayer(s,a.id);if(p.vault)throw new AppError('vault_published',409);p.vault={defense,version:randomUUID(),brokenBy:[]};});return json({ok:true});}catch(e){return failure(e);}}
export async function POST(req:Request){try{sameOrigin(req);const a=await identify(),b=await body(req);return json(await attackVault(a.code,a.id,String(b.targetId??''),textField(b.prompt,2000)));}catch(e){return failure(e);}}
