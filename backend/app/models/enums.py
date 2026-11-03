"""Allowed values for string columns. Kept in one place for models, schemas and seed data."""

from typing import Literal, get_args

PositionCategory = Literal["guard", "top", "bottom", "standing", "back"]
TechniqueType = Literal[
    "pull", "sweep", "submission", "pass", "escape", "takedown", "entry", "control"
]
Stat = Literal["guard", "sweeps", "passing", "escapes", "submissions", "takedowns"]
VideoSource = Literal["youtube", "instagram", "other"]

POSITION_CATEGORIES: tuple[str, ...] = get_args(PositionCategory)
TECHNIQUE_TYPES: tuple[str, ...] = get_args(TechniqueType)
STATS: tuple[str, ...] = get_args(Stat)
VIDEO_SOURCES: tuple[str, ...] = get_args(VideoSource)

MASTERY_MIN = 0
MASTERY_MAX = 5
MASTERY_NAMES: dict[int, str] = {
    0: "Locked",
    1: "Seen",
    2: "Drilled",
    3: "Hit in rolling",
    4: "Hit on resisting partners",
    5: "Mastered",
}
