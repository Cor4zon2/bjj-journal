from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_list_positions(client: TestClient, seeded: Session) -> None:
    response = client.get("/positions")

    assert response.status_code == 200
    slugs = [p["slug"] for p in response.json()]
    assert len(slugs) == 10
    assert "de-la-riva-guard" in slugs


def test_position_crud(client: TestClient) -> None:
    created = client.post("/positions", json={"name": "Half guard", "category": "guard"})
    assert created.status_code == 201
    position = created.json()
    assert position["slug"] == "half-guard"

    updated = client.patch(f"/positions/{position['id']}", json={"description": "One leg in"})
    assert updated.status_code == 200
    assert updated.json()["description"] == "One leg in"
    assert client.get(f"/positions/{position['id']}").json()["description"] == "One leg in"

    assert client.delete(f"/positions/{position['id']}").status_code == 204
    assert client.get(f"/positions/{position['id']}").status_code == 404


def test_duplicate_slug_conflicts(client: TestClient) -> None:
    client.post("/positions", json={"name": "Turtle", "category": "bottom"})

    response = client.post("/positions", json={"name": "Turtle", "category": "bottom"})

    assert response.status_code == 409


def test_invalid_category_is_rejected(client: TestClient) -> None:
    response = client.post("/positions", json={"name": "Spaceship", "category": "orbit"})

    assert response.status_code == 422


def test_deleting_a_position_keeps_its_techniques(client: TestClient, seeded: Session) -> None:
    positions = {p["slug"]: p["id"] for p in client.get("/positions").json()}
    standing = positions["standing"]

    assert client.delete(f"/positions/{standing}").status_code == 204

    pull = client.get("/techniques/by-slug/sit-down-guard-pull").json()
    assert pull["from_position"] is None
    assert pull["to_position"]["slug"] == "closed-guard"
