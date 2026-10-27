import {admin,getSession,configuredCode} from '@/lib/session';
import {body,failure,json,sameOrigin} from '@/lib/http';
import {driveConfigured,syncDrive} from '@/lib/uploads';
export const maxDuration=60;
export async function GET(){try{await admin();const s=await getSession();return json({files:(s.uploads??[]).filter(f=>f.ready),driveConfigured:driveConfigured(),folderUrl:process.env.GOOGLE_DRIVE_FOLDER_URL||null});}catch(e){return failure(e);}}
export async function POST(req:Request){try{sameOrigin(req);await admin();const b=await body(req);return json(await syncDrive(configuredCode(),String(b.id??'')));}catch(e){return failure(e);}}
