"""Routes de données : séries suivies + progression. Miroir des 9 fonctions du store front.

Le client (front) manipule les séries par leur `tvmaze_id` ; l'API mappe en interne
vers l'id du catalogue. Tout est scopé à l'utilisateur courant (isolation des données).
"""
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models import Show, User
from ..ratelimit import add_show_rate_limit
from ..repository import catalog, ratings as ratings_repo, tracking
from ..schemas import (
    AddShowRequest,
    MarkRequest,
    ProgressItem,
    QuickWatchOut,
    RatingItem,
    RatingUpdate,
    ShowOut,
    ShowUpdate,
)
from ..services import tvmaze

router = APIRouter(prefix="/shows", tags=["shows"])


def _show_out(
    show: Show, status_: str, added_at, watched: int = 0, started_at=None, finished_at=None
) -> ShowOut:
    return ShowOut(
        tvmaze_id=show.tvmaze_id,
        name=show.name,
        poster_url=show.poster_url,
        total_seasons=show.total_seasons,
        total_episodes=show.total_episodes,
        status=status_,
        added_at=added_at,
        started_at=started_at,
        finished_at=finished_at,
        watched=watched,
    )


async def _ensure_catalog(db: AsyncSession, tvmaze_id: int) -> Show:
    """Renvoie la série du catalogue ; la récupère depuis TVmaze + stocke si absente."""
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    if show is not None:
        return show
    try:
        details, episodes = await tvmaze.fetch_show_and_episodes(tvmaze_id)
    except httpx.HTTPStatusError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Série introuvable sur TVmaze.")
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "TVmaze est injoignable, réessaie.")

    episode_payloads = tvmaze.build_episode_payloads(episodes)
    total_episodes = len(episode_payloads)
    total_seasons = max((p["season"] for p in episode_payloads), default=0)
    show_payload = tvmaze.build_show_payload(details, total_seasons, total_episodes)

    show_id = await catalog.insert_show(db, show_payload)
    await catalog.insert_episodes(db, show_id, episode_payloads)
    return await catalog.get_show_by_id(db, show_id)


