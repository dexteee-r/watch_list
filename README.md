# 📺 Series Tracker

Application web **locale** pour suivre l'avancement de tes séries TV. Tu coches
les épisodes au fur et à mesure que tu les regardes. Tout est stocké sur ta
machine — aucun compte, aucune clé API, aucun serveur.

## Caractéristiques

- 🧭 **Découvrir** : page d'accueil listant les séries populaires
- 🔍 **Recherche** de séries (via l'API publique [TVmaze](https://www.tvmaze.com/api))
- ➕ **Ajout** à ta liste avec un statut (En cours / Terminé / Abandonné / À voir)
- ✅ **Suivi des épisodes** : grille saison × épisode cliquable
- 📊 **Progression** par série (X/Y épisodes, %)
- 🗂️ **Filtre** par statut
- 💾 **Export / Import JSON** pour sauvegarder ou transférer tes données vers une autre machine
- 🔒 **100 % local** : données dans IndexedDB (navigateur), aucune info personnelle requise

## Stack

- React + Vite (SPA, sans backend)
- IndexedDB via [Dexie](https://dexie.org/) (aucun module natif à compiler)
- TailwindCSS v4 — thème sombre « cinéma », accent ambre unique
- [Framer Motion](https://www.framer.com/motion/) (animations, respecte `prefers-reduced-motion`)
- [Phosphor Icons](https://phosphoricons.com/) + police Outfit (bundlée localement, sans CDN)
- API TVmaze (appelée directement depuis le navigateur)

## Installation

Prérequis : [Node.js](https://nodejs.org/) 18+.

```bash
git clone <url-du-repo>
cd "watch list serie tv"
npm install
npm run dev
```

Ouvre ensuite **http://localhost:5173**.

> Aucune configuration, aucune clé API, aucune compilation native : un simple
> `npm install` suffit.

## Scripts

| Commande          | Description                                  |
|-------------------|----------------------------------------------|
| `npm run dev`     | Serveur de développement (port 5173, HMR)    |
| `npm run build`   | Build de production → dossier `dist/`         |
| `npm run preview` | Sert le build de production (port 4173)       |
| `npm run lint`    | Vérifie le code avec ESLint                   |

## Sauvegarde & portabilité

Tes données vivent dans IndexedDB, propre au navigateur de cette machine.
Pour les sauvegarder ou les déplacer :

1. Clique **Exporter** (en haut à droite) → un fichier `.json` est téléchargé.
2. Sur une autre machine / un autre navigateur, clique **Importer** et
   sélectionne ce fichier. ⚠️ L'import **remplace** les données actuelles.

## Structure

```
src/
├── api/tvmaze.js        # appels à l'API TVmaze
├── db/
│   ├── store.js         # données locales (Dexie) : séries + progression
│   └── backup.js        # export / import JSON
├── components/          # SearchBar, ShowCard, DiscoverCard, EpisodeGrid, ProgressBar, BackupControls, Skeleton
├── motion.js            # tokens d'animation partagés (easing, variants)
├── pages/               # Discover (/), WatchList (/watchlist), ShowDetail (/show/:id)
├── labels.js            # libellés FR des statuts
└── App.jsx              # routeur + header
```

## Remarques

- Les métadonnées TVmaze (titres d'épisodes, résumés) sont principalement en **anglais**.
- Aucune donnée n'est envoyée à un serveur tiers, hormis les requêtes de
  recherche/lecture vers l'API publique TVmaze.
