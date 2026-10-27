import { NextResponse } from 'next/server';
import { AppError } from './session';
import { ModelError } from './model';
export function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function failure(error:unknown){if(error instanceof AppError||error instanceof ModelError)return json({error:error.code},error.status);console.error('workshop_request_failed',{type:error instanceof Error?error.name:'unknown'});return json({error:'server_error'},503);}
export async function body(request:Request){const length=Number(request.headers.get('content-length')||0);if(length>16_000)throw new AppError('too_large',413);const raw=await request.text();if(Buffer.byteLength(raw)>16_000)throw new AppError('too_large',413);try{return JSON.parse(raw) as Record<string,unknown>;}catch{throw new AppError('invalid_json');}}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new AppError('invalid_origin',403);}
export function textField(value:unknown,max=4000){if(typeof value!=='string'||!value.trim()||Array.from(value).length>max)throw new AppError('invalid_prompt');return value.trim();}
