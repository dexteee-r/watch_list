"""Accès données pour les comptes utilisateurs. Aucune logique HTTP ici.

Les fonctions opèrent dans une session fournie ; le commit est à la charge de l'appelant
(routeur ou CLI), pour garder le contrôle transactionnel au bon niveau.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def list_all(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at))
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    email: str,
    password_hash: str,
    is_admin: bool = False,
    display_name: str | None = None,
) -> User:
    user = User(
        email=email, password_hash=password_hash, is_admin=is_admin, display_name=display_name
    )
    db.add(user)
    await db.flush()  # peuple user.id sans committer
    return user


async def set_password(db: AsyncSession, user: User, password_hash: str) -> None:
    user.password_hash = password_hash
    await db.flush()


async def delete(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()
