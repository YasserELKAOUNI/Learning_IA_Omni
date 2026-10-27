#!/usr/bin/env python3
"""Receive an API key using hidden terminal input; never print the value."""
import concurrent.futures
import getpass
import json
import os
from pathlib import Path
import re
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
MODELS = ['gpt-4o-mini', 'gpt-4.1-nano']

def probe(key, model):
    payload = {'model': model, 'messages': [{'role': 'user', 'content': 'Réponds uniquement OK.'}], 'max_tokens': 8, 'temperature': 0, 'store': False}
    req = urllib.request.Request('https://api.openai.com/v1/chat/completions', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.load(response)
        return {'model': model, 'ok': True, 'resolved': data.get('model')}
    except urllib.error.HTTPError as error:
        try:
            detail = json.load(error).get('error', {})
        except Exception:
            detail = {}
        return {'model': model, 'ok': False, 'http': error.code, 'code': detail.get('code', 'api_error')}
    except Exception:
        return {'model': model, 'ok': False, 'code': 'network_error'}

def main():
    if not os.isatty(0):
        raise SystemExit('Ouvrez un terminal interactif pour la saisie masquée.')
    print('OMNI Prompt Lab — configuration OpenAI')
    print('Collez la clé au prochain message, puis appuyez sur Entrée. La saisie reste invisible.')
    key = getpass.getpass('Clé OpenAI (masquée) : ').strip()
    if not key.startswith('sk-') or len(key) < 20 or any(c.isspace() for c in key):
        raise SystemExit('Format de clé non reconnu. Aucune modification effectuée.')
    print('Vérification des deux modèles…')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda model: probe(key, model), MODELS))
    if all(r.get('http') == 401 for r in results):
        raise SystemExit('Clé refusée par OpenAI. Aucune modification effectuée.')
    selected = next((r['model'] for r in results if r['ok']), MODELS[0])
    env_file = ROOT / '.env.local'
    contents = env_file.read_text() if env_file.exists() else ''
    for name, value in [('OPENAI_API_KEY', key), ('OPENAI_MODEL', selected)]:
        line = name + '=' + value
        pattern = r'(?m)^' + name + r'=.*$'
        contents = re.sub(pattern, lambda _: line, contents) if re.search(pattern, contents) else contents.rstrip() + '\n' + line + '\n'
    fd, temporary = tempfile.mkstemp(prefix='.env-setup-', dir=ROOT)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as output:
            output.write(contents)
        os.replace(temporary, env_file)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    folder = ROOT / 'artifacts'
    folder.mkdir(exist_ok=True)
    (folder / 'key-setup-status.json').write_text(json.dumps({'configuredAt': int(time.time()), 'model': selected, 'probes': results}, indent=2))
    print('Clé enregistrée localement dans .env.local, hors Git. Sa valeur n’a pas été affichée.')
    for result in results:
        print(result['model'] + ' : ' + ('appel réussi' if result['ok'] else str(result.get('code'))))
    print('Modèle configuré : ' + selected)
    print('Configuration terminée. Codex peut maintenant publier cette configuration sur Vercel.')

if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('\nSaisie annulée.')
