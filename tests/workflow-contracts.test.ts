import test from 'node:test';
import assert from 'node:assert/strict';
import { ranked, unlocked, timeLeft, finaleAvailable, type Player, type Score, type Session } from '../lib/catalog';
import { isAvailable, type OwnPlayer, type PublicSession } from '../lib/client';
import { pool, complete, ModelError } from '../lib/model';

function score(id:string, correct:number, wrong:number, abstained:number):Score {
  return {id,level:'1',correct,wrong,abstained,points:correct-wrong,total:12,length:100,model:'test-model',createdAt:1,durationMs:1};
}
function player(id:string):Player {
  return {id,name:id,joinedAt:0,attempts:0,lastAttemptAt:0,runningUntil:0,best:{},first:{},history:[],bonus:0};
}
function session(players:Player[]):Session {
  return {code:'TEST',title:'test',status:'live',durationMinutes:90,remainingMs:90*60_000,resumedAt:1,finaleOpen:false,bonusOpen:false,freeProgression:false,maxCalls:1000,usedCalls:0,maxAttempts:30,players,createdAt:1};
}

test('La validation reste acquise quand un meilleur score en points utilise plus d’abstentions',()=>{
  const p=player('élève');
  const passing=score('passing',9,3,0);
  const safer=score('safer',8,0,4);
  p.history=[passing,safer];p.first['1']=passing;p.best['1']=safer;
  const s=session([p]);
  assert.equal(unlocked(s,p,'2'),true,'le niveau 2 doit rester ouvert après une validation précédente');
  assert.equal(ranked(s)[0].completed,1,'le classement doit conserver le niveau validé');
  const pub={...s,leaderboard:ranked(s),participants:1,serverNow:1} as PublicSession;
  assert.equal(isAvailable(pub,{...p,hasVault:false} as OwnPlayer,'2'),true,'le client et le serveur doivent être cohérents');
});

test('Le classement départage par niveaux, points puis longueur, dans cet ordre',()=>{
  const short=player('court'),long=player('long'),unpassed=player('nonvalidé');
  short.best['1']={...score('s',9,3,0),length:70};short.history=[short.best['1']];
  long.best['1']={...score('l',9,3,0),length:170};long.history=[long.best['1']];
  unpassed.best['1']={...score('u',8,0,4),length:1};unpassed.history=[unpassed.best['1']];
  assert.deepEqual(ranked(session([unpassed,long,short])).map(p=>p.id),['court','long','nonvalidé']);
});

test('La pause arrête le décompte et la finale reste fermée avant la séance',()=>{
  const s=session([]);s.remainingMs=20*60_000;s.resumedAt=1000;
  assert.equal(timeLeft(s,61_000),19*60_000);
  s.status='paused';assert.equal(timeLeft(s,61_000),20*60_000);
  s.status='waiting';s.remainingMs=0;assert.equal(finaleAvailable(s),false);
});

test('Le pool attend les tâches actives et cesse d’attribuer des tickets après une erreur',async()=>{
  const started:number[]=[];
  let active=0;
  const run=pool([0,1,2,3,4,5],2,async value=>{
    started.push(value);active++;
    try{
      if(value===0){await new Promise(r=>setTimeout(r,5));throw new Error('provider-test-error');}
      await new Promise(r=>setTimeout(r,30));return value;
    }finally{active--;}
  });
  await assert.rejects(run,/provider-test-error/);
  assert.equal(active,0,'aucun worker ne doit continuer après le rejet du pool');
  assert.deepEqual(started,[0,1],'les tickets suivants ne doivent plus être envoyés au fournisseur');
});

test('Le pool conserve l’ordre des réponses malgré des durées différentes',async()=>{
  const result=await pool([3,1,2],2,async n=>{await new Promise(r=>setTimeout(r,n));return n*2;});
  assert.deepEqual(result,[6,2,4]);
  assert.deepEqual(await pool([],2,async n=>n),[]);
  await assert.rejects(pool([1],0,async n=>n),RangeError);
});

function syntheticKey(){const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='synthetic-test-value';return()=>{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;};}
function success(){return new Response(JSON.stringify({model:'synthetic-test-model',choices:[{message:{content:'OK'}}],usage:{prompt_tokens:1,completion_tokens:1}}),{status:200,headers:{'Content-Type':'application/json'}});}

test('Un 429 transitoire est réessayé puis le vrai résultat est renvoyé',async t=>{
  const restore=syntheticKey();let calls=0;
  t.mock.method(globalThis,'fetch',async()=>++calls===1?new Response(JSON.stringify({error:{code:'rate_limit_exceeded'}}),{status:429,headers:{'Retry-After':'0'}}):success());
  try{assert.equal((await complete([{role:'user',content:'synthetic'}])).output,'OK');assert.equal(calls,2);}finally{restore();}
});

test('Un échec fournisseur persistant est borné à trois tentatives',async t=>{
  const restore=syntheticKey();let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}',{status:503});});
  try{await assert.rejects(complete([{role:'user',content:'synthetic'}]),(e:unknown)=>e instanceof ModelError&&e.code==='provider_error');assert.equal(calls,3);}finally{restore();}
});

test('Les crédits épuisés et une clé refusée ne sont jamais réessayés',async t=>{
  const restore=syntheticKey();let calls=0;let status=429;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(JSON.stringify({error:{code:status===429?'credit_balance_exhausted':'invalid_api_key'}}),{status});});
  try{await assert.rejects(complete([{role:'user',content:'synthetic'}]),(e:unknown)=>e instanceof ModelError&&e.code==='insufficient_quota');assert.equal(calls,1);status=401;await assert.rejects(complete([{role:'user',content:'synthetic'}]));assert.equal(calls,2);}finally{restore();}
});

test('Un Retry-After supérieur à deux secondes est rendu à l’utilisateur sans appel prématuré',async t=>{
  const restore=syntheticKey();let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}',{status:429,headers:{'Retry-After':'10'}});});
  try{await assert.rejects(complete([{role:'user',content:'synthetic'}]),(e:unknown)=>e instanceof ModelError&&e.code==='rate_limit');assert.equal(calls,1);}finally{restore();}
});

test('La limite de 25 secondes couvre toutes les tentatives, sans repartir de zéro',async t=>{
  const restore=syntheticKey();let now=1000,calls=0;const budgets:number[]=[];
  t.mock.method(Date,'now',()=>now);
  t.mock.method(AbortSignal,'timeout',(ms:number)=>{budgets.push(ms);return new AbortController().signal;});
  t.mock.method(globalThis,'fetch',async()=>{calls++;now+=calls===1?20_000:6000;return new Response('{}',{status:503});});
  try{await assert.rejects(complete([{role:'user',content:'synthetic'}]),ModelError);assert.equal(calls,2);assert.deepEqual(budgets,[25_000,5000]);}finally{restore();}
});
