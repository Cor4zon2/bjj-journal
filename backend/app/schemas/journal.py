import datetime as dt

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import (
    ENERGY_MAX,
    ENERGY_MIN,
    ClassType,
    MistakeCategory,
    MistakeStatus,
    SessionTechniqueKind,
)
from app.schemas.position import PositionRef
from app.schemas.technique import TechniqueRef

# ---- My mistakes ---------------------------------------------------------------


class _MistakeFields(BaseModel):
    technique_id: int | None = None
    position_id: int | None = None
    category: MistakeCategory = "other"
    description: str = Field(min_length=1, max_length=2000)
    status: MistakeStatus = "open"

    @field_validator("description")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Describe the mistake")
        return value


class MistakeCreate(_MistakeFields):
    """A mistake logged on its own. Mistakes are usually logged inside a class instead."""

    session_id: int | None = None


class SessionMistakeWrite(_MistakeFields):
    """A mistake inside a class log. Send `id` to keep an existing mistake when editing a class."""

    id: int | None = None


class MistakeUpdate(BaseModel):
    """Partial update. `null` clears the linked technique or position."""

    technique_id: int | None = None
    position_id: int | None = None
    category: MistakeCategory | None = None
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    status: MistakeStatus | None = None


class SessionRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt.date
    type: ClassType


class MistakeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int | None
    technique_id: int | None
    position_id: int | None
    category: MistakeCategory
    description: str
    status: MistakeStatus
    fixed_at: dt.datetime | None
    created_at: dt.datetime
    technique: TechniqueRef | None
    position: PositionRef | None


class MistakeWithSession(MistakeRead):
    """A row of the mistakes list: includes the class it was logged in."""

    session: SessionRef | None


# ---- Class sessions ------------------------------------------------------------


class SessionTechniqueWrite(BaseModel):
    technique_id: int
    kind: SessionTechniqueKind


class SessionTechniqueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    technique_id: int
    kind: SessionTechniqueKind
    technique: TechniqueRef


class ClassSessionCreate(BaseModel):
    client_id: str | None = Field(
        default=None,
        max_length=64,
        description="Random id from the client. Sending the same one again returns the class "
        "that was already saved instead of creating a duplicate.",
    )
    date: dt.date
    type: ClassType = "gi_class"
    duration_min: int | None = Field(default=None, gt=0, le=600)
    energy: int | None = Field(default=None, ge=ENERGY_MIN, le=ENERGY_MAX)
    rolling_notes: str = ""
    techniques: list[SessionTechniqueWrite] = []
    mistakes: list[SessionMistakeWrite] = []


class ClassSessionUpdate(BaseModel):
    """Partial update. `techniques` and `mistakes`, when sent, replace the whole list:
    mistakes with an `id` are updated, new ones are created and missing ones deleted."""

    date: dt.date | None = None
    type: ClassType | None = None
    duration_min: int | None = Field(default=None, gt=0, le=600)
    energy: int | None = Field(default=None, ge=ENERGY_MIN, le=ENERGY_MAX)
    rolling_notes: str | None = None
    techniques: list[SessionTechniqueWrite] | None = None
    mistakes: list[SessionMistakeWrite] | None = None


class ClassSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: str | None
    date: dt.date
    type: ClassType
    duration_min: int | None
    energy: int | None
    rolling_notes: str
    techniques: list[SessionTechniqueRead]
    mistakes: list[MistakeRead]
    created_at: dt.datetime
    updated_at: dt.datetime
