# Service de rappels (Cloudflare Worker)

Petit service externe dont l'unique rôle est d'envoyer les rappels Web Push quand
l'application est fermée. Il ne reçoit que l'heure et le titre des blocs, plus
l'abonnement push du téléphone — jamais le reste des données.

## Modèle de sécurité

- **Jeton secret par installation** : l'application génère un jeton aléatoire de
  256 bits (`crypto.getRandomValues`) et l'envoie à l'abonnement. Le service ne
  stocke que le SHA-256 du jeton ; un jeton volé ne peut donc pas être relu depuis
  le stockage, et chaque installation ne peut s'adresser qu'à son propre
  abonnement.
- **Clés VAPID en secrets Cloudflare**, jamais dans le dépôt (R5) :
  `wrangler secret put VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.
- **Origines autorisées** : le service n'accepte que `http://localhost:5173`
  (page de test servie en local) et `https://veynom007.github.io` (application
  déployée). Le préflight `OPTIONS` répond `204` avec
  `Access-Control-Allow-Headers: content-type, x-installation-token`, et toute
  autre origine reçoit `403` sans en-tête CORS. Les requêtes sans en-tête
  `Origin` (clients hors navigateur) restent acceptées.
- **Requêtes limitées à 4 ko** : un corps plus volumineux reçoit `413` (la
  longueur déclarée est refusée avant lecture, puis le nombre réel d'octets est
  vérifié).
- **Abonnements expirants** : chaque abonnement stocké dans KV expire au bout
  de 90 jours (`expirationTtl`) ; l'application le renouvelle à chaque
  démarrage, ce qui évite d'accumuler des abonnements morts.
- **Validation stricte** de chaque requête (Zod), messages
  d'erreur génériques, aucune fuite d'information interne.
- Le domaine du worker est public par nature, mais toute route utile exige le
  jeton d'installation.

## Déploiement (à n'exécuter qu'avec l'accord explicite de Moussa — R8)

Les secrets ne peuvent être déposés qu'**après** la première mise en ligne du
worker (`wrangler secret put` refuse un worker inexistant) : le déploiement
précède donc le dépôt des secrets.

```bash
cd worker
npm ci

# 0. Se connecter au compte Cloudflare (une seule fois, ouvre le navigateur)
npx wrangler login

# 1. Créer l'espace KV et coller l'identifiant dans wrangler.toml
npx wrangler kv namespace create REMINDERS

# 2. Générer une paire de clés VAPID (une seule fois, hors du dépôt)
npx web-push generate-vapid-keys
# → {"publicKey":"...","privateKey":"..."} avec l'option --json

# 3. Déployer (le worker doit exister avant de pouvoir recevoir des secrets)
npx wrangler deploy

# 4. Déposer les secrets (jamais commités, jamais écrits dans un fichier)
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

`VAPID_SUBJECT` doit être une URI de contact, par exemple
`https://github.com/VEYNOM007/planificateur` (exigé par la spécification
VAPID).

### Test de l'application fermée

`POST /v1/test-push` accepte un champ `delaySeconds` (entier de 0 à 25) :
la notification part `delaySeconds` secondes **après** la réponse HTTP. Cela
permet de fermer l'application (ou le navigateur) juste après avoir déclenché le
test, et de vérifier que la notification arrive quand même.

La limite vient de Cloudflare : après l'envoi de la réponse, l'exécution
étendue (`ctx.waitUntil`) n'est accordée que 30 secondes. La valeur maximale
retenue est donc 25 s, pour garder une marge à l'appel HTTPS vers le service de
push.

## Test minimal sur un vrai téléphone (J1, avant de construire le reste)

1. Déployer le worker (étapes ci-dessus).
2. Ouvrir la page de test sur Android Chrome :
   - en local, `adb reverse tcp:5173 tcp:5173` puis
     `http://localhost:5173/push-test.html` (`localhost` est un contexte
     sécurisé, indispensable pour l'API Push) ;
   - en ligne, `https://<adresse-de-la-pwa>/push-test.html`.
3. Coller l'adresse du worker, appuyer sur **1. Activer les notifications**.
4. Régler le délai (15 s par défaut), appuyer sur **2. Envoyer une notification
   de test**, puis **fermer complètement l'application**.
5. La notification doit apparaître malgré la fermeture.
6. Relever le résultat (fiabilité, délai) dans le CHANGELOG.

## Routes

| Méthode | Route                  | Authentification               | Rôle                                         |
| ------- | ---------------------- | ------------------------------ | -------------------------------------------- |
| GET     | `/v1/vapid-public-key` | aucune (clé publique)          | clé publique VAPID                           |
| POST    | `/v1/subscribe`        | jeton dans le corps            | enregistrer l'abonnement                     |
| DELETE  | `/v1/subscribe`        | en-tête `x-installation-token` | désinscrire                                  |
| POST    | `/v1/test-push`        | en-tête `x-installation-token` | notification de test (immédiate ou différée) |

Corps accepté par `POST /v1/test-push` :

```json
{
  "title": "Planificateur",
  "body": "Notification de test reçue.",
  "delaySeconds": 15
}
```

La planification des rappels des 14 prochains jours (déclencheur planifié chaque
minute) est implémentée au jalon J6.
