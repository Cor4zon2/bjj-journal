import json
from pathlib import Path

from app.main import create_app

SNAPSHOT = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"


def test_frontend_openapi_snapshot_is_up_to_date() -> None:
    """The frontend's API types are generated from this file; run `make api-types` if it fails."""
    assert json.loads(SNAPSHOT.read_text(encoding="utf-8")) == create_app().openapi()
