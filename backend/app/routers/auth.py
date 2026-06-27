"""Routes d'authentification : login (cookie), token (Bearer), logout, me."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..ratelimit import auth_rate_limit
from ..repository import users as users_repo
from ..schemas import LoginRequest, TokenResponse, UserOut
from ..security import create_access_token, verify_password

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe invalide."
)


async def _authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    user = await users_repo.get_by_email(db, email)
    if user is None or not verify_password(user.password_hash, password):
        return None
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(auth_rate_limit)])
async def login(creds: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)) -> User:
    """App principale : pose un cookie de session httpOnly."""
    user = await _authenticate(db, creds.email, creds.password)
    if user is None:
        raise _INVALID
    response.set_cookie(
        key=settings.cookie_name,
        value=create_access_token(user.id),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )
    return user


@router.post("/token", response_model=TokenResponse, dependencies=[Depends(auth_rate_limit)])
async def issue_token(creds: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Panneau admin : renvoie le JWT en Bearer (pas de cookie)."""
    user = await _authenticate(db, creds.email, creds.password)
    if user is None:
        raise _INVALID
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(settings.cookie_name, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user
