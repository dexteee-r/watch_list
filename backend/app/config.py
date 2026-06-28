"""Configuration applicative, lue depuis l'environnement / un fichier .env.

Les valeurs par défaut visent le développement local (Postgres dockerisé sur
localhost:5432). En production, tout est surchargé via les variables d'env du
conteneur (cf .env.example).
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # DSN SQLAlchemy async (driver asyncpg).
    database_url: str = "postgresql+asyncpg://watchlist:watchlist@localhost:5432/watchlist"

    # --- Authentification (JWT) ---
    # ⚠️ EN PRODUCTION : surcharger jwt_secret par une valeur forte et secrète (env).
    jwt_secret: str = "dev-insecure-secret-change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # cookie SPA : 30 jours
    # Bearer (panneau admin « rester connecté ») : durée plus courte = moins de risque
    # si un token fuite (le panneau se reconnecte automatiquement à l'expiration).
    bearer_expire_minutes: int = 60 * 24 * 7  # 7 jours

    # Cookie de session (app principale, même origine).
    cookie_name: str = "watchlist_session"
    cookie_secure: bool = False  # True en prod (HTTPS)

    # Doc interactive (/api/docs + openapi.json) : OFF par défaut (sinon le schéma
    # d'API est public). À activer en dev via DOCS_ENABLED=true.
    docs_enabled: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
