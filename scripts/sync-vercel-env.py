#!/usr/bin/env python3
"""Transfer only the three explicitly authorized secrets to this Vercel project."""
import json
from pathlib import Path
import urllib.request
import urllib.error
ROOT=Path(__file__).resolve().parent.parent
AUTHORIZED_SECRETS=['OPENAI_API_KEY','APP_SECRET','ADMIN_KEY']
PUBLIC_CONFIG={'OPENAI_MODEL':'gpt-4o-mini','SESSION_CODE':'OMNI27','APP_URL':'https://omni-tp4.vercel.app','MAX_MODEL_CALLS':'3000'}
def main():
    values={}
    for line in (ROOT/'.env.local').read_text().splitlines():
        if '=' not in line or line.lstrip().startswith('#'):continue
        name,value=line.split('=',1)
        if name.strip() not in AUTHORIZED_SECRETS:continue
        value=value.strip()
        if value.startswith('"'):
            try:value=json.loads(value)
            except Exception:value=value.strip('"')
        values[name.strip()]=value
    if any(not values.get(k) for k in AUTHORIZED_SECRETS):raise SystemExit('Configuration incomplète ; aucune transmission.')
    project=json.loads((ROOT/'.vercel/project.json').read_text())
    auth=json.loads((Path.home()/'Library/Application Support/com.vercel.cli/auth.json').read_text())
    entries=[{'key':k,'value':v,'type':'encrypted','target':['production','preview','development']} for k,v in {**values,**PUBLIC_CONFIG}.items()]
    url='https://api.vercel.com/v10/projects/'+project['projectId']+'/env?upsert=true&teamId='+project['orgId']
    req=urllib.request.Request(url,data=json.dumps(entries).encode(),headers={'Authorization':'Bearer '+auth['token'],'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=30) as response:data=json.load(response)
    except urllib.error.HTTPError as error:
        try:code=json.load(error).get('error',{}).get('code','unknown')
        except Exception:code='unknown'
        raise SystemExit('Configuration Vercel refusée : HTTP '+str(error.code)+', '+str(code))
    if data.get('failed'):raise SystemExit('Une variable a été refusée ; vérifier Vercel.')
    print('Trois secrets autorisés transmis chiffrés au projet omni-tp4 ; quatre paramètres publics configurés. Aucune valeur affichée. Aucun identifiant Google transmis.')
if __name__=='__main__':main()
