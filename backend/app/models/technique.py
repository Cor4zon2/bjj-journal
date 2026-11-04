from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    exists,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, aliased, column_property, mapped_column, relationship

from app.db import Base
from app.models.enums import (
    MASTERY_MAX,
    MASTERY_MIN,
    POSITION_CATEGORIES,
    STATS,
    TECHNIQUE_TYPES,
    UNLOCK_MASTERY,
    VIDEO_SOURCES,
)

# JSON lists (steps, key details): JSONB on Postgres, plain JSON elsewhere (SQLite in tests).
JsonList: Any = JSON().with_variant(JSONB(), "postgresql")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


technique_prereq = Table(
    "technique_prereq",
    Base.metadata,
    Column("technique_id", ForeignKey("technique.id", ondelete="CASCADE"), primary_key=True),
    Column("prereq_id", ForeignKey("technique.id", ondelete="CASCADE"), primary_key=True),
    CheckConstraint("technique_id <> prereq_id", name="no_self_prereq"),
)


class Position(Base):
    __tablename__ = "position"
    __table_args__ = (CheckConstraint(_in("category", POSITION_CATEGORIES), name="category"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text, default="")


class Technique(Base):
    __tablename__ = "technique"
    __table_args__ = (
        CheckConstraint(_in("type", TECHNIQUE_TYPES), name="type"),
        CheckConstraint(_in("stat", STATS), name="stat"),
        CheckConstraint(f"mastery BETWEEN {MASTERY_MIN} AND {MASTERY_MAX}", name="mastery"),
        CheckConstraint("times_hit >= 0", name="times_hit"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(20))
    stat: Mapped[str] = mapped_column(String(20))
    from_position_id: Mapped[int | None] = mapped_column(
        ForeignKey("position.id", ondelete="SET NULL"), index=True
    )
    to_position_id: Mapped[int | None] = mapped_column(
        ForeignKey("position.id", ondelete="SET NULL"), index=True
    )
    summary: Mapped[str] = mapped_column(Text, default="")
    steps: Mapped[list[str]] = mapped_column(JsonList, default=list)
    key_details: Mapped[list[str]] = mapped_column(JsonList, default=list)
    mastery: Mapped[int] = mapped_column(Integer, default=0)
    times_hit: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    gi_only: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    from_position: Mapped[Position | None] = relationship(foreign_keys=[from_position_id])
    to_position: Mapped[Position | None] = relationship(foreign_keys=[to_position_id])
    prereqs: Mapped[list["Technique"]] = relationship(
        secondary=technique_prereq,
        primaryjoin=lambda: Technique.id == technique_prereq.c.technique_id,
        secondaryjoin=lambda: Technique.id == technique_prereq.c.prereq_id,
        order_by=lambda: Technique.name,
    )
    unlocks: Mapped[list["Technique"]] = relationship(
        secondary=technique_prereq,
        primaryjoin=lambda: Technique.id == technique_prereq.c.prereq_id,
        secondaryjoin=lambda: Technique.id == technique_prereq.c.technique_id,
        order_by=lambda: Technique.name,
        viewonly=True,
    )
    videos: Mapped[list["VideoLink"]] = relationship(
        back_populates="technique",
        cascade="all, delete-orphan",
        order_by=lambda: VideoLink.id,
    )
    common_mistakes: Mapped[list["CommonMistake"]] = relationship(
        back_populates="technique",
        cascade="all, delete-orphan",
        order_by=lambda: CommonMistake.id,
    )

    if TYPE_CHECKING:
        # Set below the class: True while any prerequisite is still under Drilled.
        locked: bool


class VideoLink(Base):
    __tablename__ = "video_link"
    __table_args__ = (
        CheckConstraint(_in("source", VIDEO_SOURCES), name="source"),
        CheckConstraint("start_seconds >= 0", name="start_seconds"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    technique_id: Mapped[int] = mapped_column(
        ForeignKey("technique.id", ondelete="CASCADE"), index=True
    )
    url: Mapped[str] = mapped_column(String(2000))
    source: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(300), default="")
    start_seconds: Mapped[int] = mapped_column(Integer, default=0)

    technique: Mapped[Technique] = relationship(back_populates="videos")


class CommonMistake(Base):
    __tablename__ = "common_mistake"

    id: Mapped[int] = mapped_column(primary_key=True)
    technique_id: Mapped[int] = mapped_column(
        ForeignKey("technique.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(300))
    why_it_happens: Mapped[str] = mapped_column(Text, default="")
    fix: Mapped[str] = mapped_column(Text, default="")

    technique: Mapped[Technique] = relationship(back_populates="common_mistakes")


# Unlock rule: a technique unlocks when all of its prerequisites reach Drilled.
# Loaded with the technique in the same query, so lists and nested refs stay one round trip.
# `services.progress.is_unlocked` is the same rule in Python.
_prereq = aliased(Technique)
Technique.locked = column_property(  # type: ignore[assignment]
    exists()
    .where(
        technique_prereq.c.technique_id == Technique.id,
        technique_prereq.c.prereq_id == _prereq.id,
        _prereq.mastery < UNLOCK_MASTERY,
    )
    .correlate_except(technique_prereq, _prereq)
)
