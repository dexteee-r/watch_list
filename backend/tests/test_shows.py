"""Flux données : ajout (TVmaze mocké), progression, et isolation entre comptes."""
from tests.conftest import login_token

_FAKE_DETAILS = {
    "id": 999,
    "name": "Test Show",
    "image": {"medium": "http://example.com/poster.jpg"},
    "premiered": "2020-01-01",
    "ended": None,
    "status": "Running",
    "genres": ["Drama"],
    "summary": "<p>Une série de test.</p>",
}
# 3 épisodes réels (S1E1, S1E2, S2E1) + 1 special sans numéro (doit être ignoré).
_FAKE_EPISODES = [
    {"id": 11, "season": 1, "number": 1, "name": "E1", "airdate": "2020-01-01", "runtime": 30},
    {"id": 12, "season": 1, "number": 2, "name": "E2", "airdate": "2020-01-08", "runtime": 30},
    {"id": 13, "season": 2, "number": 1, "name": "S2E1", "airdate": "2021-01-01", "runtime": 30},
    {"id": 14, "season": 1, "number": None, "name": "Special", "airdate": None, "runtime": None},
]


def _mock_tvmaze(monkeypatch, details=_FAKE_DETAILS, episodes=_FAKE_EPISODES):
    async def fake_fetch(tvmaze_id):
        return details, episodes

    monkeypatch.setattr("app.routers.shows.tvmaze.fetch_show_and_episodes", fake_fetch)


async def test_shows_requires_auth(client):
    r = await client.get("/api/shows")
    assert r.status_code == 401


async def test_add_show_and_progress_flow(client, make_user, monkeypatch):
    _mock_tvmaze(monkeypatch)
    headers = await login_token(client, await make_user(email="flow@example.com"))

    # Ajout : le serveur "récupère" TVmaze (mocké) et remplit le catalogue.
    r = await client.post("/api/shows", json={"tvmaze_id": 999, "status": "plan_to_watch"}, headers=headers)
    assert r.status_code == 201
    body = r.json()
    assert body["tvmaze_id"] == 999
    assert body["total_episodes"] == 3  # le special sans numéro est ignoré
    assert body["total_seasons"] == 2

    # Idempotent : re-ajouter ne duplique pas.
    r = await client.post("/api/shows", json={"tvmaze_id": 999}, headers=headers)
    assert r.status_code == 201
    r = await client.get("/api/shows", headers=headers)
    assert len(r.json()) == 1

    # Marquer S1E1 vu.
    r = await client.post("/api/shows/999/progress", json={"season": 1, "episode": 1}, headers=headers)
    assert r.status_code == 204
    r = await client.get("/api/shows/999/progress", headers=headers)
    assert {"season": 1, "episode": 1} in r.json()

    # Démarquer.
    r = await client.delete("/api/shows/999/progress/1/1", headers=headers)
    assert r.status_code == 204
    r = await client.get("/api/shows/999/progress", headers=headers)
    assert r.json() == []


async def test_data_isolation_between_users(client, make_user, monkeypatch):
    _mock_tvmaze(monkeypatch)
    alice = await login_token(client, await make_user(email="alice@example.com"))
    bob = await login_token(client, await make_user(email="bob@example.com"))

    # Alice ajoute une série.
    await client.post("/api/shows", json={"tvmaze_id": 999}, headers=alice)

    # Alice la voit, Bob NON (isolation WHERE user_id au niveau API).
    assert len((await client.get("/api/shows", headers=alice)).json()) == 1
    assert len((await client.get("/api/shows", headers=bob)).json()) == 0
