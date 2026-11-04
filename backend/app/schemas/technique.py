from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.models.enums import (
    MASTERY_MAX,
    MASTERY_MIN,
    MASTERY_NAMES,
    Stat,
    TechniqueType,
    VideoSource,
)
from app.schemas.position import PositionRef
from app.services.videos import youtube_embed_url

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


def _clean_lines(lines: list[str]) -> list[str]:
    """Trim each entry and drop blank ones (handy for edits made on a phone)."""
    return [line.strip() for line in lines if line.strip()]


# ---- Video links ---------------------------------------------------------------


class VideoLinkCreate(BaseModel):
    url: str = Field(min_length=1, max_length=2000, pattern=r"^https?://")
    title: str = Field(default="", max_length=300)
    source: VideoSource | None = Field(
        default=None, description="Detected from the URL when omitted."
    )
    start_seconds: int | None = Field(
        default=None, ge=0, description="Taken from a YouTube `t=` parameter when omitted."
    )


class VideoLinkUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    start_seconds: int | None = Field(default=None, ge=0)


class VideoLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technique_id: int
    url: str
    source: VideoSource
    title: str
    start_seconds: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def embed_url(self) -> str | None:
        """Privacy-friendly YouTube embed URL; `null` for links that open externally."""
        if self.source != "youtube":
            return None
        return youtube_embed_url(self.url, self.start_seconds)


# ---- Common mistakes -----------------------------------------------------------


class CommonMistakeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    why_it_happens: str = ""
    fix: str = ""


class CommonMistakeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    why_it_happens: str | None = None
    fix: str | None = None


class CommonMistakeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technique_id: int
    title: str
    why_it_happens: str
    fix: str


# ---- Techniques ----------------------------------------------------------------


class TechniqueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, pattern=SLUG_PATTERN, max_length=100)
    type: TechniqueType
    stat: Stat
    from_position_id: int | None = None
    to_position_id: int | None = None
    summary: str = ""
    steps: list[str] = []
    key_details: list[str] = []
    mastery: int = Field(default=0, ge=MASTERY_MIN, le=MASTERY_MAX)
    times_hit: int = Field(default=0, ge=0)
    notes: str = ""
    gi_only: bool = False
    prereq_ids: list[int] = []

    @field_validator("steps", "key_details")
    @classmethod
    def _clean(cls, lines: list[str]) -> list[str]:
        return _clean_lines(lines)


class TechniqueUpdate(BaseModel):
    """Partial update: only the fields sent are changed. `null` clears a position."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    type: TechniqueType | None = None
    stat: Stat | None = None
    from_position_id: int | None = None
    to_position_id: int | None = None
    summary: str | None = None
    steps: list[str] | None = None
    key_details: list[str] | None = None
    mastery: int | None = Field(default=None, ge=MASTERY_MIN, le=MASTERY_MAX)
    times_hit: int | None = Field(default=None, ge=0)
    notes: str | None = None
    gi_only: bool | None = None
    prereq_ids: list[int] | None = None

    @field_validator("steps", "key_details")
    @classmethod
    def _clean(cls, lines: list[str] | None) -> list[str] | None:
        return None if lines is None else _clean_lines(lines)


class TechniqueRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    mastery: int
    locked: bool = Field(description="True until every prerequisite reaches Drilled.")


class TechniqueSummary(BaseModel):
    """One row of the technique list."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    type: TechniqueType
    stat: Stat
    summary: str
    mastery: int
    locked: bool = Field(description="True until every prerequisite reaches Drilled.")
    times_hit: int
    gi_only: bool
    from_position: PositionRef | None
    to_position: PositionRef | None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def mastery_name(self) -> str:
        return MASTERY_NAMES[self.mastery]


class TechniqueDetail(TechniqueSummary):
    from_position_id: int | None
    to_position_id: int | None
    steps: list[str]
    key_details: list[str]
    notes: str
    prereqs: list[TechniqueRef]
    unlocks: list[TechniqueRef]
    videos: list[VideoLinkRead]
    common_mistakes: list[CommonMistakeRead]
    created_at: datetime
    updated_at: datetime
