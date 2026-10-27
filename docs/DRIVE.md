# Canal général de documents — connexion Google Drive

Le dépôt de documents est indépendant des défis et de leurs scores. L’application reçoit d’abord chaque fichier dans Vercel Blob privé. Elle le copie dans le dossier Drive seulement quand le récepteur est configuré et a répondu avec l’identifiant du fichier. Une erreur Drive laisse la copie privée récupérable dans l’espace animateur ; le statut « copié sur Drive » n’est jamais affiché sur une simple tentative.

Dossier de réception créé et relu avec le connecteur : [OMNI TP4 — dépôts participants](https://drive.google.com/drive/folders/1IZoMG1p3tViN8dIFjH5OyvYvfzpTo9sZ). Son nom peut être changé dans Drive sans modifier son identifiant. Le connecteur Drive de Codex et l’autorisation de l’application Vercel sont deux connexions distinctes.

## Connexion côté animateur

1. Ouvrir [Google Apps Script](https://script.google.com/home/start) avec le compte propriétaire du dossier et créer un projet « OMNI — canal documents ».
2. Remplacer le fichier `Code.gs` par [le récepteur du dépôt](../integrations/google-drive/Code.gs). Dans **Paramètres du projet**, activer l’affichage du manifeste, puis remplacer `appsscript.json` par [le manifeste fourni](../integrations/google-drive/appsscript.json).
3. Dans **Paramètres du projet → Propriétés du script**, ajouter `OMNI_FOLDER_ID` avec la valeur `1IZoMG1p3tViN8dIFjH5OyvYvfzpTo9sZ` et `OMNI_RECEIVER_SECRET` avec un secret aléatoire d’au moins 32 caractères. Ce secret doit être identique à `DRIVE_RECEIVER_SECRET` côté Vercel. Ne jamais le mettre dans `Code.gs`, le navigateur participant, Git ou le chat.
4. Choisir **Déployer → Nouveau déploiement → Application Web**, **Exécuter en tant que moi**, et accès **Tout le monde**. L’accès anonyme est nécessaire pour l’appel serveur à serveur ; le récepteur refuse chaque dépôt sans le secret. Si l’organisation interdit ce mode, ce canal doit rester désactivé jusqu’à une intégration Google approuvée par son administrateur.
5. **À ce point, le propriétaire doit examiner et accepter lui-même l’autorisation Google.** Le scope `DriveApp` demandé est un accès Drive large au niveau Google ; la restriction au dossier est imposée par le code du récepteur. Il ne faut pas présenter cette restriction comme une permission OAuth limitée à un dossier. L’autorisation n’est pas demandée aux participants.
6. Copier l’URL de déploiement se terminant par `/exec`, puis saisir les variables serveur dans la procédure terminal décrite ci-dessous. Redéployer l’application Vercel.

Un avertissement de sécurité du navigateur ou un écran de consentement Google doit être traité par le propriétaire. Le code et sa configuration sont prêts à être inspectés avant cette étape ; aucune autorisation Drive n’est présumée accordée.

## Saisie des variables serveur

À la racine du projet, lancer la procédure interactive :

```bash
cd /Users/elkaouniyasser/omni-tp4
python3 integrations/google-drive/configure.py
```

Elle demande l’URL `/exec`, puis le même secret que celui saisi dans les propriétés du script, avec saisie masquée. Elle met à jour `.env.local` atomiquement avec permissions `0600`, sans afficher de secret et sans changer les autres variables. Choisir le secret aléatoire dans un gestionnaire de mots de passe puis le saisir dans les deux emplacements ; il n’est jamais nécessaire de l’envoyer dans le chat.

Les noms enregistrés sont `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_DRIVE_FOLDER_URL`, `DRIVE_RECEIVER_URL` et `DRIVE_RECEIVER_SECRET`. Aucun n’est préfixé `NEXT_PUBLIC_` : l’URL du récepteur et son secret restent côté serveur.

Transmettre ensuite ces variables à Vercel par saisie masquée ou stdin, en type chiffré/sensible, pour les environnements réellement utilisés. La configuration locale seule ne met pas à jour le déploiement. Aucun token personnel du connecteur Codex n’a besoin d’être extrait ou réutilisé.

## Vérification avant activation

Dans le canal, déposer un petit fichier témoin sans données personnelles. L’espace animateur doit d’abord montrer sa réception. Après la copie, vérifier le lien Drive puis relire ses métadonnées depuis Drive. Relancer la même copie : le récepteur doit renvoyer le même identifiant, sans deuxième fichier. Tester aussi une mauvaise valeur de secret et un autre dossier : aucun fichier ne doit être créé. Le récepteur renvoie des erreurs JSON neutres et ne journalise ni secret ni contenu.

Le contrat est `POST` JSON `{secret, folder, id, name, mime, data}` avec données base64 et identifiant d’upload UUID. La réponse réussie est `{id, webViewLink, duplicate}`. Les réponses d’erreur ne contiennent jamais d’`id` ; le backend les considère donc comme des copies non abouties. Google ContentService peut rediriger la réponse : le client serveur doit suivre les redirections, comme le `fetch` utilisé par le backend.

## Capacité et limites

Le récepteur accepte les mêmes types que le canal applicatif : texte, Markdown, CSV, PDF, DOCX, XLSX, PPTX, PNG et JPEG, jusqu’à **3 Mio par fichier**. Il ne publie ni ne convertit les documents et conserve les permissions du dossier. Un verrou Apps Script protège la déduplication des requêtes concurrentes ; un UUID dans le nom Drive permet de retrouver un upload après une réponse interrompue.

Cette connexion convient à un canal de réception de petit volume, mais **sa capacité n’est pas encore qualifiée par un test réel déployé**. Apps Script et Drive ont leurs propres quotas, indépendants de ceux de Vercel. Pour un canal d’entreprise à gros volume, utiliser une intégration Drive OAuth dédiée avec file de travail durable et reprise des copies ; ne pas extrapoler les tests de l’atelier à cet usage.

Références officielles : [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web), [verrous de script](https://developers.google.com/apps-script/reference/lock/lock-service), [manifeste Web App](https://developers.google.com/apps-script/manifest/web-app-api-executable), [quotas Apps Script](https://developers.google.com/apps-script/guides/services/quotas).
