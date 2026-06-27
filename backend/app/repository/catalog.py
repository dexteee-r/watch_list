"""Accès au catalogue PARTAGÉ (shows + episodes). Upserts idempotents."""
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Episode, Show


async def get_show_by_tvmaze(db: AsyncSession, tvmaze_id: int) -> Show | None:
    result = await db.execute(select(Show).where(Show.tvmaze_id == tvmaze_id))
    return result.scalar_one_or_none()


async def get_show_by_id(db: AsyncSession, show_id: int) -> Show | None:
    return await db.get(Show, show_id)


async def insert_show(db: AsyncSession, payload: dict) -> int:
    """Insère la série si absente, renvoie son id (idempotent sur tvmaze_id)."""
    stmt = (
        insert(Show)
        .values(**payload)
        .on_conflict_do_nothing(index_elements=["tvmaze_id"])
        .returning(Show.id)
    )
    show_id = (await db.execute(stmt)).scalar_one_or_none()
    if show_id is None:  # déjà présente (course concurrente) → relecture
        show_id = (
            await db.execute(select(Show.id).where(Show.tvmaze_id == payload["tvmaze_id"]))
        ).scalar_one()
    return show_id


async def insert_episodes(db: AsyncSession, show_id: int, payloads: list[dict]) -> None:
    if not payloads:
        return
    rows = [{**p, "show_id": show_id} for p in payloads]
    stmt = insert(Episode).values(rows).on_conflict_do_nothing(
        index_elements=["show_id", "season", "number"]
    )
    await db.execute(stmt)
