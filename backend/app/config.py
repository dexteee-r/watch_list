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
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 jours (sessions non bornées côté usage)

    # Cookie de session (app principale, même origine).
    cookie_name: str = "watchlist_session"
    cookie_secure: bool = False  # True en prod (HTTPS)


@lru_cache
def get_settings() -> Settings:
    return Settings()
