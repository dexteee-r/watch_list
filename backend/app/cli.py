"""CLI d'administration (bootstrap).

Sert à créer le tout premier admin (l'API n'a pas de route d'inscription publique),
et de dépannage hors-ligne. En prod : `docker compose exec api python -m app.cli ...`.
"""
import argparse
import asyncio
import sys

from email_validator import EmailNotValidError, validate_email

from .db import AsyncSessionLocal
from .repository import users as users_repo
from .security import generate_password, hash_password


def _clean_email(email: str) -> str | None:
    """Valide + normalise l'email (même règle que l'API). Renvoie None si invalide."""
    try:
        return validate_email(email.strip().lower(), check_deliverability=False).normalized
    except EmailNotValidError as exc:
        print(f"✗ Email invalide : {exc}")
        return None


_MIN_PASSWORD_LENGTH = 8


def _resolve_password(password: str | None) -> str | None:
    """Renvoie le mot de passe choisi (validé) ou un mot de passe généré. None = erreur."""
    if not password:
        return generate_password()
    if len(password) < _MIN_PASSWORD_LENGTH:
        print(f"✗ Le mot de passe doit faire au moins {_MIN_PASSWORD_LENGTH} caractères.")
        return None
    return password


async def _create_user(email: str, is_admin: bool, password: str | None = None) -> None:
    cleaned = _clean_email(email)
    if cleaned is None:
        return
    email = cleaned
    resolved = _resolve_password(password)
    if resolved is None:
        return
    async with AsyncSessionLocal() as db:
        if await users_repo.get_by_email(db, email):
            print(f"✗ Un compte existe déjà pour {email}.")
            return
        user = await users_repo.create(db, email, hash_password(resolved), is_admin)
        await db.commit()
        role = "admin" if is_admin else "user"
        print(f"✓ Compte créé : {email}  (id={user.id}, {role})")
        print(f"  Mot de passe : {resolved}")
        print("  → Transmets-le à la personne ; il ne sera plus affiché.")


async def _reset_password(email: str, password: str | None = None) -> None:
    email = email.strip().lower()
    resolved = _resolve_password(password)
    if resolved is None:
        return
    async with AsyncSessionLocal() as db:
        user = await users_repo.get_by_email(db, email)
        if user is None:
            print(f"✗ Aucun compte pour {email}.")
            return
        await users_repo.set_password(db, user, hash_password(resolved))
        await db.commit()
        print(f"✓ Mot de passe réinitialisé pour {email}.")
        print(f"  Nouveau mot de passe : {resolved}")


async def _list_users() -> None:
    async with AsyncSessionLocal() as db:
        users = await users_repo.list_all(db)
        if not users:
            print("(aucun compte)")
            return
        for u in users:
            role = "admin" if u.is_admin else "user"
            print(f"  [{u.id}] {u.email}  ({role})")


def main() -> None:
    # La console Windows par défaut (cp1252) ne sait pas encoder ✓/→ : on force UTF-8.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

    parser = argparse.ArgumentParser(prog="app.cli", description="Administration des comptes.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create-user", help="Créer un compte (mot de passe généré ou choisi).")
    p_create.add_argument("--email", required=True)
    p_create.add_argument("--admin", action="store_true", help="Donne les droits admin.")
    p_create.add_argument("--password", help="Mot de passe choisi (min. 8 car.). Sinon généré.")

    p_reset = sub.add_parser("reset-password", help="Réinitialiser le mot de passe d'un compte.")
    p_reset.add_argument("--email", required=True)
    p_reset.add_argument("--password", help="Mot de passe choisi (min. 8 car.). Sinon généré.")

    sub.add_parser("list-users", help="Lister les comptes.")

    args = parser.parse_args()
    if args.command == "create-user":
        asyncio.run(_create_user(args.email, args.admin, args.password))
    elif args.command == "reset-password":
        asyncio.run(_reset_password(args.email, args.password))
    elif args.command == "list-users":
        asyncio.run(_list_users())


if __name__ == "__main__":
    main()
