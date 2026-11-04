from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

TODAY = "2026-11-03"  # a Tuesday


def _technique(client: TestClient, slug: str) -> dict[str, Any]:
    data: dict[str, Any] = client.get(f"/techniques/by-slug/{slug}").json()
    return data


def _set_mastery(client: TestClient, slug: str, mastery: int) -> dict[str, Any]:
    response = client.patch(
        f"/techniques/{_technique(client, slug)['id']}", json={"mastery": mastery}
    )
    assert response.status_code == 200, response.text
    data: dict[str, Any] = response.json()
    return data


def _log(client: TestClient, date: str, **body: Any) -> dict[str, Any]:
    response = client.post("/sessions", json={"date": date, **body})
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data


def _progress(client: TestClient, today: str = TODAY) -> dict[str, Any]:
    response = client.get("/progress", params={"today": today})
    assert response.status_code == 200, response.text
    data: dict[str, Any] = response.json()
    return data


def _stats(progress: dict[str, Any]) -> dict[str, float]:
    return {s["stat"]: s["value"] for s in progress["stats"]}


# ---- Profile -------------------------------------------------------------------


def test_profile_starts_at_white_belt_one_stripe(client: TestClient) -> None:
    assert client.get("/profile").json() == {
        "belt": "white",
        "stripes": 1,
        "focus_technique_ids": [],
    }


def test_set_belt_and_stripes(client: TestClient) -> None:
    response = client.patch("/profile", json={"stripes": 2})
    assert response.status_code == 200
    assert response.json()["stripes"] == 2

    client.patch("/profile", json={"belt": "blue", "stripes": 0})
    assert client.get("/profile").json()["belt"] == "blue"
    assert _progress(client)["stripes"] == 0


def test_invalid_belt_or_stripes_are_rejected(client: TestClient) -> None:
    assert client.patch("/profile", json={"stripes": 5}).status_code == 422
    assert client.patch("/profile", json={"stripes": -1}).status_code == 422
    assert client.patch("/profile", json={"belt": "green"}).status_code == 422


def test_focus_techniques_keep_their_order(client: TestClient, seeded: Session) -> None:
    tripod = _technique(client, "tripod-sweep")["id"]
    pull = _technique(client, "pull-to-de-la-riva")["id"]

    response = client.patch("/profile", json={"focus_technique_ids": [pull, tripod, pull]})

    assert response.json()["focus_technique_ids"] == [pull, tripod]
    focus = _progress(client)["focus"]
    assert [t["slug"] for t in focus] == ["pull-to-de-la-riva", "tripod-sweep"]
    assert focus[0]["mastery_name"] == "Seen"


def test_focus_rejects_unknown_techniques_and_too_many(client: TestClient, seeded: Session) -> None:
    assert client.patch("/profile", json={"focus_technique_ids": [99999]}).status_code == 422
    ids = [t["id"] for t in client.get("/techniques").json()][:6]
    assert client.patch("/profile", json={"focus_technique_ids": ids}).status_code == 422


def test_deleted_focus_technique_disappears_from_home(client: TestClient, seeded: Session) -> None:
    tripod = _technique(client, "tripod-sweep")["id"]
    client.patch("/profile", json={"focus_technique_ids": [tripod]})

    client.delete(f"/techniques/{tripod}")

    assert _progress(client)["focus"] == []


# ---- Progress ------------------------------------------------------------------


def test_progress_with_nothing_logged(client: TestClient) -> None:
    progress = _progress(client)

    assert progress["today"] == TODAY
    assert (progress["belt"], progress["stripes"]) == ("white", 1)
    assert (progress["classes"], progress["classes_this_month"], progress["mat_hours"]) == (0, 0, 0)
    assert progress["streak"] == {
        "weeks": 0,
        "best_weeks": 0,
        "trained_this_week": False,
        "last_class": None,
    }
    assert [s["stat"] for s in progress["stats"]] == [
        "guard",
        "sweeps",
        "passing",
        "escapes",
        "submissions",
        "takedowns",
    ]
    assert progress["top_mistake"] is None


