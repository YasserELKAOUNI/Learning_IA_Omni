import {spawn} from 'node:child_process';
if(!process.env.ADMIN_KEY)throw new Error('ADMIN_KEY absent. Configurez .env.local.');
const base=process.env.APP_URL||'http://localhost:3000';
const url=new URL('/animateur',base);url.hash=new URLSearchParams({key:process.env.ADMIN_KEY}).toString();
const command=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open';
const args=process.platform==='win32'?['/c','start','',url.href]:[url.href];
const child=spawn(command,args,{stdio:'ignore'});child.on('exit',code=>{if(code===0)console.log('Espace animateur ouvert. La clé reste hors des journaux.');else process.exitCode=1;});
