"""Point d'entrée de l'API FastAPI.

Toutes les routes sont préfixées par `/api` : en production, le conteneur nginx
sert le SPA et reverse-proxy `/api/*` vers cette application (même origine, pas de CORS).
La doc interactive (/api/docs) n'est exposée que si DOCS_ENABLED=true (dev).
"""
import logging

from fastapi import FastAPI

from .config import get_settings
from .routers import admin, auth, health, shows

settings = get_settings()

# Logger applicatif (échecs d'auth, actions admin) → stdout = `docker logs`.
_log = logging.getLogger("watchlist")
if not _log.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    _log.addHandler(_handler)
    _log.setLevel(logging.INFO)
    _log.propagate = False

app = FastAPI(
    title="Watch List API",
    version="0.1.0",
    # Doc d'API désactivée en prod (sinon le schéma complet est public).
    docs_url="/api/docs" if settings.docs_enabled else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.docs_enabled else None,
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(shows.router, prefix="/api")


@app.get("/api")
def root() -> dict:
    return {"name": "watchlist-api", "version": "0.1.0", "status": "ok"}
