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

ClassType = Literal["gi_class", "open_mat", "drilling", "competition"]
SessionTechniqueKind = Literal["taught", "drilled", "hit_in_rolling"]
MistakeCategory = Literal["posture", "grips", "timing", "hook_retention", "defense", "other"]
MistakeStatus = Literal["open", "working", "fixed"]

CLASS_TYPES: tuple[str, ...] = get_args(ClassType)
SESSION_TECHNIQUE_KINDS: tuple[str, ...] = get_args(SessionTechniqueKind)
MISTAKE_CATEGORIES: tuple[str, ...] = get_args(MistakeCategory)
MISTAKE_STATUSES: tuple[str, ...] = get_args(MistakeStatus)

ENERGY_MIN = 1
ENERGY_MAX = 5
