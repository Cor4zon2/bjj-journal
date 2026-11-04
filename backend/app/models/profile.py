"""The owner's profile: belt, stripes and current focus techniques. There is only ever one row."""

from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.enums import BELTS, STRIPES_MAX, STRIPES_MIN
from app.models.technique import _in

PROFILE_ID = 1


class Profile(Base):
    __tablename__ = "profile"
    __table_args__ = (
        CheckConstraint(_in("belt", BELTS), name="belt"),
        CheckConstraint(f"stripes BETWEEN {STRIPES_MIN} AND {STRIPES_MAX}", name="stripes"),
        CheckConstraint(f"id = {PROFILE_ID}", name="single_row"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, default=PROFILE_ID)
    belt: Mapped[str] = mapped_column(String(20), default="white")
    stripes: Mapped[int] = mapped_column(Integer, default=1)
    # Ordered: the first one is shown first on Home. Ids of deleted techniques are skipped on read.
    focus_technique_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
