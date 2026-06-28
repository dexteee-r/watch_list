"""Modèles ORM SQLAlchemy.

Architecture (cf DATABASE.md) :
- Catalogue PARTAGÉ : `Show`, `Episode` (métadonnées TVmaze publiques, stockées une fois).
- Données PRIVÉES  : `User`, `UserShow`, `EpisodeWatch` (toujours filtrées par user_id côté API).
"""
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

# Valeurs de statut autorisées pour le suivi d'une série par un utilisateur.
# Source unique de vérité partagée par le CHECK SQL et la validation Pydantic.
STATUSES = ("watching", "completed", "dropped", "plan_to_watch")


def _created_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


def _updated_at() -> Mapped[datetime]:
    return mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    display_name: Mapped[str | None] = mapped_column(Text)  # réservé usage futur
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    shows: Mapped[list["UserShow"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    watches: Mapped[list["EpisodeWatch"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    ratings: Mapped[list["SeasonRating"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Show(Base):
    """Catalogue : une ligne par série TVmaze, partagée entre tous les utilisateurs."""

    __tablename__ = "shows"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    tvmaze_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    poster_url: Mapped[str | None] = mapped_column(Text)
    premiered: Mapped[date | None] = mapped_column(Date)
    ended: Mapped[date | None] = mapped_column(Date)
    tvmaze_status: Mapped[str | None] = mapped_column(Text)  # Running / Ended (≠ statut user)
    genres: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default="{}")
    total_seasons: Mapped[int | None] = mapped_column(SmallInteger)
    total_episodes: Mapped[int | None] = mapped_column(SmallInteger)
    summary: Mapped[str | None] = mapped_column(Text)  # réservé usage futur
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()  # = dernier rafraîchissement TVmaze

    episodes: Mapped[list["Episode"]] = relationship(
        back_populates="show", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (Index("ix_shows_genres", "genres", postgresql_using="gin"),)


class Episode(Base):
    """Catalogue : une ligne par épisode d'une série, partagée."""

    __tablename__ = "episodes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    show_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tvmaze_episode_id: Mapped[int | None] = mapped_column(Integer, unique=True)
    season: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    name: Mapped[str | None] = mapped_column(Text)
    airdate: Mapped[date | None] = mapped_column(Date)
    runtime: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    show: Mapped["Show"] = relationship(back_populates="episodes")
    watches: Mapped[list["EpisodeWatch"]] = relationship(
        back_populates="episode", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (UniqueConstraint("show_id", "season", "number"),)


class UserShow(Base):
    """Suivi PRIVÉ d'une série par un utilisateur (statut, date d'ajout)."""

    __tablename__ = "user_shows"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    show_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="plan_to_watch")
    # Dates de visionnage (auto-renseignées, modifiables) : début = 1er épisode coché,
    # fin = passage en 'completed'. NULL tant que non atteint.
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    added_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    user: Mapped["User"] = relationship(back_populates="shows")
    show: Mapped["Show"] = relationship()

    __table_args__ = (
        UniqueConstraint("user_id", "show_id"),
        CheckConstraint(
            "status IN ('watching', 'completed', 'dropped', 'plan_to_watch')", name="status_valid"
        ),
        Index("ix_user_shows_user_status", "user_id", "status"),
    )


class EpisodeWatch(Base):
    """Épisode marqué « vu » par un utilisateur (PRIVÉ). Idempotent via UNIQUE."""

    __tablename__ = "episode_watches"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    episode_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False
    )
    watched_at: Mapped[datetime] = _created_at()

    user: Mapped["User"] = relationship(back_populates="watches")
    episode: Mapped["Episode"] = relationship(back_populates="watches")

    __table_args__ = (UniqueConstraint("user_id", "episode_id"),)


class SeasonRating(Base):
    """Note (1-10) donnée par un utilisateur à une saison d'une série (PRIVÉ)."""

    __tablename__ = "season_ratings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    show_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False
    )
    season: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    user: Mapped["User"] = relationship(back_populates="ratings")

    __table_args__ = (
        UniqueConstraint("user_id", "show_id", "season"),
        CheckConstraint("rating BETWEEN 1 AND 10", name="rating_range"),
        Index("ix_season_ratings_user_show", "user_id", "show_id"),
    )
