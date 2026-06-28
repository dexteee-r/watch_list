"""Routes d'administration des comptes. TOUTES protégées par `is_admin` (côté serveur)."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import require_admin
from ..models import User
from ..repository import users as users_repo
from ..schemas import (
    PasswordResetOut,
    PasswordResetRequest,
    UserCreate,
    UserCreatedOut,
    UserOut,
)
from ..security import generate_password, hash_password

logger = logging.getLogger("watchlist.security")
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/users", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db)) -> list[User]:
    return await users_repo.list_all(db)


@router.post("/users", response_model=UserCreatedOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserCreatedOut:
    if await users_repo.get_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Un compte avec cet email existe déjà."
        )
    # Mot de passe choisi par l'admin si fourni, sinon généré.
    password = payload.password or generate_password()
    user = await users_repo.create(
        db, payload.email, hash_password(password), payload.is_admin, payload.display_name
    )
    await db.commit()
    await db.refresh(user)
    logger.info("Admin %s a créé le compte %s (admin=%s)", admin.email, user.email, user.is_admin)
    return UserCreatedOut(user=UserOut.model_validate(user), generated_password=password)


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetOut)
async def reset_password(
    user_id: int,
    payload: PasswordResetRequest = PasswordResetRequest(),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PasswordResetOut:
    user = await users_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte introuvable.")
    # Mot de passe choisi par l'admin si fourni, sinon généré.
    password = payload.password or generate_password()
    await users_repo.set_password(db, user, hash_password(password))
    await db.commit()
    logger.info("Admin %s a réinitialisé le mot de passe de %s", admin.email, user.email)
    return PasswordResetOut(user_id=user.id, generated_password=password)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await users_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte introuvable.")
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu ne peux pas supprimer ton propre compte admin.",
        )
    await users_repo.delete(db, user)
    await db.commit()
    logger.info("Admin %s a supprimé le compte %s", admin.email, user.email)
