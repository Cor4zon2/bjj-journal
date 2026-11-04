import datetime as dt

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import STRIPES_MAX, STRIPES_MIN, Belt, MistakeCategory, Stat
from app.schemas.position import PositionRef
from app.schemas.technique import TechniqueRef, TechniqueSummary

MAX_FOCUS = 5


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    belt: Belt
    stripes: int
    focus_technique_ids: list[int]


class ProfileUpdate(BaseModel):
    """Partial update. The belt is only ever set by hand: the app never promotes you."""

    belt: Belt | None = None
    stripes: int | None = Field(default=None, ge=STRIPES_MIN, le=STRIPES_MAX)
    focus_technique_ids: list[int] | None = Field(
        default=None, description=f"Current focus techniques, in order. At most {MAX_FOCUS}."
    )

    @field_validator("focus_technique_ids")
    @classmethod
    def _unique(cls, ids: list[int] | None) -> list[int] | None:
        if ids is None:
            return None
        ids = list(dict.fromkeys(ids))
        if len(ids) > MAX_FOCUS:
            raise ValueError(f"Pick at most {MAX_FOCUS} focus techniques")
        return ids


class StatRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stat: Stat
    value: float = Field(description="0-10: mastery points over the most the stat could hold.")
    techniques: int
    points: int
    max_points: int


class StreakRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    weeks: int = Field(description="Consecutive weeks with a class, this week included if done.")
    best_weeks: int
    trained_this_week: bool
    last_class: dt.date | None


class TopMistakeRead(BaseModel):
    count: int = Field(description="Times this month, not counting fixed ones.")
    category: MistakeCategory
    description: str = Field(description="The most recent one of the group.")
    mistake_id: int
    technique: TechniqueRef | None
    position: PositionRef | None


class ProgressRead(BaseModel):
    """Everything the Home screen shows, in one request."""

    today: dt.date
    belt: Belt
    stripes: int
    classes: int
    classes_this_month: int
    mat_hours: float
    streak: StreakRead
    stats: list[StatRead]
    focus: list[TechniqueSummary]
    top_mistake: TopMistakeRead | None
