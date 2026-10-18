# Architecture

## Vue d'ensemble

Application entièrement côté client : le navigateur du téléphone stocke les
données (IndexedDB via Dexie) et exécute tout le code. Le seul appel externe à
l'exécution est le service de rappels Web Push (`worker/`), qui ne reçoit que
l'heure et le titre des blocs.

Aucun nom de domaine, aucun compte, aucune synchronisation en V1.

## Couches

| Dossier         | Rôle                                                                 | Dépendances autorisées          |
| --------------- | -------------------------------------------------------------------- | ------------------------------- |
| `src/ui/`       | écrans, composants, gestes, styles                                   | `state`, `domain`, `platform`   |
| `src/state/`    | état applicatif global (Zustand)                                     | `domain`, `data`                |
| `src/domain/`   | logique pure : récurrence, placement des blocs, durée, dates locales | **aucune** (ni React, ni Dexie) |
| `src/data/`     | schéma Dexie, migrations, dépôts typés, validation Zod               | `domain`                        |
| `src/platform/` | accès au navigateur : persistance, push, partage, installation       | aucune (isolé et remplaçable)   |

Règle : les couches ne se court-circuitent pas. L'interface n'appelle jamais
Dexie directement, elle passe par un dépôt. Le domaine ne connaît ni React ni
Dexie, ce qui le rend testable à 100 %.

## Hors ligne d'abord

- Le service worker (vite-plugin-pwa / Workbox) précharge tous les fichiers au
  premier lancement : aucune requête réseau n'est nécessaire ensuite.
- Aucun runtime caching réseau : les données ne quittent jamais le téléphone.
- Icônes et polices embarquées localement (pas de CDN, police système).

## Mise à jour

`registerType: 'prompt'` : quand une nouvelle version est détectée, une bannière
propose « Recharger ». Jamais de rechargement forcé, jamais de perte de données.

## Chemin de base

`VITE_BASE_PATH` (voir `.env.example`) permet de servir l'application à la
racine ou dans un sous-dossier (`/<depot>/`) sans modifier le code. Les
`start_url` et `scope` du manifeste sont relatifs.

## Données et modèle

Six entités IndexedDB : `Category`, `Block`, `Override`, `Task`, `Template`,
`Settings` (jalon J1). Identifiants UUID générés sur l'appareil, chaque
enregistrement porte `createdAt`, `updatedAt` et `deletedAt` (suppression
logique) pour permettre une synchronisation future sans refonte.

Heures **locales et flottantes** : on stocke une date locale `AAAA-MM-JJ` et des
minutes depuis minuit, jamais un horodatage UTC — un bloc à 6h00 reste à 6h00
après un changement d'heure.

## Sécurité

- Import de fichier traité comme hostile : validation Zod complète avant toute
  écriture, taille limitée.
- Aucune donnée personnelle dans le dépôt git.
- Secrets (clés VAPID) uniquement dans les secrets Cloudflare.
- Worker : jeton secret par installation (seul son SHA-256 est stocké), corps
  limité, messages d'erreur génériques.
- Frontière d'erreur globale : jamais d'écran blanc, export toujours accessible.

## Tests

| Niveau              | Outil             | Cible                                     |
| ------------------- | ----------------- | ----------------------------------------- |
| Domaine et unitaire | Vitest            | couverture ≥ 90 % sur `src/domain/**`     |
| Parcours            | Playwright (J2+)  | émulation mobile, scénarios d'acceptation |
| Bout en bout réel   | téléphone Android | scénarios 1, 7 et 8                       |

## Qualité

`npm run verify` est la porte unique avant tout commit : `tsc -b` sans erreur,
ESLint sans avertissement (`any`, `@ts-ignore`, `eslint-disable` interdits),
tests avec seuil de couverture, build, puis contrôle du poids gzip (< 200 ko).
