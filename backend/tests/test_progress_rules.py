"""Unit tests for every progress rule in `app.services.progress`."""

from datetime import date, timedelta

import pytest

from app.services.progress import (
    MistakeSample,
    is_unlocked,
    mat_minutes,
    raised_mastery,
    same_month,
    stat_scores,
    top_mistake,
    week_start,
    weekly_streak,
)

# ---- Unlocks -------------------------------------------------------------------


def test_no_prerequisites_means_unlocked() -> None:
    assert is_unlocked([]) is True


@pytest.mark.parametrize(
    ("prereqs", "unlocked"),
    [
        ([0], False),
        ([1], False),
        ([2], True),
        ([5], True),
        ([2, 3, 5], True),
        ([2, 1], False),  # every prerequisite has to reach Drilled
    ],
)
def test_unlocks_when_every_prerequisite_reaches_drilled(
    prereqs: list[int], unlocked: bool
) -> None:
    assert is_unlocked(prereqs) is unlocked


# ---- Mastery from logged classes -----------------------------------------------


@pytest.mark.parametrize(
    ("current", "kinds", "expected"),
    [
        (0, ["taught"], 1),
        (0, ["drilled"], 2),
        (0, ["hit_in_rolling"], 3),
        (1, ["taught", "drilled", "hit_in_rolling"], 3),  # the highest kind wins
        (2, ["taught"], 2),  # never lowers
        (4, ["hit_in_rolling"], 4),
        (5, ["drilled"], 5),
        (1, [], 1),
    ],
)
def test_logging_a_technique_raises_mastery(current: int, kinds: list[str], expected: int) -> None:
    assert raised_mastery(current, kinds) == expected


# ---- Stats ---------------------------------------------------------------------


def test_stats_are_mastery_points_scaled_to_ten() -> None:
    scores = {s.stat: s for s in stat_scores([("guard", 2), ("guard", 1), ("sweeps", 5)])}

    # Guard: 3 points of a possible 10 (two techniques x 5).
    assert scores["guard"].value == 3.0
    assert (scores["guard"].points, scores["guard"].max_points) == (3, 10)
    assert scores["guard"].techniques == 2
    assert scores["sweeps"].value == 10.0


def test_stats_round_to_one_decimal() -> None:
    scores = {
        s.stat: s.value for s in stat_scores([("escapes", 2), ("escapes", 1), ("escapes", 1)])
    }

    assert scores["escapes"] == 2.7  # 4 / 15 x 10


def test_stat_without_techniques_is_zero() -> None:
    scores = {s.stat: s for s in stat_scores([("guard", 3)])}

    assert scores["takedowns"].value == 0.0
    assert scores["takedowns"].techniques == 0


def test_all_stats_are_returned_in_a_fixed_order() -> None:
    assert [s.stat for s in stat_scores([])] == [
        "guard",
        "sweeps",
        "passing",
        "escapes",
        "submissions",
        "takedowns",
    ]


def test_stats_stay_between_zero_and_ten() -> None:
    values = [s.value for s in stat_scores([("guard", 5)] * 7 + [("sweeps", 0)] * 3)]

    assert all(0.0 <= v <= 10.0 for v in values)


# ---- Classes and mat time ------------------------------------------------------


def test_mat_time_counts_two_hours_per_class_without_a_duration() -> None:
    assert mat_minutes([None, None]) == 240
    assert mat_minutes([90, None]) == 210
    assert mat_minutes([]) == 0


def test_same_month() -> None:
    assert same_month(date(2026, 11, 1), date(2026, 11, 30))
    assert not same_month(date(2026, 10, 31), date(2026, 11, 1))
    assert not same_month(date(2025, 11, 3), date(2026, 11, 3))


# ---- Weekly streak -------------------------------------------------------------

TUESDAY = date(2026, 11, 3)


def _weeks_ago(weeks: int, day: date = TUESDAY) -> date:
    return day - timedelta(weeks=weeks)


def test_weeks_start_on_monday() -> None:
    assert week_start(TUESDAY) == date(2026, 11, 2)
    assert week_start(date(2026, 11, 2)) == date(2026, 11, 2)
    assert week_start(date(2026, 11, 8)) == date(2026, 11, 2)  # Sunday


def test_no_classes_no_streak() -> None:
    streak = weekly_streak([], TUESDAY)

    assert (streak.weeks, streak.best_weeks, streak.trained_this_week) == (0, 0, False)
    assert streak.last_class is None


