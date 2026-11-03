from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.core import auth
from app.main import create_app
from tests.tokens import OWNER_ID, SUPABASE_URL, FakeJwks


@pytest.fixture(autouse=True)
def auth_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Every test runs against a fake Supabase project. Env vars win over any local `.env`."""
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)
    monkeypatch.setenv("OWNER_USER_ID", OWNER_ID)
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "")
    monkeypatch.setenv("AUTH_DISABLED", "false")
    monkeypatch.setenv("CORS_ORIGINS", '["http://localhost:5173"]')
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[auth.get_token_verifier] = lambda: auth.TokenVerifier(
        get_settings(), jwks_client=FakeJwks()
    )
    with TestClient(app) as test_client:
        yield test_client
