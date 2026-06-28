"""Routes admin : création/reset de compte avec mot de passe choisi ou généré."""
from tests.conftest import login_token


async def _admin_headers(client, make_user):
    return await login_token(client, await make_user(email="root@example.com", is_admin=True))


async def test_create_user_with_custom_password(client, make_user):
    headers = await _admin_headers(client, make_user)
    chosen = "Mon-Mot-De-Passe-1"
    r = await client.post(
        "/api/admin/users",
        json={"email": "alice@example.com", "is_admin": False, "password": chosen},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["generated_password"] == chosen
    # Le compte peut se connecter avec le mot de passe choisi.
    login = await client.post(
        "/api/auth/token", json={"email": "alice@example.com", "password": chosen}
    )
    assert login.status_code == 200


async def test_create_user_generates_password_when_omitted(client, make_user):
    headers = await _admin_headers(client, make_user)
    r = await client.post(
        "/api/admin/users", json={"email": "bob@example.com"}, headers=headers
    )
    assert r.status_code == 201
    generated = r.json()["generated_password"]
    assert generated  # non vide
    login = await client.post(
        "/api/auth/token", json={"email": "bob@example.com", "password": generated}
    )
    assert login.status_code == 200


async def test_create_user_rejects_short_password(client, make_user):
    headers = await _admin_headers(client, make_user)
    r = await client.post(
        "/api/admin/users",
        json={"email": "carol@example.com", "password": "court"},
        headers=headers,
    )
    assert r.status_code == 422


async def test_reset_password_custom(client, make_user):
    headers = await _admin_headers(client, make_user)
    created = await client.post(
        "/api/admin/users", json={"email": "dave@example.com", "password": "Ancien-Pass-1"}, headers=headers
    )
    user_id = created.json()["user"]["id"]

    new_pwd = "Nouveau-Pass-2"
    r = await client.post(
        f"/api/admin/users/{user_id}/reset-password", json={"password": new_pwd}, headers=headers
    )
    assert r.status_code == 200
    assert r.json()["generated_password"] == new_pwd
    # Nouveau mot de passe OK, ancien refusé.
    assert (
        await client.post("/api/auth/token", json={"email": "dave@example.com", "password": new_pwd})
    ).status_code == 200
    assert (
        await client.post(
            "/api/auth/token", json={"email": "dave@example.com", "password": "Ancien-Pass-1"}
        )
    ).status_code == 401


async def test_reset_password_generated_when_omitted(client, make_user):
    headers = await _admin_headers(client, make_user)
    created = await client.post(
        "/api/admin/users", json={"email": "erin@example.com"}, headers=headers
    )
    user_id = created.json()["user"]["id"]
    r = await client.post(f"/api/admin/users/{user_id}/reset-password", headers=headers)
    assert r.status_code == 200
    assert r.json()["generated_password"]


async def test_admin_routes_require_admin(client, make_user):
    headers = await login_token(client, await make_user(email="notadmin@example.com"))
    r = await client.get("/api/admin/users", headers=headers)
    assert r.status_code == 403
