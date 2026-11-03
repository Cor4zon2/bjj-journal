from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import MyMistake, Technique


def _technique(client: TestClient, slug: str) -> dict[str, Any]:
    data: dict[str, Any] = client.get(f"/techniques/by-slug/{slug}").json()
    return data


def _position_id(client: TestClient, slug: str) -> int:
    position_id: int = next(p["id"] for p in client.get("/positions").json() if p["slug"] == slug)
    return position_id


def _log(client: TestClient, **overrides: Any) -> dict[str, Any]:
    tripod = _technique(client, "tripod-sweep")["id"]
    dlr = _technique(client, "dlr-hook-entry-and-retention")["id"]
    body: dict[str, Any] = {
        "date": "2026-11-02",
        "type": "gi_class",
        "duration_min": 90,
        "energy": 4,
        "rolling_notes": "Rolled 5 rounds, hit the tripod once.",
        "techniques": [
            {"technique_id": tripod, "kind": "drilled"},
            {"technique_id": tripod, "kind": "hit_in_rolling"},
            {"technique_id": dlr, "kind": "taught"},
        ],
        "mistakes": [
            {
                "technique_id": dlr,
                "category": "hook_retention",
                "description": "  Lost the DLR hook when he stepped back  ",
            },
            {
                "position_id": _position_id(client, "de-la-riva-guard"),
                "category": "posture",
                "description": "Sat flat on my butt",
            },
        ],
        **overrides,
    }
    response = client.post("/sessions", json=body)
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data


def test_log_a_class_with_techniques_and_mistakes(client: TestClient, seeded: Session) -> None:
    logged = _log(client)

    assert logged["date"] == "2026-11-02"
    assert logged["energy"] == 4
    assert {(t["technique"]["slug"], t["kind"]) for t in logged["techniques"]} == {
        ("tripod-sweep", "drilled"),
        ("tripod-sweep", "hit_in_rolling"),
        ("dlr-hook-entry-and-retention", "taught"),
    }
    first, second = logged["mistakes"]
    assert first["description"] == "Lost the DLR hook when he stepped back"
    assert first["technique"]["slug"] == "dlr-hook-entry-and-retention"
    assert first["status"] == "open"
    assert second["position"]["slug"] == "de-la-riva-guard"
    assert second["technique"] is None

    assert client.get(f"/sessions/{logged['id']}").json() == logged


def test_hits_in_rolling_count_on_the_technique(client: TestClient, seeded: Session) -> None:
    logged = _log(client)
    assert _technique(client, "tripod-sweep")["times_hit"] == 1
    assert _technique(client, "dlr-hook-entry-and-retention")["times_hit"] == 0

    _log(client)
    assert _technique(client, "tripod-sweep")["times_hit"] == 2

    # Editing the class so the tripod was only drilled takes the hit back.
    tripod = _technique(client, "tripod-sweep")["id"]
    client.patch(
        f"/sessions/{logged['id']}",
        json={"techniques": [{"technique_id": tripod, "kind": "drilled"}]},
    )
    assert _technique(client, "tripod-sweep")["times_hit"] == 1

    # Deleting the other class removes its hit too.
    other = client.get("/sessions").json()[0]
    assert other["id"] != logged["id"]
    assert client.delete(f"/sessions/{other['id']}").status_code == 204
    assert _technique(client, "tripod-sweep")["times_hit"] == 0


def test_duplicate_technique_rows_are_merged(client: TestClient, seeded: Session) -> None:
    tripod = _technique(client, "tripod-sweep")["id"]
    row = {"technique_id": tripod, "kind": "drilled"}

    logged = _log(client, techniques=[row, row], mistakes=[])

    assert len(logged["techniques"]) == 1


def test_retried_save_does_not_duplicate(client: TestClient, seeded: Session) -> None:
    first = _log(client, client_id="draft-123")

    retry = client.post(
        "/sessions", json={"client_id": "draft-123", "date": "2026-11-02", "type": "gi_class"}
    )

    assert retry.status_code == 200
    assert retry.json()["id"] == first["id"]
    assert len(client.get("/sessions").json()) == 1
    assert _technique(client, "tripod-sweep")["times_hit"] == 1


def test_minimal_class(client: TestClient, seeded: Session) -> None:
    response = client.post("/sessions", json={"date": "2026-11-03"})

    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "gi_class"
    assert data["techniques"] == []
    assert data["energy"] is None


def test_history_is_newest_first(client: TestClient, seeded: Session) -> None:
    _log(client, date="2026-10-01", mistakes=[], techniques=[])
    _log(client, date="2026-11-01", mistakes=[], techniques=[])
    _log(client, date="2026-10-15", mistakes=[], techniques=[])

    dates = [s["date"] for s in client.get("/sessions").json()]

    assert dates == ["2026-11-01", "2026-10-15", "2026-10-01"]
    assert len(client.get("/sessions", params={"limit": 1}).json()) == 1


def test_invalid_class_is_rejected(client: TestClient, seeded: Session) -> None:
    def post(**body: Any) -> int:
        status: int = client.post("/sessions", json={"date": "2026-11-02", **body}).status_code
        return status

    assert post(energy=6) == 422
    assert post(type="nap") == 422
    assert post(duration_min=0) == 422
    assert post(techniques=[{"technique_id": 99999, "kind": "drilled"}]) == 422
    assert post(mistakes=[{"description": "x", "technique_id": 99999}]) == 422
    assert post(mistakes=[{"description": "x", "position_id": 99999}]) == 422
    assert post(mistakes=[{"description": "   "}]) == 422
    assert post(mistakes=[{"description": "x", "category": "vibes"}]) == 422
    assert client.get("/sessions").json() == []


