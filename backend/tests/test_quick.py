"""« +1 épisode » : marque le prochain non vu, dans l'ordre, jusqu'à complétion."""
from tests.conftest import login_token

_DETAILS = {
    "id": 999, "name": "Quick Show", "image": {}, "premiered": None,
    "ended": None, "status": "Ended", "genres": [], "summary": None,
}
_EPISODES = [
    {"id": 1, "season": 1, "number": 1, "name": "E1", "airdate": None, "runtime": None},
    {"id": 2, "season": 1, "number": 2, "name": "E2", "airdate": None, "runtime": None},
    {"id": 3, "season": 2, "number": 1, "name": "S2E1", "airdate": None, "runtime": None},
]


async def _setup(client, make_user, monkeypatch, email):
    async def fake(tid):
        return _DETAILS, _EPISODES

    monkeypatch.setattr("app.routers.shows.tvmaze.fetch_show_and_episodes", fake)
    headers = await login_token(client, await make_user(email=email))
    await client.post("/api/shows", json={"tvmaze_id": 999}, headers=headers)
    return headers


async def test_watch_next_requires_auth(client):
    assert (await client.post("/api/shows/999/progress/next")).status_code == 401


async def test_watch_next_unknown_or_untracked_404(client, make_user):
    h = await login_token(client, await make_user(email="q0@example.com"))
    assert (await client.post("/api/shows/123456/progress/next", headers=h)).status_code == 404


async def test_watch_next_progresses_in_order(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "q1@example.com")

    r1 = (await client.post("/api/shows/999/progress/next", headers=h)).json()
    assert (r1["season"], r1["episode"], r1["watched"], r1["total"]) == (1, 1, 1, 3)

    r2 = (await client.post("/api/shows/999/progress/next", headers=h)).json()
    assert (r2["season"], r2["episode"], r2["watched"]) == (1, 2, 2)

    r3 = (await client.post("/api/shows/999/progress/next", headers=h)).json()
    assert (r3["season"], r3["episode"], r3["watched"]) == (2, 1, 3)
    # tout vu → série auto-terminée
    assert (await client.get("/api/shows/999", headers=h)).json()["status"] == "completed"

    # plus rien à marquer
    r4 = (await client.post("/api/shows/999/progress/next", headers=h)).json()
    assert r4["season"] is None and r4["episode"] is None and r4["watched"] == 3


async def test_watch_next_sets_started_at(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "q2@example.com")
    assert (await client.get("/api/shows/999", headers=h)).json()["started_at"] is None
    await client.post("/api/shows/999/progress/next", headers=h)
    assert (await client.get("/api/shows/999", headers=h)).json()["started_at"] is not None
