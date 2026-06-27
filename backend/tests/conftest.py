"""Fixtures de test.

Le schéma est (re)créé via `Base.metadata.create_all` (idempotent), et chaque test
repart d'une base vide (toutes les tables sont vidées) + d'un rate-limiter remis à zéro.
La base de test est pilotée par `DATABASE_URL` (fournie par le service Postgres en CI,
ou une base locale dédiée en dev). On ne touche JAMAIS à TVmaze : les tests qui ajoutent
une série monkeypatchent `app.routers.shows.tvmaze.fetch_show_and_episodes`.
"""
import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Valeurs par défaut sûres si l'environnement ne les fournit pas (dev local).
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://watchlist:watchlist@localhost:5432/watchlist_test"
)
os.environ.setdefault("JWT_SECRET", "test-secret-at-least-32-bytes-long-000")

from app import ratelimit  # noqa: E402
from app.db import AsyncSessionLocal, Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.repository import users as users_repo  # noqa: E402
from app.security import hash_password  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def _fresh_db():
    """Avant chaque test : schéma garanti, tables vidées, rate-limiter réinitialisé."""
    ratelimit.auth_rate_limit._hits.clear()
    ratelimit.add_show_rate_limit._hits.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)  # idempotent (checkfirst)
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    yield
    # Libère le pool pour éviter les connexions liées à une boucle d'event précédente.
    await engine.dispose()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def make_user():
    """Crée un compte directement en base (contourne l'absence de signup public)."""

    async def _make(email="user@example.com", password="Test-Pass-1234", is_admin=False):
        async with AsyncSessionLocal() as db:
            user = await users_repo.create(
                db, email=email, password_hash=hash_password(password), is_admin=is_admin
            )
            await db.commit()
            return {"email": email, "password": password, "id": user.id}

    return _make


async def login_token(client, user):
    """Helper : récupère un JWT Bearer pour un utilisateur."""
    r = await client.post(
        "/api/auth/token", json={"email": user["email"], "password": user["password"]}
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
