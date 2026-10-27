# Learning_IA_Omni

Plateforme OMNI Prompt Lab pour un atelier de prompt engineering de 90 minutes : exercices, évaluation de prompts avec OpenAI, progression, classement et espace animateur.

La validation fonctionnelle et les tests de concurrence sont en cours. Les secrets et résultats de test restent hors du dépôt.

## Développement

```bash
npm install
npm run dev
```

La configuration locale utilise `.env.local` (ignoré par Git). Pour configurer la clé OpenAI avec saisie masquée :

```bash
npm run config:openai
```

## Vérifications

```bash
npm run check
npm test
npm run calibrate
```
