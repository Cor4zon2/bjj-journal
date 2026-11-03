"""Class log: training sessions, the techniques covered in them, and my own mistakes."""

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import (
    CLASS_TYPES,
    ENERGY_MAX,
    ENERGY_MIN,
    MISTAKE_CATEGORIES,
    MISTAKE_STATUSES,
    SESSION_TECHNIQUE_KINDS,
)
from app.models.technique import Position, Technique, _in


class ClassSession(Base):
    __tablename__ = "class_session"
    __table_args__ = (
        CheckConstraint(_in("type", CLASS_TYPES), name="type"),
        CheckConstraint(f"energy BETWEEN {ENERGY_MIN} AND {ENERGY_MAX}", name="energy"),
        CheckConstraint("duration_min > 0", name="duration_min"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Set by the phone when a log is first drafted, so a save retried after losing
    # signal never creates the same class twice.
    client_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    type: Mapped[str] = mapped_column(String(20))
    duration_min: Mapped[int | None] = mapped_column(Integer)
    energy: Mapped[int | None] = mapped_column(Integer)
    rolling_notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    techniques: Mapped[list["SessionTechnique"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by=lambda: (SessionTechnique.technique_id, SessionTechnique.kind),
    )
    mistakes: Mapped[list["MyMistake"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by=lambda: MyMistake.id,
    )


class SessionTechnique(Base):
    """A technique covered in a class. One row per kind: drilled and hit are separate rows."""

    __tablename__ = "session_technique"
    __table_args__ = (CheckConstraint(_in("kind", SESSION_TECHNIQUE_KINDS), name="kind"),)

    session_id: Mapped[int] = mapped_column(
        ForeignKey("class_session.id", ondelete="CASCADE"), primary_key=True
    )
    technique_id: Mapped[int] = mapped_column(
        ForeignKey("technique.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), primary_key=True)

    session: Mapped[ClassSession] = relationship(back_populates="techniques")
    technique: Mapped[Technique] = relationship()


class MyMistake(Base):
    __tablename__ = "my_mistake"
    __table_args__ = (
        CheckConstraint(_in("category", MISTAKE_CATEGORIES), name="category"),
        CheckConstraint(_in("status", MISTAKE_STATUSES), name="status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("class_session.id", ondelete="CASCADE"), index=True
    )
    technique_id: Mapped[int | None] = mapped_column(
        ForeignKey("technique.id", ondelete="SET NULL"), index=True
    )
    position_id: Mapped[int | None] = mapped_column(
        ForeignKey("position.id", ondelete="SET NULL"), index=True
    )
    category: Mapped[str] = mapped_column(String(20), default="other")
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    fixed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    session: Mapped[ClassSession | None] = relationship(back_populates="mistakes")
    technique: Mapped[Technique | None] = relationship()
    position: Mapped[Position | None] = relationship()
