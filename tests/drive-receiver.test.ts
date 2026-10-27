import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const code=readFileSync(new URL('../integrations/google-drive/Code.gs',import.meta.url),'utf8');
const secret='test-only-value-'.repeat(4);
function receiver(options:{configured?:boolean;lockBusy?:boolean;descriptionFailure?:boolean}={}){
 const files:{name:string;bytes:number[];id:string;description?:string}[]=[];
 let driveCalls=0;
 const wrap=(file:typeof files[number])=>({getName:()=>file.name,getId:()=>file.id,getUrl:()=>`https://drive.example.test/file/${file.id}`,getBlob:()=>({getBytes:()=>file.bytes}),setDescription:(description:string)=>{if(options.descriptionFailure)throw new Error('simulated interruption');file.description=description;}});
 const context=vm.createContext({
  PropertiesService:{getScriptProperties:()=>({getProperty:(key:string)=>options.configured===false?null:key==='OMNI_RECEIVER_SECRET'?secret:'allowed-folder'})},
  LockService:{getScriptLock:()=>({tryLock:()=>!options.lockBusy,hasLock:()=>!options.lockBusy,releaseLock:()=>{}})},
  Utilities:{base64Decode:(b64:string)=>Array.from(Buffer.from(b64,'base64')),newBlob:(bytes:number[],mime:string,name:string)=>({bytes,mime,name}),computeDigest:(_:unknown,bytes:number[])=>Array.from(createHash('sha256').update(Buffer.from(bytes)).digest()),DigestAlgorithm:{SHA_256:'SHA256'},base64EncodeWebSafe:(bytes:number[])=>Buffer.from(bytes).toString('base64url')},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:(text:string)=>({setMimeType:()=>text})},
  DriveApp:{getFolderById:(id:string)=>{driveCalls++;assert.equal(id,'allowed-folder');return {searchFiles:(query:string)=>{const prefix=/title contains '([^']+)'/.exec(query)![1],matches=files.filter(f=>f.name.startsWith(prefix));let i=0;return {hasNext:()=>i<matches.length,next:()=>wrap(matches[i++])};},createFile:(blob:{name:string;bytes:number[]})=>{const file={name:blob.name,bytes:blob.bytes,id:`file-${files.length+1}`};files.push(file);return wrap(file);}};}}
 });
 vm.runInContext(code,context);
 const call=(payload:Record<string,unknown>)=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(payload)}})) as Record<string,unknown>;
 return {call,context,files,get driveCalls(){return driveCalls;}};
}
function payload(extra:Record<string,unknown>={}){return {secret,folder:'allowed-folder',id:'12345678-1234-1234-1234-123456789abc',name:'document témoin.txt',mime:'text/plain',data:Buffer.from('contenu fictif').toString('base64'),...extra};}

test('Drive receiver refuses bad secret or another folder before accessing Drive',()=>{const r=receiver();assert.equal(r.call(payload({secret:'wrong'})).error,'unauthorized');assert.equal(r.call(payload({folder:'another-folder'})).error,'folder_not_allowed');assert.equal(r.driveCalls,0);assert.equal(r.files.length,0);});
test('Drive receiver creates a file only in configured folder and retries idempotently',()=>{const r=receiver(),first=r.call(payload()),retry=r.call(payload());assert.equal(first.id,'file-1');assert.equal(retry.id,first.id);assert.equal(retry.duplicate,true);assert.equal(r.files.length,1);assert.equal(Buffer.from(r.files[0].bytes).toString(),'contenu fictif');});
test('Same upload ID with changed bytes cannot overwrite or create another file',()=>{const r=receiver();r.call(payload());const conflict=r.call(payload({data:Buffer.from('autre contenu').toString('base64')}));assert.equal(conflict.error,'upload_id_conflict');assert.equal(r.files.length,1);});
test('File type and decoded size are checked before Drive writes',()=>{const r=receiver();assert.equal(r.call(payload({mime:'text/html'})).error,'file_type');assert.equal(r.call(payload({data:Buffer.alloc(3*1024*1024+1).toString('base64')})).error,'file_size');assert.equal(r.call(payload({data:'!bad!'})).error,'file_size');assert.equal(r.driveCalls,0);});
test('Concurrent lock contention reports busy without a write',()=>{const r=receiver({lockBusy:true});assert.equal(r.call(payload()).error,'receiver_busy');assert.equal(r.driveCalls,0);});
test('A response interrupted after create can recover its same file on retry',()=>{const r=receiver({descriptionFailure:true});assert.equal(r.call(payload()).error,'receiver_error');assert.equal(r.files.length,1);const retry=r.call(payload());assert.equal(retry.id,'file-1');assert.equal(retry.duplicate,true);assert.equal(r.files.length,1);});
test('Receiver has a harmless GET and refuses unconfigured state',()=>{const r=receiver({configured:false});assert.equal(JSON.parse(r.context.doGet()).method,'POST');assert.equal(r.call(payload()).error,'receiver_unconfigured');assert.equal(r.driveCalls,0);});
