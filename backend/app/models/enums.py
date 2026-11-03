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
    0: "Not started",
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

# ---- Progress -------------------------------------------------------------------

Belt = Literal["white", "blue", "purple", "brown", "black"]
BELTS: tuple[str, ...] = get_args(Belt)
STRIPES_MIN = 0
STRIPES_MAX = 4

# A technique unlocks once every prerequisite reaches this mastery level (Drilled).
UNLOCK_MASTERY = 2

# Logging a technique in a class raises its mastery to at least this level. Never lowers it.
KIND_MASTERY: dict[str, int] = {"taught": 1, "drilled": 2, "hit_in_rolling": 3}

# Every class is a 2-hour Gi class unless a duration was logged.
DEFAULT_CLASS_MINUTES = 120
