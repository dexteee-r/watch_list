"""Notes par saison : set/get/upsert/delete, validation 1-10, auth, série inconnue."""
from tests.conftest import login_token

_DETAILS = {
    "id": 999,
    "name": "Rate Show",
    "image": {},
    "premiered": None,
    "ended": None,
    "status": "Ended",
    "genres": [],
    "summary": None,
}
_EPISODES = [
    {"id": 1, "season": 1, "number": 1, "name": "E1", "airdate": None, "runtime": None},
    {"id": 2, "season": 2, "number": 1, "name": "S2E1", "airdate": None, "runtime": None},
]


async def _setup(client, make_user, monkeypatch, email="rate@example.com"):
    async def fake(tid):
        return _DETAILS, _EPISODES

    monkeypatch.setattr("app.routers.shows.tvmaze.fetch_show_and_episodes", fake)
    headers = await login_token(client, await make_user(email=email))
    await client.post("/api/shows", json={"tvmaze_id": 999}, headers=headers)
    return headers


async def test_ratings_requires_auth(client):
    assert (await client.get("/api/shows/999/ratings")).status_code == 401


async def test_set_get_upsert_delete(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch)
    assert (await client.get("/api/shows/999/ratings", headers=h)).json() == []

    r = await client.put("/api/shows/999/ratings/1", json={"rating": 8}, headers=h)
    assert r.status_code == 200 and r.json() == {"season": 1, "rating": 8}

    await client.put("/api/shows/999/ratings/2", json={"rating": 10}, headers=h)
    assert (await client.get("/api/shows/999/ratings", headers=h)).json() == [
        {"season": 1, "rating": 8},
        {"season": 2, "rating": 10},
    ]

    # upsert : met à jour sans dupliquer
    r = await client.put("/api/shows/999/ratings/1", json={"rating": 9}, headers=h)
    assert r.json()["rating"] == 9
    got = (await client.get("/api/shows/999/ratings", headers=h)).json()
    assert got == [{"season": 1, "rating": 9}, {"season": 2, "rating": 10}]

    assert (await client.delete("/api/shows/999/ratings/1", headers=h)).status_code == 204
    assert (await client.get("/api/shows/999/ratings", headers=h)).json() == [
        {"season": 2, "rating": 10}
    ]


async def test_rating_out_of_range_rejected(client, make_user, monkeypatch):
    h = await _setup(client, make_user, monkeypatch)
    assert (await client.put("/api/shows/999/ratings/1", json={"rating": 0}, headers=h)).status_code == 422
    assert (await client.put("/api/shows/999/ratings/1", json={"rating": 11}, headers=h)).status_code == 422


async def test_rating_unknown_show_404(client, make_user):
    h = await login_token(client, await make_user(email="norate@example.com"))
    r = await client.put("/api/shows/123456/ratings/1", json={"rating": 5}, headers=h)
    assert r.status_code == 404