def test_edit_class_fields_and_mistakes(client: TestClient, seeded: Session) -> None:
    logged = _log(client)
    kept, dropped = logged["mistakes"]

    response = client.patch(
        f"/sessions/{logged['id']}",
        json={
            "energy": None,
            "rolling_notes": "Edited",
            "mistakes": [
                {**kept, "description": "Lost the hook again", "status": "working"},
                {"category": "grips", "description": "No sleeve grip"},
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["energy"] is None
    assert data["duration_min"] == 90  # untouched
    assert data["rolling_notes"] == "Edited"
    assert len(data["techniques"]) == 3  # untouched
    assert [(m["description"], m["status"]) for m in data["mistakes"]] == [
        ("Lost the hook again", "working"),
        ("No sleeve grip", "open"),
    ]
    assert data["mistakes"][0]["id"] == kept["id"]
    ids = {m["id"] for m in client.get("/mistakes").json()}
    assert dropped["id"] not in ids


def test_cannot_move_another_class_mistake(client: TestClient, seeded: Session) -> None:
    first = _log(client)
    second = _log(client, mistakes=[])

    response = client.patch(
        f"/sessions/{second['id']}",
        json={"mistakes": [{"id": first["mistakes"][0]["id"], "description": "steal"}]},
    )

    assert response.status_code == 422


def test_delete_class_deletes_its_mistakes(client: TestClient, seeded: Session) -> None:
    logged = _log(client)

    assert client.delete(f"/sessions/{logged['id']}").status_code == 204

    assert client.get(f"/sessions/{logged['id']}").status_code == 404
    assert client.get("/mistakes").json() == []
    assert client.delete(f"/sessions/{logged['id']}").status_code == 404


def test_deleting_a_technique_keeps_the_mistake(
    client: TestClient, seeded: Session, db: Session
) -> None:
    logged = _log(client)
    technique_id = logged["mistakes"][0]["technique_id"]

    client.delete(f"/techniques/{technique_id}")

    mistake = db.get(MyMistake, logged["mistakes"][0]["id"])
    assert mistake is not None
    assert mistake.technique_id is None


# ---- Mistakes ------------------------------------------------------------------


def test_mistakes_list_and_filters(client: TestClient, seeded: Session) -> None:
    logged = _log(client)
    dlr = _technique(client, "dlr-hook-entry-and-retention")["id"]

    mistakes = client.get("/mistakes").json()
    assert len(mistakes) == 2
    assert mistakes[0]["session"] == {"id": logged["id"], "date": "2026-11-02", "type": "gi_class"}

    by_technique = client.get("/mistakes", params={"technique_id": dlr}).json()
    assert [m["category"] for m in by_technique] == ["hook_retention"]
    assert client.get("/mistakes", params={"status": "fixed"}).json() == []
    assert client.get("/mistakes", params={"status": "nope"}).status_code == 422


def test_mistake_status_flow(client: TestClient, seeded: Session) -> None:
    mistake_id = _log(client)["mistakes"][0]["id"]

    def set_status(value: str) -> dict[str, Any]:
        response = client.patch(f"/mistakes/{mistake_id}", json={"status": value})
        assert response.status_code == 200
        data: dict[str, Any] = response.json()
        return data

    assert set_status("working")["fixed_at"] is None
    working = client.get("/mistakes", params={"status": "working"}).json()
    assert [m["id"] for m in working] == [mistake_id]
    fixed = set_status("fixed")
    assert fixed["status"] == "fixed"
    assert fixed["fixed_at"] is not None
    # Saving "fixed" again keeps the original date.
    assert set_status("fixed")["fixed_at"] == fixed["fixed_at"]
    assert set_status("open")["fixed_at"] is None


def test_edit_and_delete_mistake(client: TestClient, seeded: Session) -> None:
    mistake = _log(client)["mistakes"][0]

    response = client.patch(
        f"/mistakes/{mistake['id']}",
        json={"technique_id": None, "description": "Hook too shallow", "category": "timing"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["technique"] is None
    assert data["description"] == "Hook too shallow"
    assert data["category"] == "timing"

    assert client.patch(f"/mistakes/{mistake['id']}", json={"description": "  "}).status_code == 422
    assert client.patch(f"/mistakes/{mistake['id']}", json={"position_id": 999}).status_code == 422
    assert client.delete(f"/mistakes/{mistake['id']}").status_code == 204
    assert client.patch(f"/mistakes/{mistake['id']}", json={"status": "fixed"}).status_code == 404


def test_standalone_mistake(client: TestClient, seeded: Session, db: Session) -> None:
    technique = db.query(Technique).filter_by(slug="scissor-sweep").one()

    response = client.post(
        "/mistakes",
        json={"technique_id": technique.id, "category": "timing", "description": "Too slow"},
    )

    assert response.status_code == 201
    assert response.json()["session"] is None
    assert response.json()["technique"]["slug"] == "scissor-sweep"
    assert client.post("/mistakes", json={"description": "x", "session_id": 999}).status_code == 404
