from tests.conftest import login_token


async def test_login_invalid_credentials(client):
    r = await client.post(
        "/api/auth/token", json={"email": "nobody@example.com", "password": "x"}
    )
    assert r.status_code == 401


async def test_login_and_me(client, make_user):
    user = await make_user(email="me@example.com")
    headers = await login_token(client, user)
    r = await client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "me@example.com"


async def test_login_sets_httponly_cookie(client, make_user):
    user = await make_user(email="cookie@example.com")
    r = await client.post(
        "/api/auth/login", json={"email": user["email"], "password": user["password"]}
    )
    assert r.status_code == 200
    set_cookie = r.headers.get("set-cookie", "")
    assert "watchlist_session=" in set_cookie
    assert "HttpOnly" in set_cookie


async def test_me_requires_auth(client):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


async def test_auth_rate_limit(client, make_user):
    user = await make_user(email="bruteforce@example.com")
    codes = []
    for _ in range(12):
        r = await client.post(
            "/api/auth/token", json={"email": user["email"], "password": "wrong"}
        )
        codes.append(r.status_code)
    # 10 tentatives passent (et échouent en 401), puis la limite déclenche un 429.
    assert codes[:10] == [401] * 10
    assert codes[10:] == [429, 429]
