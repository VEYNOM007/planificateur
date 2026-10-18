# CHANGELOG

Toutes les étapes notables, jalon par jalon, selon le cahier des charges.

## [0.1.0] — J0 Socle — 2026-10-16

### Ajouté

- Projet Vite + React 18 + TypeScript strict, structure en couches
  `src/{ui,state,domain,data,platform}`.
- PWA installable : manifeste (nom, langue fr, icônes 192/512 + maskable 512 +
  Apple 180), service worker de préchargement, fonctionnement hors ligne.
- Chemin de base configurable par `VITE_BASE_PATH` (GitHub Pages, sous-dossier).
- Bannière « Nouvelle version disponible — Recharger » (mise à jour jamais
  forcée).
- Coquille d'application : navigation par hash à quatre onglets, thèmes clair
  et sombre selon le réglage du téléphone, zones tactiles de 44 px.
- Demande de persistance du stockage au premier lancement
  (`navigator.storage.persist()`).
- Jeton d'installation aléatoire (256 bits) généré et conservé sur l'appareil.
- Qualité : ESLint strict (interdiction de `any`, `@ts-ignore`,
  `eslint-disable`), Prettier, Vitest avec seuil de couverture ≥ 90 % sur le
  domaine, contrôle automatique du poids gzip (< 200 ko).
- CI GitHub Actions (typecheck, lint, format, tests, build, poids) et workflow
  de déploiement GitHub Pages, bloqué si les tests échouent.
- Service de rappels Web Push (`worker/`, Cloudflare Workers) : abonnement,
  désabonnement et notification de test, protégés par un jeton secret par
  installation, clés VAPID en secrets. Code livré, **non déployé**.
- Page temporaire `push-test.html` pour valider le Web Push sur un vrai
  téléphone dès J1 (à retirer au jalon J7).

### Vérifications

- `npm run verify` : typecheck, lint, tests, build et poids gzip au vert.
- Web Push sur téléphone réel : **à faire par Moussa au jalon J1** (voir
  `worker/README.md`, section « Test minimal »).

## [0.1.0] — J1 Données et domaine — 2026-10-18

### Ajouté

- Base IndexedDB versionnée (Dexie) et schéma Zod : blocs, catégories,
  tâches, modèles, exceptions d'occurrence et réglages.
- Six dépôts : blocs, catégories, tâches, modèles, réglages et vue de journée
  (`dayView`).
- `dayView` : calcul des occurrences des récurrences, application des
  exceptions (Override) et découpe des blocs qui franchissent minuit.
- Modules purs : `time` (minutes, clés de date), `recurrence` (types et
  occurrences) et `day` (statut d'affichage d'un bloc).
- Tests sur une IndexedDB en mémoire (`fake-indexeddb`) et sur les modules du
  domaine.

### Vérifications

- `npm run verify` : typecheck, lint, tests (couverture du domaine ≥ 90 %),
  build et poids gzip au vert.

## [0.1.0] — J2 Écran Aujourd'hui — 2026-10-19

### Ajouté

- Écran « Aujourd'hui » : timeline verticale (placement automatique en
  colonnes), anneau de progression (5 h–23 h), bandeau « journée entière » et
  carte « prochain bloc » avec compte à rebours rafraîchi à la minute.
- Feuille de création et d'édition d'un bloc : titre, catégorie, heure de
  début et de fin (`input type="time"` natif), durées rapides, notes et
  journée entière.
- Suppression avec annulation différée (6 s) et barre « Annuler ».
- Store Zustand de la timeline : date affichée, heure courante, brouillon,
  suppression différée et révision de rechargement.
- Routage par hash unifié `#/jour/AAAA-MM-JJ` (plus `#/taches`, `#/modeles`,
  `#/reglages`).
- Tests du placement en colonnes, des conversions px/min et du store.

### Vérifications

- `npm run verify` : typecheck, lint, tests, build et poids gzip au vert.

## À venir

- Suite de J2 : gestes de manipulation des blocs (déplacement,
  redimensionnement), molette d'heure et glissement horizontal entre les jours.
- Jalons suivants du cahier des charges (tâches, modèles, réglages).
