"""Point d'entrée de l'API FastAPI.

Toutes les routes sont préfixées par `/api` : en production, le conteneur nginx
sert le SPA et reverse-proxy `/api/*` vers cette application (même origine, pas de CORS).
La doc interactive est exposée sur `/api/docs`.
"""
from fastapi import FastAPI

from .routers import admin, auth, health, shows

app = FastAPI(
    title="Watchlist API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(shows.router, prefix="/api")


@app.get("/api")
def root() -> dict:
    return {"name": "watchlist-api", "version": "0.1.0", "status": "ok"}
