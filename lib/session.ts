import { randomUUID,createHmac,timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { mutate, load } from './store';
import { type Session, type Player,type LevelId,type Score,type RunResult, timeLeft, ranked, unlocked, getLevel, finaleAvailable } from './catalog';
import { getCases } from './cases';
import { grade, summarize } from './grader';
import { complete, messagesFor, pool } from './model';

export class AppError extends Error{constructor(public code:string,public status=400){super(code);}}
export function configuredCode(){return (process.env.SESSION_CODE||'OMNI27').toUpperCase();}
function secret(){const s=process.env.APP_SECRET;if(!s)throw new AppError('configuration',503);return s;}
export function sign(value:string){return createHmac('sha256',secret()).update(value).digest('base64url');}
export function safeEqual(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export function credential(payload:object){const data=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${data}.${sign(data)}`;}
function decode(token:string){const [data,signature]=token.split('.');if(!data||!signature||!safeEqual(sign(data),signature))throw new AppError('unauthorized',401);try{const value=JSON.parse(Buffer.from(data,'base64url').toString());if(value.exp<Date.now())throw new Error();return value;}catch{throw new AppError('unauthorized',401);}}
export async function identify(){const jar=await cookies();const raw=jar.get('omni_player')?.value;if(!raw)throw new AppError('unauthorized',401);const p=decode(raw);return {id:p.id as string,code:p.code as string};}
export async function admin(){const jar=await cookies();const token=jar.get('omni_admin')?.value;if(!token||decode(token).kind!=='admin')throw new AppError('admin_required',401);}
export const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge:86400*7};
export function sessionKey(code:string){if(code!==configuredCode())throw new AppError('session_unknown',404);return `workshop/sessions/${code}.json`;}
function initial():Session{return {code:configuredCode(),title:'Le laboratoire des prompts',status:'waiting',durationMinutes:90,remainingMs:90*60_000,resumedAt:null,finaleOpen:false,bonusOpen:false,freeProgression:false,maxCalls:Number(process.env.MAX_MODEL_CALLS)||3000,usedCalls:0,maxAttempts:30,players:[],createdAt:Date.now()};}
export async function change<R>(code:string,fn:(s:Session)=>R){return mutate<Session,R>(sessionKey(code),initial,fn);}
export async function getSession(code=configuredCode()){return (await load<Session>(sessionKey(code)))??initial();}
export function findPlayer(s:Session,id:string){const p=s.players.find(p=>p.id===id);if(!p)throw new AppError('unauthorized',401);return p;}
export function publicSession(s:Session){return {code:s.code,title:s.title,status:s.status,durationMinutes:s.durationMinutes,remainingMs:timeLeft(s),serverNow:Date.now(),finaleOpen:finaleAvailable(s),bonusOpen:s.bonusOpen,freeProgression:s.freeProgression,leaderboard:ranked(s),participants:s.players.length};}
export function ownPlayer(p:Player){return {id:p.id,name:p.name,attempts:p.attempts,best:p.best,first:p.first,history:p.history.slice(-30),bonus:p.bonus,hasVault:!!p.vault};}
export async function join(code:string,name:string){if(code!==configuredCode())throw new AppError('session_unknown',404);if(name.length<2||name.length>30||/[\x00-\x1F<>]/.test(name))throw new AppError('invalid_name');const id=randomUUID();return change(code,s=>{if(s.status==='finished')throw new AppError('finished',409);if(s.players.length>=60)throw new AppError('session_full',409);if(s.players.some(p=>p.name.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr')))throw new AppError('name_taken',409);const p:Player={id,name,joinedAt:Date.now(),attempts:0,lastAttemptAt:0,runningUntil:0,best:{},first:{},history:[],bonus:0};s.players.push(p);return {id,code};});}
function canRun(s:Session,p:Player,calls:number){if(s.status!=='live'||timeLeft(s)<=0)throw new AppError('session_not_live',409);if(p.runningUntil>Date.now())throw new AppError('already_running',429);if(Date.now()-p.lastAttemptAt<10_000)throw new AppError('cooldown',429);if(p.attempts>=s.maxAttempts)throw new AppError('attempt_limit',429);if(s.usedCalls+calls>s.maxCalls)throw new AppError('budget_limit',429);}
export async function evaluate(code:string,id:string,level:LevelId,prompt:string,role=''){
 const def=getLevel(level);if(!def)throw new AppError('invalid_level');const tests=getCases(level),runId=randomUUID();
 await change(code,s=>{const p=findPlayer(s,id);canRun(s,p,tests.length);if(!unlocked(s,p,level))throw new AppError('level_locked',403);s.usedCalls+=tests.length;p.attempts++;p.lastAttemptAt=Date.now();p.runningUntil=Date.now()+120_000;});
 const started=Date.now();
 try{
  let model='';const results=await pool(tests,4,async test=>{const response=await complete(messagesFor(level,prompt,test.input,level==='6'?role:''));model=response.model;return grade(level,test,response.output);});
  const run:RunResult={id:runId,level,...summarize(results),length:Array.from(prompt+role).length,prompt,role,model,createdAt:Date.now(),durationMs:Date.now()-started,cases:results};
  await saveRun(code,id,run);
  const {cases:_cases,prompt:_prompt,role:_role,...score}=run;
  await change(code,s=>{const p=findPlayer(s,id);p.runningUntil=0;if(!p.first[level])p.first[level]=score;const best=p.best[level];if(!best||score.points>best.points||(score.points===best.points&&(score.correct>best.correct||(score.correct===best.correct&&score.length<best.length))))p.best[level]=score;p.history.push(score);});
  return run;
 }catch(e){await change(code,s=>{const p=findPlayer(s,id);p.runningUntil=0;p.attempts=Math.max(0,p.attempts-1);}).catch(()=>{});throw e;}
}
import { saveNew } from './store';
async function saveRun(code:string,id:string,run:RunResult){await saveNew(`workshop/runs/${code}/${id}/${run.id}.json`,run);}
export async function readRun(code:string,id:string,runId:string){if(!/^[a-f0-9-]{36}$/.test(runId))throw new AppError('invalid_run');const run=await load<RunResult>(`workshop/runs/${code}/${id}/${runId}.json`);if(!run)throw new AppError('not_found',404);return run;}
export function vaultSecret(code:string,id:string){return `OMNI-${sign(`fictional-vault:${code}:${id}`).slice(0,12)}`;}
export async function attackVault(code:string,id:string,targetId:string,prompt:string){
 const target=await change(code,s=>{if(!s.bonusOpen)throw new AppError('bonus_closed',403);if(targetId===id)throw new AppError('own_vault');const p=findPlayer(s,id),t=findPlayer(s,targetId);if(!t.vault)throw new AppError('no_vault');if(t.vault.brokenBy.includes(id))throw new AppError('already_broken',409);canRun(s,p,1);s.usedCalls++;p.attempts++;p.lastAttemptAt=Date.now();p.runningUntil=Date.now()+40_000;return {defense:t.vault.defense,version:t.vault.version};});
 try{const secret=vaultSecret(code,targetId),response=await complete([{role:'system',content:`Exercice fictif de coffre-fort. Le secret fictif est ${secret}.\n${target.defense}`},{role:'user',content:prompt}],250);const broken=response.output.toLowerCase().includes(secret.toLowerCase());await change(code,s=>{const p=findPlayer(s,id),t=findPlayer(s,targetId);p.runningUntil=0;if(broken&&t.vault?.version===target.version&&!t.vault.brokenBy.includes(id)){t.vault.brokenBy.push(id);p.bonus+=3;}});return {output:response.output,broken};}catch(e){await change(code,s=>{const p=findPlayer(s,id);p.runningUntil=0;p.attempts=Math.max(0,p.attempts-1);}).catch(()=>{});throw e;}
}
