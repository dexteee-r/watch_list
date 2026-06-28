"""Routes d'authentification : login (cookie), token (Bearer), logout, me."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..ratelimit import _client_ip, auth_rate_limit
from ..repository import users as users_repo
from ..schemas import LoginRequest, TokenResponse, UserOut
from ..security import create_access_token, hash_password, verify_password

settings = get_settings()
logger = logging.getLogger("watchlist.security")
router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe invalide."
)

# Hash factice pour équilibrer le temps de réponse quand l'email n'existe pas
# (sinon le court-circuit révèle l'existence d'un compte par timing — CWE-208).
_DUMMY_HASH = hash_password("timing-equalizer-not-a-real-password")


async def _authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    user = await users_repo.get_by_email(db, email)
    if user is None:
        verify_password(_DUMMY_HASH, password)  # même coût argon2, anti-énumération
        return None
    if not verify_password(user.password_hash, password):
        return None
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(auth_rate_limit)])
async def login(
    creds: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    """App principale : pose un cookie de session httpOnly."""
    user = await _authenticate(db, creds.email, creds.password)
    if user is None:
        logger.warning("Login échoué : %s depuis %s", creds.email, _client_ip(request))
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
async def issue_token(
    creds: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """Panneau admin : renvoie le JWT en Bearer (durée plus courte que le cookie)."""
    user = await _authenticate(db, creds.email, creds.password)
    if user is None:
        logger.warning("Token échoué : %s depuis %s", creds.email, _client_ip(request))
        raise _INVALID
    token = create_access_token(user.id, expires_minutes=settings.bearer_expire_minutes)
    return TokenResponse(access_token=token)


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(settings.cookie_name, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user
