from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _by_slug(client: TestClient, slug: str) -> dict[str, Any]:
    response = client.get(f"/techniques/by-slug/{slug}")
    assert response.status_code == 200
    data: dict[str, Any] = response.json()
    return data


def _position_id(client: TestClient, slug: str) -> int:
    position_id: int = next(p["id"] for p in client.get("/positions").json() if p["slug"] == slug)
    return position_id


def _names(response: Any) -> set[str]:
    return {t["slug"] for t in response.json()}


def test_list_all_techniques(client: TestClient, seeded: Session) -> None:
    response = client.get("/techniques")

    assert response.status_code == 200
    techniques = response.json()
    assert len(techniques) == 17
    first = techniques[0]
    assert set(first) >= {"id", "slug", "name", "type", "mastery", "mastery_name", "from_position"}
    assert "steps" not in first  # list rows stay small


def test_filter_by_position(client: TestClient, seeded: Session) -> None:
    dlr = _position_id(client, "de-la-riva-guard")

    slugs = _names(client.get("/techniques", params={"position_id": dlr}))

    # Starts in DLR, or ends there (the pull and the hook entry).
    assert {"tripod-sweep", "berimbolo", "pull-to-de-la-riva", "dlr-hook-entry-and-retention"} <= (
        slugs
    )
    assert "scissor-sweep" not in slugs


def test_filter_by_type_and_mastery(client: TestClient, seeded: Session) -> None:
    pulls = _names(client.get("/techniques", params={"type": "pull"}))
    locked = _names(client.get("/techniques", params={"mastery": 0}))
    drilled_plus = _names(client.get("/techniques", params={"min_mastery": 2}))

    assert pulls == {"sit-down-guard-pull", "collar-sleeve-guard-pull", "pull-to-de-la-riva"}
    assert locked == {"dlr-back-take", "berimbolo"}
    assert "sit-down-guard-pull" in drilled_plus
    assert "tripod-sweep" not in drilled_plus


def test_search(client: TestClient, seeded: Session) -> None:
    assert _names(client.get("/techniques", params={"q": "SWEEP"})) >= {
        "tripod-sweep",
        "sickle-sweep",
        "scissor-sweep",
        "hip-bump-sweep",
    }
    assert _names(client.get("/techniques", params={"q": "scissor"})) == {"scissor-sweep"}
    # Summaries are searched too.
    assert "berimbolo" in _names(client.get("/techniques", params={"q": "inverted spin"}))


def test_invalid_filters_are_rejected(client: TestClient) -> None:
    assert client.get("/techniques", params={"mastery": 9}).status_code == 422
    assert client.get("/techniques", params={"type": "dance"}).status_code == 422


def test_technique_detail(client: TestClient, seeded: Session) -> None:
    technique = _by_slug(client, "dlr-back-take")

    assert technique["mastery_name"] == "Locked"
    assert technique["steps"]
    assert technique["key_details"]
    assert technique["common_mistakes"][0]["fix"]
    assert [p["slug"] for p in technique["prereqs"]] == ["tripod-sweep"]
    assert [u["slug"] for u in technique["unlocks"]] == ["berimbolo"]
    assert client.get(f"/techniques/{technique['id']}").json() == technique


def test_missing_technique_is_404(client: TestClient) -> None:
    assert client.get("/techniques/999").status_code == 404
    assert client.get("/techniques/by-slug/nope").status_code == 404
    assert client.patch("/techniques/999", json={"notes": "x"}).status_code == 404


def test_create_technique(client: TestClient, seeded: Session) -> None:
    closed_guard = _position_id(client, "closed-guard")
    posture = _by_slug(client, "closed-guard-posture-break")

    response = client.post(
        "/techniques",
        json={
            "name": "Kimura from closed guard",
            "type": "submission",
            "stat": "submissions",
            "from_position_id": closed_guard,
            "steps": ["Grab the wrist", "  ", "Figure-four grip "],
            "prereq_ids": [posture["id"]],
        },
    )

    assert response.status_code == 201
    created = response.json()
    assert created["slug"] == "kimura-from-closed-guard"
    assert created["steps"] == ["Grab the wrist", "Figure-four grip"]
    assert created["mastery"] == 0
    assert created["from_position"]["slug"] == "closed-guard"
    assert [p["slug"] for p in created["prereqs"]] == ["closed-guard-posture-break"]


def test_create_rejects_unknown_references(client: TestClient) -> None:
    base = {"name": "Thing", "type": "sweep", "stat": "sweeps"}

    assert client.post("/techniques", json={**base, "from_position_id": 999}).status_code == 422
    assert client.post("/techniques", json={**base, "prereq_ids": [999]}).status_code == 422