def test_seed_stats(client: TestClient, seeded: Session) -> None:
    stats = {s["stat"]: s for s in _progress(client)["stats"]}

    # Sweeps: tripod, sickle, scissor and hip bump, all at Seen: 4 of 20 points.
    assert (stats["sweeps"]["points"], stats["sweeps"]["max_points"]) == (4, 20)
    assert stats["sweeps"]["value"] == 2.0
    assert stats["passing"] == {
        "stat": "passing",
        "value": 0.0,
        "techniques": 0,
        "points": 0,
        "max_points": 0,
    }


def test_classes_mat_time_and_month(client: TestClient) -> None:
    _log(client, "2026-11-03", duration_min=90)
    _log(client, "2026-11-01")  # no duration: 2 hours
    _log(client, "2026-10-20")
    _log(client, "2026-11-10")  # in the future: not counted yet

    progress = _progress(client)

    assert progress["classes"] == 3
    assert progress["classes_this_month"] == 2
    assert progress["mat_hours"] == 5.5


def test_logging_a_class_updates_streak(client: TestClient) -> None:
    _log(client, "2026-10-27")  # last week
    assert _progress(client)["streak"]["weeks"] == 1
    assert _progress(client)["streak"]["trained_this_week"] is False

    _log(client, "2026-11-02")  # this week's Monday
    streak = _progress(client)["streak"]

    assert streak == {
        "weeks": 2,
        "best_weeks": 2,
        "trained_this_week": True,
        "last_class": "2026-11-02",
    }


def test_streak_uses_the_phones_date(client: TestClient) -> None:
    _log(client, "2026-11-02")

    # Two weeks later the streak has lapsed.
    assert _progress(client, today="2026-11-17")["streak"]["weeks"] == 0


def test_logging_a_class_raises_mastery_and_stats(client: TestClient, seeded: Session) -> None:
    tripod = _technique(client, "tripod-sweep")
    sickle = _technique(client, "sickle-sweep")
    before = _stats(_progress(client))["sweeps"]

    _log(
        client,
        TODAY,
        techniques=[
            {"technique_id": tripod["id"], "kind": "taught"},
            {"technique_id": tripod["id"], "kind": "hit_in_rolling"},
            {"technique_id": sickle["id"], "kind": "drilled"},
        ],
    )

    assert _technique(client, "tripod-sweep")["mastery"] == 3
    assert _technique(client, "sickle-sweep")["mastery"] == 2
    assert _stats(_progress(client))["sweeps"] == before + 1.5  # 3 more points of 20


def test_logging_never_lowers_mastery(client: TestClient, seeded: Session) -> None:
    upa = _set_mastery(client, "mount-escape-upa", 4)

    _log(client, TODAY, techniques=[{"technique_id": upa["id"], "kind": "taught"}])

    assert _technique(client, "mount-escape-upa")["mastery"] == 4


def test_editing_a_class_does_not_undo_a_level_lowered_by_hand(
    client: TestClient, seeded: Session
) -> None:
    tripod = _technique(client, "tripod-sweep")
    sickle = _technique(client, "sickle-sweep")
    session = _log(client, TODAY, techniques=[{"technique_id": tripod["id"], "kind": "drilled"}])
    _set_mastery(client, "tripod-sweep", 1)

    client.patch(
        f"/sessions/{session['id']}",
        json={
            "rolling_notes": "edited",
            "techniques": [
                {"technique_id": tripod["id"], "kind": "drilled"},
                {"technique_id": sickle["id"], "kind": "drilled"},
            ],
        },
    )

    assert _technique(client, "tripod-sweep")["mastery"] == 1  # kept as set by hand
    assert _technique(client, "sickle-sweep")["mastery"] == 2  # newly added: raised


def test_deleting_a_class_keeps_mastery(client: TestClient, seeded: Session) -> None:
    sickle = _technique(client, "sickle-sweep")
    session = _log(client, TODAY, techniques=[{"technique_id": sickle["id"], "kind": "drilled"}])

    client.delete(f"/sessions/{session['id']}")

    assert _technique(client, "sickle-sweep")["mastery"] == 2


