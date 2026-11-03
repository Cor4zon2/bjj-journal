"""Progress rules: stats, weekly streak, unlocks, mastery from logged classes, top mistake.

Pure functions over plain values, so every rule is unit-tested without a database.
"""

from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

from app.models.enums import (
    DEFAULT_CLASS_MINUTES,
    KIND_MASTERY,
    MASTERY_MAX,
    STATS,
    UNLOCK_MASTERY,
)

STAT_MAX = 10.0

# ---- Unlocks -------------------------------------------------------------------


def is_unlocked(prereq_masteries: Iterable[int]) -> bool:
    """A technique unlocks when all of its prerequisites reach Drilled. No prerequisites: unlocked.

    The same rule runs in SQL as `Technique.locked`.
    """
    return all(mastery >= UNLOCK_MASTERY for mastery in prereq_masteries)


# ---- Mastery from logged classes -----------------------------------------------


def raised_mastery(current: int, kinds: Iterable[str]) -> int:
    """Mastery after logging a technique in a class: taught → Seen, drilled → Drilled,
    hit in rolling → Hit in rolling. Only ever raises; levels 4 and 5 are set by hand."""
    floor = max((KIND_MASTERY[kind] for kind in kinds), default=0)
    return max(current, floor)


# ---- Stats ---------------------------------------------------------------------


@dataclass(frozen=True)
class StatScore:
    stat: str
    value: float  # 0-10, one decimal
    techniques: int
    points: int  # sum of mastery levels
    max_points: int  # techniques x 5


def stat_scores(techniques: Iterable[tuple[str, int]]) -> list[StatScore]:
    """Each stat = sum of the mastery levels of its techniques, scaled 0-10.

    Scaled against the most the category could hold (every technique Mastered), so 10 means
    every technique in the library for that stat is mastered. A stat with no techniques is 0.
    Returned in the fixed order of `STATS`.
    """
    points: Counter[str] = Counter()
    counts: Counter[str] = Counter()
    for stat, mastery in techniques:
        points[stat] += mastery
        counts[stat] += 1
    scores = []
    for stat in STATS:
        max_points = counts[stat] * MASTERY_MAX
        value = round(STAT_MAX * points[stat] / max_points, 1) if max_points else 0.0
        scores.append(StatScore(stat, value, counts[stat], points[stat], max_points))
    return scores


# ---- Classes and mat time ------------------------------------------------------


def mat_minutes(durations: Iterable[int | None]) -> int:
    """Total mat time. A class without a logged duration counts as 2 hours."""
    return sum(DEFAULT_CLASS_MINUTES if minutes is None else minutes for minutes in durations)


def same_month(day: date, today: date) -> bool:
    return (day.year, day.month) == (today.year, today.month)


# ---- Weekly streak -------------------------------------------------------------


def week_start(day: date) -> date:
    """Monday of the week `day` falls in."""
    return day - timedelta(days=day.weekday())


@dataclass(frozen=True)
class Streak:
    weeks: int  # current streak
    best_weeks: int
    trained_this_week: bool
    last_class: date | None


def weekly_streak(class_dates: Iterable[date], today: date) -> Streak:
    """Consecutive weeks (Monday to Sunday) with at least one logged class.

    The current week still counts as "in progress": a streak that ran up to last week is kept
    until this week ends without a class. Classes dated in the future are ignored.
    """
    dates = [d for d in class_dates if d <= today]
    weeks = {week_start(d) for d in dates}
    this_week = week_start(today)
    one_week = timedelta(weeks=1)

    trained_this_week = this_week in weeks
    cursor = this_week if trained_this_week else this_week - one_week
    current = 0
    while cursor in weeks:
        current += 1
        cursor -= one_week

    best = 0
    run = 0
    previous: date | None = None
    for week in sorted(weeks):
        run = run + 1 if previous is not None and week - previous == one_week else 1
        best = max(best, run)
        previous = week

    return Streak(current, best, trained_this_week, max(dates, default=None))


# ---- Top mistake this month ----------------------------------------------------


@dataclass(frozen=True)
class MistakeSample:
    id: int
    day: date  # the class date, or the day it was logged when it has no class
    technique_id: int | None
    position_id: int | None
    category: str
    status: str


@dataclass(frozen=True)
class TopMistake:
    count: int
    latest_id: int  # the most recent mistake of the group, shown on Home
    technique_id: int | None
    position_id: int | None
    category: str


def _group_key(m: MistakeSample) -> tuple[str, int | None, str]:
    # Same technique (or, without one, same position) and same category = the same mistake.
    if m.technique_id is not None:
        return ("technique", m.technique_id, m.category)
    if m.position_id is not None:
        return ("position", m.position_id, m.category)
    return ("none", None, m.category)


def top_mistake(mistakes: Iterable[MistakeSample], today: date) -> TopMistake | None:
    """The mistake made most often this month that is not fixed yet.

    Mistakes are grouped by technique (or position when no technique is linked) and category.
    Ties go to the group made most recently.
    """
    groups: dict[tuple[str, int | None, str], list[MistakeSample]] = defaultdict(list)
    for m in mistakes:
        if m.status != "fixed" and m.day <= today and same_month(m.day, today):
            groups[_group_key(m)].append(m)
    if not groups:
        return None

    def latest(group: list[MistakeSample]) -> MistakeSample:
        return max(group, key=lambda m: (m.day, m.id))

    best = max(groups.values(), key=lambda g: (len(g), latest(g).day, latest(g).id))
    newest = latest(best)
    return TopMistake(
        count=len(best),
        latest_id=newest.id,
        technique_id=newest.technique_id,
        position_id=newest.position_id if newest.technique_id is None else None,
        category=newest.category,
    )
