from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PositionCategory


class PositionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    category: PositionCategory
    description: str = ""


class PositionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: PositionCategory | None = None
    description: str | None = None


class PositionRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    category: PositionCategory


class PositionRead(PositionRef):
    description: str