def test_top_mistake_this_month(client: TestClient, seeded: Session) -> None:
    dlr = _technique(client, "dlr-hook-entry-and-retention")
    hook = {"technique_id": dlr["id"], "category": "hook_retention"}
    _log(client, "2026-11-01", mistakes=[{**hook, "description": "Hook too shallow"}])
    _log(
        client,
        "2026-11-02",
        mistakes=[
            {**hook, "description": "Lost the hook when he stepped back"},
            {"category": "posture", "description": "Sat flat on my butt"},
        ],
    )
    _log(client, "2026-10-20", mistakes=[{"category": "posture", "description": "Flat again"}])

    top = _progress(client)["top_mistake"]

    assert top["count"] == 2
    assert top["category"] == "hook_retention"
    assert top["description"] == "Lost the hook when he stepped back"
    assert top["technique"]["slug"] == "dlr-hook-entry-and-retention"
    assert top["position"] is None


def test_fixed_mistakes_are_not_the_top_mistake(client: TestClient) -> None:
    session = _log(client, TODAY, mistakes=[{"description": "Crossed ankles too low"}])
    client.patch(f"/mistakes/{session['mistakes'][0]['id']}", json={"status": "fixed"})

    assert _progress(client)["top_mistake"] is None


def test_progress_requires_login(client: TestClient) -> None:
    del client.headers["Authorization"]

    assert client.get("/progress").status_code == 401
    assert client.get("/profile").status_code == 401


# ---- Unlocks -------------------------------------------------------------------


def test_locked_flags_follow_prerequisites(client: TestClient, seeded: Session) -> None:
    techniques = {t["slug"]: t for t in client.get("/techniques").json()}

    assert techniques["sit-down-guard-pull"]["locked"] is False  # no prerequisites
    assert techniques["tripod-sweep"]["locked"] is False  # DLR hook and grips are Drilled
    assert techniques["dlr-back-take"]["locked"] is True  # tripod is only Seen
    assert techniques["berimbolo"]["locked"] is True
    assert techniques["dlr-back-take"]["mastery_name"] == "Not started"


def test_raising_a_technique_to_drilled_unlocks_the_next_one(
    client: TestClient, seeded: Session
) -> None:
    tripod = _set_mastery(client, "tripod-sweep", 2)

    # The response already shows the technique it unlocked.
    assert [(u["slug"], u["locked"]) for u in tripod["unlocks"]] == [("dlr-back-take", False)]
    back_take = _technique(client, "dlr-back-take")
    assert back_take["locked"] is False
    assert back_take["prereqs"][0]["locked"] is False
    # The next one in the chain still waits for the back take.
    assert _technique(client, "berimbolo")["locked"] is True


def test_dropping_a_prerequisite_below_drilled_locks_again(
    client: TestClient, seeded: Session
) -> None:
    _set_mastery(client, "dlr-grips", 1)

    assert _technique(client, "tripod-sweep")["locked"] is True
    assert _technique(client, "sickle-sweep")["locked"] is True
    # Mastery is kept: a locked technique can still be Seen.
    assert _technique(client, "tripod-sweep")["mastery"] == 1


def test_a_technique_unlocks_only_when_every_prerequisite_is_drilled(
    client: TestClient, seeded: Session
) -> None:
    # Pull to DLR needs the collar-sleeve pull and the DLR hook.
    _set_mastery(client, "collar-sleeve-guard-pull", 1)
    assert _technique(client, "pull-to-de-la-riva")["locked"] is True

    _set_mastery(client, "collar-sleeve-guard-pull", 2)
    assert _technique(client, "pull-to-de-la-riva")["locked"] is False


def test_logging_a_drill_can_unlock_a_technique(client: TestClient, seeded: Session) -> None:
    tripod = _technique(client, "tripod-sweep")

    _log(client, TODAY, techniques=[{"technique_id": tripod["id"], "kind": "drilled"}])

    assert _technique(client, "dlr-back-take")["locked"] is False
