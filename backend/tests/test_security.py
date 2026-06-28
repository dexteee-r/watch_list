"""Durcissement : docs API désactivées par défaut + Bearer plus court que le cookie."""
import jwt as pyjwt

from app.config import get_settings


async def test_docs_disabled_by_default(client):
    # DOCS_ENABLED non défini → /api/docs et openapi.json absents (404).
    assert (await client.get("/api/docs")).status_code == 404
    assert (await client.get("/api/openapi.json")).status_code == 404


async def test_bearer_token_shorter_than_cookie(client, make_user):
    settings = get_settings()
    user = await make_user(email="exp@example.com")

    bearer = (
        await client.post(
            "/api/auth/token", json={"email": user["email"], "password": user["password"]}
        )
    ).json()["access_token"]
    bearer_exp = pyjwt.decode(
        bearer, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )["exp"]

    resp = await client.post(
        "/api/auth/login", json={"email": user["email"], "password": user["password"]}
    )
    cookie = resp.cookies.get(settings.cookie_name)
    cookie_exp = pyjwt.decode(
        cookie, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )["exp"]

    # Le Bearer (panneau admin) expire avant le cookie (SPA).
    assert bearer_exp < cookie_exp


async def test_login_unknown_user_still_401(client):
    # La correction anti-timing (hash factice) ne change pas le comportement.
    r = await client.post(
        "/api/auth/token", json={"email": "ghost@example.com", "password": "whatever-123"}
    )
    assert r.status_code == 401
