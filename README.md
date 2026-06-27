# 📺 Series Tracker

Application web **auto-hébergée** pour suivre l'avancement de tes séries TV : tu
coches les épisodes au fil de tes visionnages. Multi-utilisateur (chacun sa liste
privée), comptes provisionnés par l'administrateur — **pas d'inscription publique**.

## Stack

- **Frontend** : React 19 + Vite (SPA), TailwindCSS v4 (thème sombre « cinéma », accent ambre),
  Framer Motion, Phosphor Icons, police Outfit (bundlée). Build statique servi par **nginx**.
- **Backend** : **FastAPI** (uvicorn), SQLAlchemy 2 async + asyncpg, Alembic (migrations),
  Pydantic v2. Auth **argon2** + **JWT** (cookie httpOnly pour l'app, Bearer pour l'admin),
  rate-limiting maison.
- **Base de données** : **PostgreSQL 17**.
- **Données séries** : API publique [TVmaze](https://www.tvmaze.com/api) (aucune clé) —
  interrogée côté serveur à l'ajout pour remplir le catalogue partagé.

## Architecture

Point d'entrée unique : nginx sert le SPA **et** relaie `/api` vers FastAPI (même
origine, pas de CORS). Seul `web:80` est publié ; la base n'est jamais exposée.

```
Navigateur → nginx:80 ──┬─ /      → SPA React statique (dist/)
                        └─ /api/  → FastAPI (uvicorn) → PostgreSQL 17
```

## Développement local

Prérequis : [Node.js](https://nodejs.org/) 22+, [Python](https://www.python.org/) 3.13,
[Docker](https://www.docker.com/).

```bash
# 1. PostgreSQL (conteneur de dev — l'override publie le port 5432)
docker compose up -d db

# 2. Backend (API sur :8000)
cd backend
python -m venv .venv && . .venv/Scripts/activate   # ou bin/activate (Linux/macOS)
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Frontend (SPA sur :5173, proxy /api → :8000)
cd ..
npm install
npm run dev
```

Crée un premier administrateur :

```bash
cd backend
python -m app.cli create-user --email toi@example.com --admin
```

> **`docker-compose.override.yml`** (non versionné) applique les réglages de dev :
> publication du port 5432 et `COOKIE_SECURE=false` (pour http://localhost). Il ne
> doit **jamais** être présent en production.

## Tests

```bash
# Backend (nécessite la base de dev lancée ; utilise une base watchlist_test dédiée)
cd backend
DATABASE_URL=postgresql+asyncpg://watchlist:watchlist@localhost:5432/watchlist_test pytest -q

# Frontend
npm run lint && npm run build
```

## Docker (stack complète)

```bash
cp .env.example .env   # puis renseigner POSTGRES_PASSWORD + JWT_SECRET (openssl rand -hex 32)
docker compose up -d --build
```

L'application est alors servie sur **http://localhost** (nginx). En production, seul
`docker-compose.yml` est utilisé (l'API applique les migrations Alembic au démarrage).

## CI / CD (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`) — à chaque push / PR : lint + build du front,
  migrations + `pytest` du backend (avec un PostgreSQL de service).
- **Déploiement** (`.github/workflows/deploy.yml`) — après un CI réussi sur `main` :
  un **runner self-hosted** (label `watchlist`, installé dans le homelab) fait
  `git reset --hard origin/main` puis `docker compose -f docker-compose.yml up -d --build`.
  Aucun port entrant exposé (le runner se connecte en sortant vers GitHub).

## Structure

```
├── src/                      # SPA React
│   ├── api/                  # store.js (fetch /api/…) + tvmaze.js
│   ├── auth/                 # AuthProvider, LoginPage, RequireAuth, contexte
│   ├── components/           # SearchBar, ShowCard, EpisodeGrid, ErrorBoundary, …
│   ├── pages/                # Discover (/), WatchList (/watchlist), ShowDetail (/show/:id)
│   └── App.jsx               # routeur + header (lazy routes)
├── backend/
│   ├── app/                  # main, routers/, repository/, services/, models, security, ratelimit
│   ├── alembic/              # migrations
│   └── tests/                # pytest (auth, rate-limit, flux données, isolation)
├── Dockerfile  nginx.conf    # conteneur web (build Vite → nginx + proxy /api)
├── docker-compose.yml        # stack prod (web + api + db)
└── .github/workflows/        # ci.yml + deploy.yml
```

## Remarques

- Les métadonnées TVmaze (titres d'épisodes, résumés) sont principalement en **anglais**.
- L'isolation des données repose sur un filtrage `WHERE user_id` au niveau de l'API.
