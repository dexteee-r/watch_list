"""Client TVmaze côté serveur (httpx) + transformation en payloads pour le catalogue.

C'est ici que le serveur devient la source autoritaire des métadonnées : à l'ajout
d'une série, on récupère détails + épisodes depuis TVmaze et on les stocke.
"""
from datetime import date

import httpx

_BASE = "https://api.tvmaze.com"


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


async def fetch_show_and_episodes(tvmaze_id: int) -> tuple[dict, list[dict]]:
    """Récupère (détails, épisodes) d'une série. Lève httpx.HTTPStatusError si 4xx/5xx."""
    async with httpx.AsyncClient(timeout=10) as client:
        show_resp = await client.get(f"{_BASE}/shows/{tvmaze_id}")
        show_resp.raise_for_status()
        eps_resp = await client.get(f"{_BASE}/shows/{tvmaze_id}/episodes")
        eps_resp.raise_for_status()
    return show_resp.json(), eps_resp.json()


def build_episode_payloads(episodes: list[dict]) -> list[dict]:
    """Épisodes → lignes catalogue. Ignore les specials sans numéro (clé = season+number)."""
    payloads = []
    for ep in episodes:
        number = ep.get("number")
        if number is None:
            continue
        payloads.append(
            {
                "tvmaze_episode_id": ep.get("id"),
                "season": ep.get("season"),
                "number": number,
                "name": ep.get("name"),
                "airdate": _parse_date(ep.get("airdate")),
                "runtime": ep.get("runtime"),
            }
        )
    return payloads


def build_show_payload(details: dict, total_seasons: int, total_episodes: int) -> dict:
    image = details.get("image") or {}
    return {
        "tvmaze_id": details["id"],
        "name": details["name"],
        "poster_url": image.get("medium"),
        "premiered": _parse_date(details.get("premiered")),
        "ended": _parse_date(details.get("ended")),
        "tvmaze_status": details.get("status"),
        "genres": details.get("genres") or [],
        "total_seasons": total_seasons,
        "total_episodes": total_episodes,
        "summary": details.get("summary"),
    }
