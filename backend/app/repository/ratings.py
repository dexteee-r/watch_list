"""Accès aux notes par saison (PRIVÉ, scopé par user_id)."""
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import SeasonRating


async def get_ratings(db: AsyncSession, user_id: int, show_id: int) -> list[dict]:
    stmt = (
        select(SeasonRating.season, SeasonRating.rating)
        .where(SeasonRating.user_id == user_id, SeasonRating.show_id == show_id)
        .order_by(SeasonRating.season)
    )
    return [{"season": s, "rating": r} for s, r in (await db.execute(stmt)).all()]


async def set_rating(db: AsyncSession, user_id: int, show_id: int, season: int, rating: int) -> None:
    """Upsert : crée la note ou met à jour celle existante (clé user+show+season)."""
    stmt = (
        insert(SeasonRating)
        .values(user_id=user_id, show_id=show_id, season=season, rating=rating)
        .on_conflict_do_update(
            index_elements=["user_id", "show_id", "season"],
            set_={"rating": rating, "updated_at": func.now()},
        )
    )
    await db.execute(stmt)


async def delete_rating(db: AsyncSession, user_id: int, show_id: int, season: int) -> None:
    await db.execute(
        delete(SeasonRating).where(
            SeasonRating.user_id == user_id,
            SeasonRating.show_id == show_id,
            SeasonRating.season == season,
        )
    )