def test_streak_counts_consecutive_weeks_including_this_one() -> None:
    streak = weekly_streak([TUESDAY, _weeks_ago(1), _weeks_ago(2)], TUESDAY)

    assert streak.weeks == 3
    assert streak.trained_this_week is True
    assert streak.last_class == TUESDAY


def test_several_classes_in_one_week_count_once() -> None:
    monday = date(2026, 11, 2)
    assert weekly_streak([monday, TUESDAY, TUESDAY], TUESDAY).weeks == 1


def test_streak_is_kept_while_this_week_is_still_open() -> None:
    streak = weekly_streak([_weeks_ago(1), _weeks_ago(2)], TUESDAY)

    assert streak.weeks == 2
    assert streak.trained_this_week is False


def test_a_missed_week_breaks_the_streak() -> None:
    streak = weekly_streak([_weeks_ago(2), _weeks_ago(3), _weeks_ago(4)], TUESDAY)

    assert streak.weeks == 0
    assert streak.best_weeks == 3


def test_streak_restarts_after_a_gap() -> None:
    streak = weekly_streak([TUESDAY, _weeks_ago(2), _weeks_ago(3)], TUESDAY)

    assert streak.weeks == 1
    assert streak.best_weeks == 2


def test_sunday_and_next_monday_are_consecutive_weeks() -> None:
    sunday = date(2026, 11, 1)
    monday = date(2026, 11, 2)

    assert weekly_streak([sunday, monday], monday).weeks == 2


def test_streak_ignores_classes_in_the_future() -> None:
    streak = weekly_streak([_weeks_ago(-1)], TUESDAY)

    assert (streak.weeks, streak.best_weeks, streak.last_class) == (0, 0, None)


def test_streak_across_new_year() -> None:
    dates = [date(2026, 12, 30), date(2027, 1, 6)]

    assert weekly_streak(dates, date(2027, 1, 6)).weeks == 2


# ---- Top mistake this month ----------------------------------------------------


def _mistake(
    id: int,
    day: date = TUESDAY,
    technique_id: int | None = 1,
    position_id: int | None = None,
    category: str = "grips",
    status: str = "open",
) -> MistakeSample:
    return MistakeSample(id, day, technique_id, position_id, category, status)


def test_no_mistakes_no_top_mistake() -> None:
    assert top_mistake([], TUESDAY) is None


def test_top_mistake_is_the_most_frequent_group() -> None:
    top = top_mistake(
        [
            _mistake(1),
            _mistake(2),
            _mistake(3, technique_id=2),
            _mistake(4, technique_id=2),
            _mistake(5, technique_id=2),
        ],
        TUESDAY,
    )

    assert top is not None
    assert (top.technique_id, top.count, top.latest_id) == (2, 3, 5)


def test_same_technique_different_category_is_a_different_mistake() -> None:
    top = top_mistake([_mistake(1), _mistake(2, category="posture")], TUESDAY)

    assert top is not None
    assert top.count == 1


def test_mistakes_without_a_technique_group_by_position() -> None:
    top = top_mistake(
        [
            _mistake(1, technique_id=None, position_id=4),
            _mistake(2, technique_id=None, position_id=4),
            _mistake(3, technique_id=None, position_id=5),
        ],
        TUESDAY,
    )

    assert top is not None
    assert (top.technique_id, top.position_id, top.count) == (None, 4, 2)


def test_top_mistake_counts_this_month_only() -> None:
    last_month = date(2026, 10, 30)
    top = top_mistake(
        [_mistake(1, day=last_month), _mistake(2, day=last_month), _mistake(3, technique_id=2)],
        TUESDAY,
    )

    assert top is not None
    assert (top.technique_id, top.count) == (2, 1)


def test_fixed_mistakes_do_not_count() -> None:
    top = top_mistake([_mistake(1, status="fixed"), _mistake(2, status="working")], TUESDAY)

    assert top is not None
    assert (top.count, top.latest_id) == (1, 2)
    assert top_mistake([_mistake(1, status="fixed")], TUESDAY) is None


def test_a_tie_goes_to_the_most_recent_mistake() -> None:
    top = top_mistake(
        [_mistake(1, day=date(2026, 11, 1)), _mistake(2, technique_id=2, day=TUESDAY)], TUESDAY
    )

    assert top is not None
    assert top.technique_id == 2