def test_edit_notes_steps_and_mastery(client: TestClient, seeded: Session) -> None:
    tripod = _by_slug(client, "tripod-sweep")

    response = client.patch(
        f"/techniques/{tripod['id']}",
        json={
            "notes": "Pull the ankle hard!",
            "steps": ["Ankle grip", "Foot on hip", "Push and pull"],
            "key_details": ["Opposite directions"],
            "mastery": 3,
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["notes"] == "Pull the ankle hard!"
    assert updated["steps"] == ["Ankle grip", "Foot on hip", "Push and pull"]
    assert updated["key_details"] == ["Opposite directions"]
    assert updated["mastery"] == 3
    assert updated["mastery_name"] == "Hit in rolling"
    # Untouched fields stay as they were.
    assert updated["name"] == tripod["name"]
    assert updated["common_mistakes"] == tripod["common_mistakes"]
    assert _by_slug(client, "tripod-sweep")["notes"] == "Pull the ankle hard!"


def test_mastery_must_be_0_to_5(client: TestClient, seeded: Session) -> None:
    tripod = _by_slug(client, "tripod-sweep")

    assert client.patch(f"/techniques/{tripod['id']}", json={"mastery": 6}).status_code == 422
    assert client.patch(f"/techniques/{tripod['id']}", json={"mastery": -1}).status_code == 422


def test_null_clears_a_position_but_not_other_fields(client: TestClient, seeded: Session) -> None:
    tripod = _by_slug(client, "tripod-sweep")

    response = client.patch(
        f"/techniques/{tripod['id']}", json={"to_position_id": None, "name": None}
    )

    assert response.status_code == 200
    assert response.json()["to_position"] is None
    assert response.json()["name"] == tripod["name"]


def test_prereq_cycles_are_rejected(client: TestClient, seeded: Session) -> None:
    tripod = _by_slug(client, "tripod-sweep")
    berimbolo = _by_slug(client, "berimbolo")  # berimbolo -> back take -> tripod

    cycle = client.patch(f"/techniques/{tripod['id']}", json={"prereq_ids": [berimbolo["id"]]})
    self_ref = client.patch(f"/techniques/{tripod['id']}", json={"prereq_ids": [tripod["id"]]})

    assert cycle.status_code == 422
    assert "cycle" in cycle.json()["detail"]
    assert self_ref.status_code == 422


def test_change_prereqs(client: TestClient, seeded: Session) -> None:
    berimbolo = _by_slug(client, "berimbolo")
    sickle = _by_slug(client, "sickle-sweep")

    response = client.patch(
        f"/techniques/{berimbolo['id']}", json={"prereq_ids": [sickle["id"], sickle["id"]]}
    )

    assert response.status_code == 200
    assert [p["slug"] for p in response.json()["prereqs"]] == ["sickle-sweep"]
    assert "berimbolo" in [u["slug"] for u in _by_slug(client, "sickle-sweep")["unlocks"]]


def test_delete_technique(client: TestClient, seeded: Session) -> None:
    tripod = _by_slug(client, "tripod-sweep")

    assert client.delete(f"/techniques/{tripod['id']}").status_code == 204

    assert client.get(f"/techniques/{tripod['id']}").status_code == 404
    assert _by_slug(client, "dlr-back-take")["prereqs"] == []
    assert len(client.get("/techniques").json()) == 16


def test_video_links(client: TestClient, seeded: Session) -> None:
    tripod = _by_slug(client, "tripod-sweep")

    youtube = client.post(
        f"/techniques/{tripod['id']}/videos",
        json={"url": "https://youtu.be/dQw4w9WgXcQ?t=75", "title": "Tripod breakdown"},
    )
    reel = client.post(
        f"/techniques/{tripod['id']}/videos",
        json={"url": "https://www.instagram.com/reel/C1a2b3c4d5e/"},
    )

    assert youtube.status_code == 201
    assert youtube.json()["source"] == "youtube"
    assert youtube.json()["start_seconds"] == 75
    assert youtube.json()["embed_url"] == (
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=75"
    )
    assert reel.status_code == 201
    assert reel.json()["source"] == "instagram"
    assert reel.json()["embed_url"] is None

    videos = _by_slug(client, "tripod-sweep")["videos"]
    assert [v["id"] for v in videos] == [youtube.json()["id"], reel.json()["id"]]

    renamed = client.patch(f"/videos/{reel.json()['id']}", json={"title": "Coach's reel"})
    assert renamed.json()["title"] == "Coach's reel"

    assert client.delete(f"/videos/{youtube.json()['id']}").status_code == 204
    assert len(_by_slug(client, "tripod-sweep")["videos"]) == 1
    assert client.delete(f"/videos/{youtube.json()['id']}").status_code == 404


def test_video_url_must_be_http(client: TestClient, seeded: Session) -> None:
    tripod = _by_slug(client, "tripod-sweep")

    response = client.post(f"/techniques/{tripod['id']}/videos", json={"url": "javascript:x"})

    assert response.status_code == 422


def test_common_mistakes_crud(client: TestClient, seeded: Session) -> None:
    tripod = _by_slug(client, "tripod-sweep")

    created = client.post(
        f"/techniques/{tripod['id']}/common-mistakes",
        json={"title": "Grip on the wrong ankle", "fix": "Ankle of the hooked leg"},
    )
    assert created.status_code == 201
    mistake_id = created.json()["id"]

    updated = client.patch(f"/common-mistakes/{mistake_id}", json={"why_it_happens": "Rushing"})
    assert updated.json()["why_it_happens"] == "Rushing"
    assert updated.json()["fix"] == "Ankle of the hooked leg"

    assert client.delete(f"/common-mistakes/{mistake_id}").status_code == 204
    assert mistake_id not in [m["id"] for m in _by_slug(client, "tripod-sweep")["common_mistakes"]]
