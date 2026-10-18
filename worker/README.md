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
- **Validation stricte** de chaque requête (Zod), corps limité à 4 ko, messages
  d'erreur génériques, aucune fuite d'information interne.
- Le domaine du worker est public par nature, mais toute route utile exige le
  jeton d'installation.

## Déploiement (à n'exécuter qu'avec l'accord explicite de Moussa — R8)

```bash
cd worker
npm ci

# 1. Créer l'espace KV et coller l'identifiant dans wrangler.toml
npx wrangler kv namespace create REMINDERS

# 2. Générer une paire de clés VAPID (une seule fois) hors du dépôt
npx web-push generate-vapid-keys

# 3. Déposer les secrets (jamais commités)
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT

# 4. Déployer
npx wrangler deploy
```

## Test minimal sur un vrai téléphone (J1, avant de construire le reste)

1. Déployer le worker (étapes ci-dessus).
2. Ouvrir `https://<adresse-de-la-pwa>/push-test.html` sur Android Chrome.
3. Coller l'adresse du worker, appuyer sur **1. Activer les notifications**,
   puis **2. Envoyer une notification de test**.
4. Fermer complètement le navigateur, renvoyer un test depuis la page : la
   notification doit apparaître app fermée.
5. Relever le résultat (fiabilité, délai) dans le CHANGELOG.

## Routes

| Méthode | Route                  | Authentification               | Rôle                           |
| ------- | ---------------------- | ------------------------------ | ------------------------------ |
| GET     | `/v1/vapid-public-key` | aucune (clé publique)          | clé publique VAPID             |
| POST    | `/v1/subscribe`        | jeton dans le corps            | enregistrer l'abonnement       |
| DELETE  | `/v1/subscribe`        | en-tête `x-installation-token` | désinscrire                    |
| POST    | `/v1/test-push`        | en-tête `x-installation-token` | notification de test immédiate |

La planification des rappels des 14 prochains jours (déclencheur planifié chaque
minute) est implémentée au jalon J6.
