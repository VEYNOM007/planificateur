# Planificateur

Application mobile-first installable (PWA) qui organise la journée sur une
timeline visuelle. Hors ligne d'abord, données stockées sur le téléphone,
aucun compte, aucun serveur applicatif.

## Prérequis

- Node.js 22 ou plus (LTS)
- npm 10 ou plus

## Développement

```bash
npm ci
npm run dev          # http://localhost:5173
npm run verify       # typecheck + lint + tests + build + poids gzip
```

## Scripts

| Script                  | Rôle                                                     |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | serveur de développement                                 |
| `npm run build`         | build de production dans `dist/`                         |
| `npm run preview`       | sert le build localement                                 |
| `npm run typecheck`     | `tsc -b`, zéro erreur exigée                             |
| `npm run lint`          | ESLint (config stricte, `any` et `@ts-ignore` interdits) |
| `npm run format`        | Prettier                                                 |
| `npm run test`          | tests unitaires Vitest                                   |
| `npm run test:coverage` | tests + couverture du domaine (≥ 90 %)                   |
| `npm run size`          | poids initial gzip, échoue au-delà de 200 ko             |
| `npm run verify`        | enchaîne tout ce qui doit passer avant un commit         |

## Déploiement gratuit (aucun nom de domaine)

Le chemin de base est configurable par la variable `VITE_BASE_PATH` (voir
`.env.example`) : indispensable pour GitHub Pages, qui sert l'application dans
un sous-dossier.

### GitHub Pages, en cinq étapes

1. Créer un dépôt **public** sur GitHub (le dépôt ne contient que du code,
   jamais de données personnelles).
2. Depuis ce dossier :
   ```bash
   git remote add origin https://github.com/<compte>/<depot>.git
   git push -u origin main
   ```
3. Dans le dépôt : **Settings → Pages → Build and deployment → Source :
   GitHub Actions**.
4. Chaque envoi sur `main` déclenche `.github/workflows/deploy.yml` : tests,
   build, publication. L'adresse obtenue est
   `https://<compte>.github.io/<depot>/`.
5. Ouvrir l'adresse sur le téléphone, puis installer l'application
   (Chrome : menu ⋮ → « Installer l'application »).

### Autres hébergeurs

- **Cloudflare Pages** : dépôt privé possible, `npm run build`, dossier `dist`.
- **Netlify** : glisser-déposer du dossier `dist`.

> **Point critique** : les données sont rattachées à l'adresse exacte du site.
> Choisir l'adresse définitive avant le premier usage et exporter les données
> avant tout changement d'hébergeur.

## Service de rappels (facultatif, V1)

Le dossier `worker/` contient le service Web Push (Cloudflare Workers). Voir
`worker/README.md` : secrets VAPID, jeton d'installation, procédure de test sur
téléphone réel. Ce service ne reçoit que l'heure et le titre des blocs.

## Documentation

- `ARCHITECTURE.md` : découpage en couches et règles techniques.
- `CHANGELOG.md` : historique par jalon.
- `Cahier des charges — Planificateur de journée PWA.md` : spécification de
  référence.
