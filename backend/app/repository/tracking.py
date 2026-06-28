"""Accès aux données PRIVÉES de suivi (user_shows + episode_watches).

Toutes les fonctions sont scopées par `user_id` : c'est ici que se fait l'isolation
des données entre utilisateurs (l'équivalent de la RLS Supabase, au niveau applicatif).
"""
from sqlalchemy import delete, func, literal, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Episode, EpisodeWatch, Show, UserShow


async def list_with_watched(db: AsyncSession, user_id: int) -> list[tuple]:
    """(Show, status, added_at, started_at, finished_at, watched_count) par série suivie.
    2 requêtes, pas de N+1."""
    shows_stmt = (
        select(
            Show,
            UserShow.status,
            UserShow.added_at,
            UserShow.started_at,
            UserShow.finished_at,
        )
        .join(UserShow, UserShow.show_id == Show.id)
        .where(UserShow.user_id == user_id)
        .order_by(UserShow.added_at.desc())
    )
    rows = (await db.execute(shows_stmt)).all()

    counts_stmt = (
        select(Episode.show_id, func.count())
        .join(EpisodeWatch, EpisodeWatch.episode_id == Episode.id)
        .where(EpisodeWatch.user_id == user_id)
        .group_by(Episode.show_id)
    )
    counts = dict((await db.execute(counts_stmt)).all())

    return [
        (show, status, added_at, started_at, finished_at, counts.get(show.id, 0))
        for show, status, added_at, started_at, finished_at in rows
    ]


async def get_by_tvmaze(db: AsyncSession, user_id: int, tvmaze_id: int):
    """Row (Show, status, added_at, started_at, finished_at) de la série suivie, ou None."""
    stmt = (
        select(
            Show,
            UserShow.status,
            UserShow.added_at,
            UserShow.started_at,
            UserShow.finished_at,
        )
        .join(UserShow, UserShow.show_id == Show.id)
        .where(UserShow.user_id == user_id, Show.tvmaze_id == tvmaze_id)
    )
    return (await db.execute(stmt)).first()


async def get_user_show(db: AsyncSession, user_id: int, show_id: int) -> UserShow | None:
    stmt = select(UserShow).where(UserShow.user_id == user_id, UserShow.show_id == show_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_user_show(
    db: AsyncSession, user_id: int, show_id: int, status: str
) -> UserShow:
    user_show = UserShow(user_id=user_id, show_id=show_id, status=status)
    db.add(user_show)
    await db.flush()
    await db.refresh(user_show)  # charge added_at (server_default)
    return user_show


async def delete_user_show(db: AsyncSession, user_id: int, show_id: int) -> None:
    # supprime d'abord les épisodes vus PAR CET utilisateur pour cette série
    episode_ids = select(Episode.id).where(Episode.show_id == show_id)
    await db.execute(
        delete(EpisodeWatch).where(
            EpisodeWatch.user_id == user_id, EpisodeWatch.episode_id.in_(episode_ids)
        )
    )
    await db.execute(
        delete(UserShow).where(UserShow.user_id == user_id, UserShow.show_id == show_id)
    )


async def count_watched(db: AsyncSession, user_id: int, show_id: int) -> int:
    stmt = (
        select(func.count())
        .select_from(EpisodeWatch)
        .join(Episode, Episode.id == EpisodeWatch.episode_id)
        .where(EpisodeWatch.user_id == user_id, Episode.show_id == show_id)
    )
    return (await db.execute(stmt)).scalar_one()


async def get_progress(db: AsyncSession, user_id: int, show_id: int) -> list[dict]:
    stmt = (
        select(Episode.season, Episode.number)
        .join(EpisodeWatch, EpisodeWatch.episode_id == Episode.id)
        .where(EpisodeWatch.user_id == user_id, Episode.show_id == show_id)
    )
    return [{"season": s, "episode": n} for s, n in (await db.execute(stmt)).all()]


async def find_episode(
    db: AsyncSession, show_id: int, season: int, number: int
) -> Episode | None:
    stmt = select(Episode).where(
        Episode.show_id == show_id, Episode.season == season, Episode.number == number
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def mark_watched(db: AsyncSession, user_id: int, episode_id: int) -> None:
    stmt = (
        insert(EpisodeWatch)
        .values(user_id=user_id, episode_id=episode_id)
        .on_conflict_do_nothing(index_elements=["user_id", "episode_id"])
    )
    await db.execute(stmt)


async def unmark_watched(db: AsyncSession, user_id: int, episode_id: int) -> None:
    await db.execute(
        delete(EpisodeWatch).where(
            EpisodeWatch.user_id == user_id, EpisodeWatch.episode_id == episode_id
        )
    )


async def count_episodes(db: AsyncSession, show_id: int) -> int:
    """Nombre total d'épisodes au catalogue pour une série."""
    stmt = select(func.count()).select_from(Episode).where(Episode.show_id == show_id)
    return (await db.execute(stmt)).scalar_one()


async def mark_all_watched(db: AsyncSession, user_id: int, show_id: int) -> None:
    """Marque vus TOUS les épisodes de la série pour l'utilisateur (idempotent)."""
    stmt = (
        insert(EpisodeWatch)
        .from_select(
            ["user_id", "episode_id"],
            select(literal(user_id), Episode.id).where(Episode.show_id == show_id),
        )
        .on_conflict_do_nothing(index_elements=["user_id", "episode_id"])
    )
    await db.execute(stmt)
