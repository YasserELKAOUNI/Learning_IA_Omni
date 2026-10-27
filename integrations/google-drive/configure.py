#!/usr/bin/env python3
"""Configure the server-only Drive receiver; do not print credentials."""
from getpass import getpass
from pathlib import Path
import os
import re
import tempfile

ROOT = Path(__file__).resolve().parents[2]
FOLDER_ID = '1IZoMG1p3tViN8dIFjH5OyvYvfzpTo9sZ'


def main():
    if not os.isatty(0):
        raise SystemExit('Utilisez un terminal interactif pour la saisie masquée.')
    print('OMNI — connexion au récepteur Google Drive')
    url = input('URL Apps Script se terminant par /exec : ').strip()
    secret = getpass('Même secret que OMNI_RECEIVER_SECRET (masqué) : ').strip()
    if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', url):
        raise SystemExit('URL /exec non reconnue ; aucune modification.')
    if len(secret) < 32 or any(c.isspace() for c in secret):
        raise SystemExit('Utilisez un secret aléatoire d’au moins 32 caractères, sans espace ; aucune modification.')
    values = {
        'GOOGLE_DRIVE_FOLDER_ID': FOLDER_ID,
        'GOOGLE_DRIVE_FOLDER_URL': 'https://drive.google.com/drive/folders/' + FOLDER_ID,
        'DRIVE_RECEIVER_URL': url,
        'DRIVE_RECEIVER_SECRET': secret,
    }
    env_file = ROOT / '.env.local'
    text = env_file.read_text() if env_file.exists() else ''
    for key, value in values.items():
        pattern = r'(?m)^' + re.escape(key) + r'=.*$'
        line = key + '=' + value
        text = re.sub(pattern, lambda _: line, text) if re.search(pattern, text) else text.rstrip() + '\n' + line + '\n'
    fd, temporary = tempfile.mkstemp(prefix='.env-drive-', dir=ROOT)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as output:
            output.write(text)
        os.replace(temporary, env_file)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('Configuration enregistrée dans .env.local, hors Git ; aucune valeur secrète affichée.')
    print('Étape suivante : publier ces variables serveur chiffrées dans Vercel, puis redéployer.')


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('\nConfiguration annulée.')
