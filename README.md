# Learning_IA_Omni — OMNI Prompt Lab

Atelier de prompt engineering de 90 minutes : six défis, notation déterministe, progression, classement, interface animateur et canal général de documents. Identité OMNI reprise du support de cours fourni.

## Trois interfaces

- Participant : mission, exemples publics, prompt, score et indices. Les réponses API excluent les tickets cachés et corrigés.
- Animateur : démarrage/pause, finale, bonus, tous les essais et corrigés complets, export CSV et réception des fichiers.
- Projection : classement et progression collective, actualisés toutes les cinq secondes.

Le canal `/depot` fonctionne indépendamment des exercices et de la minuterie. Chaque participant voit ses propres fichiers ; l’animateur voit tous les dépôts.

## Backend

Next.js 16, React, fonctions Node.js Vercel en région Paris. Sessions, évaluations et fichiers sont persistés dans Vercel Blob privé. Les mutations utilisent des écritures conditionnelles par ETag et retries bornés. Les cookies sont signés et HttpOnly. La clé OpenAI reste côté serveur ; modèle vérifié : `gpt-4o-mini-2024-07-18` via l’alias `gpt-4o-mini`.

## Validation observée

La calibration et trois profils d’élèves utilisent de vrais appels au modèle. Débutant, niveau1 : 0/12 puis 9/12 puis 12/12. Expert, six niveaux : 12/12,10/12,11/12,8/8,8/8,11/12. Voir [calibration](docs/CALIBRATION.md).

Charge : vingt élèves inscrits puis vingt évaluations simultanées, toutes réussies et persistées sans retry client. Médiane19,550s, p95 29,772s, maximum36,553s ; vingt-trois sondes de disponibilité réussies. Ce burst local a utilisé le vrai stockage et le vrai fournisseur. Il ne constitue ni une preuve de capacité illimitée ni un test distribué du déploiement Vercel. Les rapports détaillés restent dans `artifacts/`, hors Git.

Les contrôles de contrat couvrent notamment notation, validation durable des niveaux, exclusion des données cachées, concurrence, erreurs fournisseur et récepteur Drive. Vingt-deux contrôles HTTP ont validé dépôt privé, accès aux fichiers, double soumission et persistance des scores.

## Développement et accès animateur

```bash
npm install
npm run config:openai
npm run dev
```

La saisie de clé est masquée. `.env.local` reste hors Git et hors des fichiers déployés. Renseigner les variables de `.env.example` avec des secrets aléatoires avant une nouvelle installation.

```bash
npm test
npm run check
npm run build
npm run calibrate
npm run animateur
```

`npm run animateur` ouvre l’interface avec la clé locale sans l’afficher dans les journaux. Renseigner `APP_URL` avec l’URL du déploiement pour ouvrir l’interface distante. Le code de session par défaut est `OMNI27` ; le serveur démarre en attente de lancement par l’animateur.

## Canal Google Drive

La réception privée de fichiers est fonctionnelle. La copie automatique sur Drive est préparée, mais nécessite encore la connexion et l’autorisation Google du propriétaire. Ne pas la présenter comme active avant un dépôt réel vérifié. [Procédure et limites Drive](docs/DRIVE.md).

## Pédagogie

Une bonne réponse vaut +1, une abstention0 et une erreur−1. Les niveaux validés départagent d’abord les participants, puis les points et la concision. Une validation acquise reste acquise. La calibration porte sur un corpus fini ; le débrief nomme le surapprentissage et invite à généraliser.