@router.get("", response_model=list[ShowOut])
async def list_shows(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[ShowOut]:
    rows = await tracking.list_with_watched(db, user.id)
    return [
        _show_out(show, st, at, watched, started, finished)
        for show, st, at, started, finished, watched in rows
    ]


@router.get("/{tvmaze_id}", response_model=ShowOut)
async def get_show(
    tvmaze_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> ShowOut:
    row = await tracking.get_by_tvmaze(db, user.id, tvmaze_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Série non suivie.")
    show, st, at, started, finished = row
    watched = await tracking.count_watched(db, user.id, show.id)
    return _show_out(show, st, at, watched, started, finished)


@router.post(
    "",
    response_model=ShowOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(add_show_rate_limit)],
)
async def add_show(
    payload: AddShowRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShowOut:
    show = await _ensure_catalog(db, payload.tvmaze_id)
    existing = await tracking.get_user_show(db, user.id, show.id)
    if existing is not None:  # idempotent : déjà suivie
        watched = await tracking.count_watched(db, user.id, show.id)
        return _show_out(
            show, existing.status, existing.added_at, watched,
            existing.started_at, existing.finished_at,
        )
    user_show = await tracking.create_user_show(db, user.id, show.id, payload.status)
    await db.commit()
    return _show_out(
        show, user_show.status, user_show.added_at, 0,
        user_show.started_at, user_show.finished_at,
    )


@router.delete("/{tvmaze_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_show(
    tvmaze_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    if show is None:
        return  # idempotent
    await tracking.delete_user_show(db, user.id, show.id)
    await db.commit()


async def _apply_progress_side_effects(db: AsyncSession, user_id: int, show_id: int, user_show) -> None:
    """Après (dé)cochage : renseigne `started_at` au 1er épisode vu, et passe en
    'completed' (+ `finished_at`) quand tous les épisodes sont vus."""
    now = datetime.now(timezone.utc)
    watched = await tracking.count_watched(db, user_id, show_id)
    if watched > 0 and user_show.started_at is None:
        user_show.started_at = now
    total = await tracking.count_episodes(db, show_id)
    if total and watched >= total and user_show.status != "completed":
        user_show.status = "completed"
        if user_show.finished_at is None:
            user_show.finished_at = now


@router.patch("/{tvmaze_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_show(
    tvmaze_id: int,
    payload: ShowUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    user_show = await tracking.get_user_show(db, user.id, show.id) if show else None
    if user_show is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Série non suivie.")

    fields = payload.model_fields_set
    now = datetime.now(timezone.utc)

    if "status" in fields and payload.status is not None:
        user_show.status = payload.status
        if payload.status == "completed":
            # Lien statut → épisodes : coche tout + renseigne les dates si absentes.
            await tracking.mark_all_watched(db, user.id, show.id)
            if user_show.started_at is None:
                user_show.started_at = now
            if user_show.finished_at is None:
                user_show.finished_at = now
        else:
            # Quitter 'completed' efface la date de fin (devenue caduque).
            user_show.finished_at = None

    # Édition manuelle des dates (prioritaire sur l'auto si fournie dans la même requête).
    if "started_at" in fields:
        user_show.started_at = payload.started_at
    if "finished_at" in fields:
        user_show.finished_at = payload.finished_at

    await db.commit()


@router.get("/{tvmaze_id}/progress", response_model=list[ProgressItem])
async def get_progress(
    tvmaze_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[dict]:
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    if show is None:
        return []
    return await tracking.get_progress(db, user.id, show.id)


@router.post("/{tvmaze_id}/progress", status_code=status.HTTP_204_NO_CONTENT)
async def mark_watched(
    tvmaze_id: int,
    payload: MarkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    if show is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Série non suivie.")
    episode = await tracking.find_episode(db, show.id, payload.season, payload.episode)
    if episode is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Épisode inconnu pour cette série.")
    await tracking.mark_watched(db, user.id, episode.id)
    # Renseigne started_at au 1er épisode + passe en 'completed' si tous vus.
    user_show = await tracking.get_user_show(db, user.id, show.id)
    if user_show is not None:
        await _apply_progress_side_effects(db, user.id, show.id, user_show)
    await db.commit()


@router.post("/{tvmaze_id}/progress/next", response_model=QuickWatchOut)
async def watch_next(
    tvmaze_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> QuickWatchOut:
    """« +1 » : marque le prochain épisode non vu (sans ouvrir la fiche)."""
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    user_show = await tracking.get_user_show(db, user.id, show.id) if show else None
    if user_show is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Série non suivie.")
    episode = await tracking.find_next_unwatched(db, user.id, show.id)
    if episode is not None:
        await tracking.mark_watched(db, user.id, episode.id)
        await _apply_progress_side_effects(db, user.id, show.id, user_show)
        await db.commit()
    watched = await tracking.count_watched(db, user.id, show.id)
    total = await tracking.count_episodes(db, show.id)
    return QuickWatchOut(
        watched=watched,
        total=total,
        season=episode.season if episode else None,
        episode=episode.number if episode else None,
    )


@router.delete(
    "/{tvmaze_id}/progress/{season}/{episode}", status_code=status.HTTP_204_NO_CONTENT
)
async def unmark_watched(
    tvmaze_id: int,
    season: int,
    episode: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    if show is None:
        return
    episode_row = await tracking.find_episode(db, show.id, season, episode)
    if episode_row is None:
        return
    await tracking.unmark_watched(db, user.id, episode_row.id)
    await db.commit()


# --- Notes par saison ------------------------------------------------------


@router.get("/{tvmaze_id}/ratings", response_model=list[RatingItem])
async def list_ratings(
    tvmaze_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[dict]:
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    if show is None:
        return []
    return await ratings_repo.get_ratings(db, user.id, show.id)


@router.put("/{tvmaze_id}/ratings/{season}", response_model=RatingItem)
async def set_rating(
    tvmaze_id: int,
    season: int,
    payload: RatingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RatingItem:
    if season < 1:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Saison invalide.")
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    if show is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Série introuvable.")
    await ratings_repo.set_rating(db, user.id, show.id, season, payload.rating)
    await db.commit()
    return RatingItem(season=season, rating=payload.rating)


@router.delete("/{tvmaze_id}/ratings/{season}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rating(
    tvmaze_id: int,
    season: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    show = await catalog.get_show_by_tvmaze(db, tvmaze_id)
    if show is None:
        return
    await ratings_repo.delete_rating(db, user.id, show.id, season)
    await db.commit()
