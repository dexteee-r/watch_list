"""Dates de visionnage : auto (1er épisode → started, completed → finished) + édition manuelle."""
from tests.conftest import login_token

_DETAILS = {
    "id": 999, "name": "Date Show", "image": {}, "premiered": None,
    "ended": None, "status": "Ended", "genres": [], "summary": None,
}
_EPISODES = [
    {"id": 1, "season": 1, "number": 1, "name": "E1", "airdate": None, "runtime": None},
    {"id": 2, "season": 2, "number": 1, "name": "S2E1", "airdate": None, "runtime": None},
]


async def _setup(client, make_user, monkeypatch, email):
    async def fake(tid):
        return _DETAILS, _EPISODES

    monkeypatch.setattr("app.routers.shows.tvmaze.fetch_show_and_episodes", fake)
    headers = await login_token(client, await make_user(email=email))
    await client.post("/api/shows", json={"tvmaze_id": 999}, headers=headers)
    return headers


async def _show(client, headers):
    return (await client.get("/api/shows/999", headers=headers)).json()


async def test_started_at_set_on_first_episode(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "d1@example.com")
    assert (await _show(client, h))["started_at"] is None
    await client.post("/api/shows/999/progress", json={"season": 1, "episode": 1}, headers=h)
    s = await _show(client, h)
    assert s["started_at"] is not None
    assert s["finished_at"] is None  # pas encore terminé (1/2)


async def test_finished_at_set_on_complete_status(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "d2@example.com")
    await client.patch("/api/shows/999", json={"status": "completed"}, headers=h)
    s = await _show(client, h)
    assert s["started_at"] is not None
    assert s["finished_at"] is not None


async def test_finished_at_set_when_last_episode_watched(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "d3@example.com")
    await client.post("/api/shows/999/progress", json={"season": 1, "episode": 1}, headers=h)
    assert (await _show(client, h))["finished_at"] is None
    await client.post("/api/shows/999/progress", json={"season": 2, "episode": 1}, headers=h)
    assert (await _show(client, h))["finished_at"] is not None


async def test_leaving_completed_clears_finished(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "d4@example.com")
    await client.patch("/api/shows/999", json={"status": "completed"}, headers=h)
    assert (await _show(client, h))["finished_at"] is not None
    await client.patch("/api/shows/999", json={"status": "watching"}, headers=h)
    assert (await _show(client, h))["finished_at"] is None


async def test_manual_date_edit_and_clear(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch, "d5@example.com")
    # définir une date manuelle
    await client.patch(
        "/api/shows/999", json={"started_at": "2020-03-15T00:00:00Z"}, headers=h
    )
    assert (await _show(client, h))["started_at"].startswith("2020-03-15")
    # effacer (null)
    await client.patch("/api/shows/999", json={"started_at": None}, headers=h)
    assert (await _show(client, h))["started_at"] is None
