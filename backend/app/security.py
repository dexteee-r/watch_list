"""Primitives de sécurité : hash de mot de passe (argon2), JWT, génération de mot de passe.

Aucune dépendance à la base ni au transport HTTP — pur calcul, facile à tester.
"""
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error

from .config import get_settings

settings = get_settings()

_hasher = PasswordHasher()

# Alphabet sans caractères ambigus (I, l, O, 0, 1) pour les mots de passe générés.
_PWD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except Argon2Error:
        return False


def create_access_token(user_id: int, expires_minutes: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    minutes = expires_minutes if expires_minutes is not None else settings.jwt_expire_minutes
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Décode et valide un JWT. Lève une sous-classe de jwt.PyJWTError si invalide/expiré."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def generate_password(groups: int = 3, group_size: int = 4) -> str:
    """Mot de passe fort et lisible, ex. 'Kp9x-Qm4w-Vt7n' (~70 bits d'entropie)."""
    chunks = [
        "".join(secrets.choice(_PWD_ALPHABET) for _ in range(group_size)) for _ in range(groups)
    ]
    return "-".join(chunks)
