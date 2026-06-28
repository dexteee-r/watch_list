"""Lien statut ↔ épisodes (les deux sens) : Terminé coche tout, dernier épisode → Terminé."""
from tests.conftest import login_token

_DETAILS = {
    "id": 999, "name": "Done Show", "image": {}, "premiered": None,
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


async def _status(client, headers):
    return (await client.get("/api/shows/999", headers=headers)).json()["status"]


async def _watched_count(client, headers):
    return len((await client.get("/api/shows/999/progress", headers=headers)).json())


async def test_completing_marks_all_episodes(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "done1@example.com")
    assert await _watched_count(client, h) == 0
    r = await client.patch("/api/shows/999", json={"status": "completed"}, headers=h)
    assert r.status_code == 204
    assert await _watched_count(client, h) == 3  # tous cochés
    assert await _status(client, h) == "completed"


async def test_last_episode_autocompletes(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "done2@example.com")
    # coche 2 des 3 → pas encore terminé
    await client.post("/api/shows/999/progress", json={"season": 1, "episode": 1}, headers=h)
    await client.post("/api/shows/999/progress", json={"season": 1, "episode": 2}, headers=h)
    assert await _status(client, h) != "completed"
    # coche le dernier → passe en terminé
    await client.post("/api/shows/999/progress", json={"season": 2, "episode": 1}, headers=h)
    assert await _status(client, h) == "completed"


async def test_partial_progress_does_not_complete(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "done3@example.com")
    await client.post("/api/shows/999/progress", json={"season": 1, "episode": 1}, headers=h)
    assert await _status(client, h) != "completed"
