import type { LevelId } from './catalog';
export class ModelError extends Error { constructor(public code:string,public status=503){super(code);} }
export function messagesFor(level:LevelId,prompt:string,input:string,role='') {
 if(level==='5')return [{role:'system',content:prompt},{role:'user',content:input}];
 const content=prompt.includes('{ticket}')?prompt.replaceAll('{ticket}',input):`${prompt}\n\nTicket :\n${input}`;
 return [...(role?[{role:'system',content:role}]:[]),{role:'user',content}];
}
export async function complete(messages:{role:string;content:string}[],maxTokens=220){
 const key=process.env.OPENAI_API_KEY;
 if(!key)throw new ModelError('missing_key');
 const deadline=Date.now()+25_000;
 const payload=JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',messages,temperature:0,max_tokens:maxTokens,store:false});
 for(let attempt=0;attempt<=2;attempt++){
  const remaining=deadline-Date.now();
  if(remaining<=0)throw new ModelError('provider_unreachable');
  let response:Response;
  try{response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(remaining),cache:'no-store'});}catch{throw new ModelError('provider_unreachable');}
  const body=await response.json().catch(()=>({}));
  if(response.ok){
   const output=body.choices?.[0]?.message?.content;
   if(typeof output!=='string')throw new ModelError('empty_response');
   return {output,model:body.model as string,usage:body.usage as {prompt_tokens:number;completion_tokens:number}};
  }
  const code=body.error?.code;
  const quota=code==='insufficient_quota'||code==='credit_balance_exhausted';
  const failure=new ModelError(quota?'insufficient_quota':code==='model_not_found'?'model_not_found':response.status===429?'rate_limit':'provider_error');
  const transient=response.status===429||(response.status>=500&&response.status<=599);
  if(quota||!transient||attempt===2)throw failure;
  const retryAfter=response.headers.get('retry-after');
  const retryMs=retryAfter===null?0:Number.isFinite(Number(retryAfter))?Number(retryAfter)*1000:Date.parse(retryAfter)-Date.now();
  // A longer server cooldown is reported to the participant rather than retried too early.
  if(Number.isFinite(retryMs)&&retryMs>2000)throw failure;
  const wait=Math.min(2000,Math.max(250*2**attempt+Math.random()*100,Number.isFinite(retryMs)?retryMs:0));
  if(Date.now()+wait>=deadline)throw failure;
  await new Promise(resolve=>setTimeout(resolve,wait));
 }
 throw new ModelError('provider_error');
}
export async function pool<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<R[]> {
 if(!Number.isInteger(limit)||limit<1)throw new RangeError('invalid_pool_limit');
 const out:R[]=new Array(items.length);let next=0,failed=false;let firstError:unknown;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(!failed&&next<items.length){
   const i=next++;
   try{out[i]=await fn(items[i]);}catch(error){if(!failed){failed=true;firstError=error;}return;}
  }
 }));
 if(failed)throw firstError;
 return out;
}
