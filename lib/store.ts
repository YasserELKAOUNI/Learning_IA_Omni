import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const locks=new Map<string,Promise<unknown>>();
const root=path.join(process.cwd(),'.data');
function valid(key:string){if(!/^[a-zA-Z0-9/_-]+\.json$/.test(key))throw new Error('invalid_store_key');return key;}
function remote(){if(process.env.BLOB_READ_WRITE_TOKEN)return true;if(process.env.VERCEL)throw new Error('storage_unconfigured');return false;}
// Blob GET can weaken the entity tag after HTTP compression. The version hash
// remains the origin hash (verified against HEAD); If-Match needs its strong form.
export function writeEtag(etag:string){return etag.replace(/^W\//,'');}
export function isWriteConflict(e:unknown){return e instanceof BlobPreconditionFailedError||/conditional request cannot succeed due to a conflicting operation/i.test(String(e));}
async function read<T>(key:string):Promise<{data:T;etag:string}|null>{valid(key);if(remote()){const result=await get(key,{access:'private',useCache:false,headers:{'Accept-Encoding':'identity'}});if(!result)return null;return {data:await new Response(result.stream).json() as T,etag:writeEtag(result.blob.etag)};}try{return {data:JSON.parse(await fs.readFile(path.join(root,key),'utf8')) as T,etag:''};}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}}
export async function load<T>(key:string):Promise<T|null>{return (await read<T>(key))?.data??null;}
async function write<T>(key:string,data:T,etag?:string,create=false){if(remote()){await put(valid(key),JSON.stringify(data),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:!create,...(etag?{ifMatch:etag}:{})});return;}const file=path.join(root,valid(key));await fs.mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${randomUUID()}.tmp`;await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,file);}
export async function saveNew<T>(key:string,data:T){await write(key,data,undefined,true);}
function binaryKey(key:string){if(!/^workshop\/uploads\/[A-Z0-9]+\/[a-f0-9-]{36}$/.test(key))throw new Error('invalid_file_key');return key;}
export async function saveBinary(key:string,data:Buffer){binaryKey(key);if(remote()){await put(key,data,{access:'private',addRandomSuffix:false,contentType:'application/octet-stream'});return;}const file=path.join(root,key);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data,{mode:0o600,flag:'wx'});}
export async function readBinary(key:string):Promise<Buffer>{binaryKey(key);if(remote()){const result=await get(key,{access:'private',useCache:false});if(!result)throw new Error('file_missing');return Buffer.from(await new Response(result.stream).arrayBuffer());}return fs.readFile(path.join(root,key));}
async function locked<T>(key:string,fn:()=>Promise<T>):Promise<T>{const previous=locks.get(key)??Promise.resolve();const current=previous.catch(()=>{}).then(fn);locks.set(key,current);try{return await current;}finally{if(locks.get(key)===current)locks.delete(key);}}
export async function mutate<T,R>(key:string,initial:()=>T,fn:(data:T)=>R):Promise<R>{const apply=async()=>{for(let attempt=0;attempt<40;attempt++){const current=await read<T>(key);const data=current?structuredClone(current.data):initial();const result=fn(data);try{await write(key,data,current?.etag,!current);return result;}catch(e){const conflict=isWriteConflict(e)||(!current&&/already exists/i.test(String(e)));if(!conflict||attempt===39)throw e;await new Promise(r=>setTimeout(r,25+Math.random()*Math.min(1500,80*1.35**attempt)));}}throw new Error('storage_contention');};return remote()?apply():locked(key,apply);}
