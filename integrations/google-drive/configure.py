#!/usr/bin/env python3
"""Configure the server-only Drive receiver; do not print credentials."""
import argparse
from getpass import getpass
from pathlib import Path
import os
import re
import secrets
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
FOLDER_ID = '1IZoMG1p3tViN8dIFjH5OyvYvfzpTo9sZ'


def validate_secret(secret):
    if len(secret) < 32 or any(c.isspace() for c in secret):
        raise SystemExit('Utilisez un secret aléatoire d’au moins 32 caractères, sans espace ; aucune modification.')
    return secret


def prepared_secret(text):
    matches = re.findall(r'(?m)^DRIVE_RECEIVER_SECRET=(.*)$', text)
    if not matches:
        return None
    values = []
    for value in matches:
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        values.append(validate_secret(value))
    if len(set(values)) != 1:
        raise SystemExit('Plusieurs secrets Drive différents existent dans .env.local ; aucune modification.')
    return values[0]


def write_environment(env_file, text, values):
    for key, value in values.items():
        pattern = r'(?m)^' + re.escape(key) + r'=.*$'
        line = key + '=' + value
        text = re.sub(pattern, lambda _: line, text) if re.search(pattern, text) else text.rstrip() + '\n' + line + '\n'
    fd, temporary = tempfile.mkstemp(prefix='.env-drive-', dir=env_file.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as output:
            output.write(text)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, env_file)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description='Configurer le récepteur Drive sans afficher de secret.')
    parser.add_argument('--prepare-secret', action='store_true', help='Préparer le secret local et le copier dans le presse-papiers macOS.')
    args = parser.parse_args()
    env_file = ROOT / '.env.local'
    text = env_file.read_text(encoding='utf-8') if env_file.exists() else ''
    secret = prepared_secret(text)

    if args.prepare_secret:
        secret = secret or secrets.token_urlsafe(48)
        write_environment(env_file, text, {'DRIVE_RECEIVER_SECRET': secret})
        try:
            subprocess.run(['pbcopy'], input=secret, encoding='utf-8', check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (OSError, subprocess.CalledProcessError):
            raise SystemExit('Secret enregistré localement, mais presse-papiers indisponible. Relancez cette commande dans Terminal sur macOS.')
        print('Secret préparé dans .env.local (0600) et copié dans le presse-papiers ; aucune valeur affichée.')
        print('Collez-le vous-même dans la propriété Google OMNI_RECEIVER_SECRET, puis enregistrez les propriétés.')
        return

    if not os.isatty(0):
        raise SystemExit('Utilisez un terminal interactif pour la configuration.')
    print('OMNI — connexion au récepteur Google Drive')
    url = input('URL Apps Script se terminant par /exec : ').strip()
    if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', url):
        raise SystemExit('URL /exec non reconnue ; aucune modification.')
    if secret is None:
        secret = validate_secret(getpass('Même secret que OMNI_RECEIVER_SECRET (masqué) : ').strip())
    else:
        print('Secret local préparé réutilisé ; aucune nouvelle saisie nécessaire.')
    values = {
        'GOOGLE_DRIVE_FOLDER_ID': FOLDER_ID,
        'GOOGLE_DRIVE_FOLDER_URL': 'https://drive.google.com/drive/folders/' + FOLDER_ID,
        'DRIVE_RECEIVER_URL': url,
        'DRIVE_RECEIVER_SECRET': secret,
    }
    write_environment(env_file, text, values)
    print('Configuration enregistrée dans .env.local (0600), hors Git ; aucune valeur secrète affichée.')
    print('Étape suivante : publier ces variables serveur chiffrées dans Vercel, puis redéployer.')


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('\nConfiguration annulée.')
