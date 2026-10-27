import { NextResponse } from 'next/server';
import { AppError } from './session';
import { ModelError } from './model';
export function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function failure(error:unknown){if(error instanceof AppError||error instanceof ModelError)return json({error:error.code},error.status);console.error('workshop_request_failed',{type:error instanceof Error?error.name:'unknown'});return json({error:'server_error'},503);}
export async function body(request:Request){const length=Number(request.headers.get('content-length')||0);if(length>16_000)throw new AppError('too_large',413);const raw=await request.text();if(Buffer.byteLength(raw)>16_000)throw new AppError('too_large',413);try{const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('invalid_json');return parsed as Record<string,unknown>;}catch{throw new AppError('invalid_json');}}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin)return;const expected=new URL(request.url);const host=request.headers.get('host');if(host)expected.host=host;if(origin!==expected.origin)throw new AppError('invalid_origin',403);}
export function textField(value:unknown,max=4000){if(typeof value!=='string'||!value.trim()||Array.from(value).length>max)throw new AppError('invalid_prompt');return value.trim();}
