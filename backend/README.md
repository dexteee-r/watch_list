# Backend — Watchlist API (FastAPI)

API d'authentification et de données pour le tracker de séries. Isolation des
données par `user_id` au niveau de l'API. Source de données séries = TVmaze
(appelée côté front, pas ici).

## Dév local

Prérequis : Python 3.13+ et Docker.

```bash
# 1. Lancer PostgreSQL (depuis la racine du repo)
docker compose up -d db

# 2. Environnement Python (depuis backend/)
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows PowerShell : .venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 3. Lancer l'API en rechargement auto
uvicorn app.main:app --reload --port 8000
```

- Santé : http://localhost:8000/api/health → `{"status":"ok","database":"up"}`
- Doc interactive : http://localhost:8000/api/docs

La configuration se fait par variables d'env (cf `.env.example`) ; les valeurs par
défaut pointent sur le Postgres dockerisé local, donc aucun `.env` n'est requis pour démarrer.

## Structure

```
app/
├── main.py            point d'entrée FastAPI (routes préfixées /api)
├── config.py          réglages (pydantic-settings)
├── db.py              moteur + session SQLAlchemy async, dépendance get_db
├── models.py          modèles ORM            (Phase 11.2)
├── schemas.py         schémas Pydantic        (Phase 11.4)
├── security.py        hash mdp + JWT          (Phase 11.3)
└── routers/
    └── health.py      GET /api/health
```
