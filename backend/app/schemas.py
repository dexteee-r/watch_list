"""Schémas Pydantic d'entrée/sortie (validation + sérialisation HTTP)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from .models import STATUSES


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _validate_status(value: str) -> str:
    if value not in STATUSES:
        raise ValueError(f"Statut invalide (attendu : {', '.join(STATUSES)}).")
    return value


MIN_PASSWORD_LENGTH = 8


def _validate_optional_password(value: str | None) -> str | None:
    """Mot de passe choisi par l'admin. Vide/None → None (= généré côté serveur)."""
    if value is None or value == "":
        return None
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Le mot de passe doit faire au moins {MIN_PASSWORD_LENGTH} caractères.")
    return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return _normalize_email(v)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    is_admin: bool
    display_name: str | None = None
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    is_admin: bool = False
    display_name: str | None = None
    password: str | None = None  # None/"" → mot de passe généré côté serveur

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return _normalize_email(v)

    @field_validator("password")
    @classmethod
    def _pwd(cls, v: str | None) -> str | None:
        return _validate_optional_password(v)


class PasswordResetRequest(BaseModel):
    password: str | None = None  # None/"" → mot de passe généré côté serveur

    @field_validator("password")
    @classmethod
    def _pwd(cls, v: str | None) -> str | None:
        return _validate_optional_password(v)


class UserCreatedOut(BaseModel):
    """Renvoyé à la création : le mot de passe généré, montré UNE seule fois."""

    user: UserOut
    generated_password: str


class PasswordResetOut(BaseModel):
    user_id: int
    generated_password: str


# --- Données (séries / progression) ---


class ShowOut(BaseModel):
    """Série suivie par l'utilisateur (métadonnées catalogue + état perso + n° vus)."""

    tvmaze_id: int
    name: str
    poster_url: str | None = None
    total_seasons: int | None = None
    total_episodes: int | None = None
    status: str
    added_at: datetime
    watched: int = 0


class AddShowRequest(BaseModel):
    tvmaze_id: int
    status: str = "plan_to_watch"

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        return _validate_status(v)


class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        return _validate_status(v)


class ProgressItem(BaseModel):
    season: int
    episode: int


class MarkRequest(BaseModel):
    season: int
    episode: int
