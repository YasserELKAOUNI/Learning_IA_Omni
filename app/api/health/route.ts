import {json} from '@/lib/http';
export async function GET(){return json({ok:true,model:process.env.OPENAI_MODEL||'gpt-4o-mini',apiConfigured:!!process.env.OPENAI_API_KEY,storageConfigured:!!process.env.BLOB_READ_WRITE_TOKEN||!process.env.VERCEL});}
