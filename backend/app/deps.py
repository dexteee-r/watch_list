"""Dépendances FastAPI d'authentification.

`get_current_user` accepte le JWT depuis l'en-tête `Authorization: Bearer ...`
(panneau admin) OU depuis le cookie de session (app principale) — un seul code, deux portes.
"""
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .db import get_db
from .models import User
from .repository import users as users_repo
from .security import decode_token

settings = get_settings()

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Non authentifié.",
    headers={"WWW-Authenticate": "Bearer"},
)


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(settings.cookie_name)


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = _extract_token(request)
    if not token:
        raise _CREDENTIALS_EXC
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:
        raise _CREDENTIALS_EXC from exc

    subject = payload.get("sub")
    if subject is None:
        raise _CREDENTIALS_EXC

    user = await users_repo.get_by_id(db, int(subject))
    if user is None:
        raise _CREDENTIALS_EXC
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé à l'administrateur."
        )
    return user
