import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.core import auth
from app.main import create_app
from tests.tokens import (
    HS256_SECRET,
    OTHER_PRIVATE_KEY,
    OWNER_ID,
    STRANGER_ID,
    UnreachableJwks,
    bearer,
    claims,
    es256_token,
    hs256_token,
)


def test_owner_with_valid_token_gets_through(client: TestClient) -> None:
    response = client.get("/me", headers=bearer(es256_token()))

    assert response.status_code == 200
    assert response.json() == {"id": OWNER_ID, "email": "owner@example.com"}


def test_missing_token_is_unauthorized(client: TestClient) -> None:
    response = client.get("/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_other_user_is_forbidden(client: TestClient) -> None:
    response = client.get("/me", headers=bearer(es256_token(sub=STRANGER_ID)))

    assert response.status_code == 403


@pytest.mark.parametrize(
    "token",
    [
        pytest.param("not-a-jwt", id="garbage"),
        pytest.param(es256_token(exp=int(time.time()) - 10), id="expired"),
        pytest.param(es256_token(aud="anon"), id="wrong-audience"),
        pytest.param(es256_token(iss="https://evil.supabase.co/auth/v1"), id="wrong-issuer"),
        pytest.param(es256_token(key=OTHER_PRIVATE_KEY), id="forged-signature"),
        pytest.param(es256_token(exp=None), id="no-expiry"),
        pytest.param(hs256_token(), id="hs256-without-configured-secret"),
    ],
)
def test_invalid_tokens_are_unauthorized(client: TestClient, token: str) -> None:
    response = client.get("/me", headers=bearer(token))

    assert response.status_code == 401


def test_unsigned_token_is_rejected(client: TestClient) -> None:
    token = jwt.encode(claims(), key="", algorithm="none")

    assert client.get("/me", headers=bearer(token)).status_code == 401


def test_legacy_hs256_secret_is_supported(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", HS256_SECRET)
    get_settings.cache_clear()
    app = create_app()
    app.dependency_overrides[auth.get_token_verifier] = lambda: auth.TokenVerifier(
        get_settings(), jwks_client=UnreachableJwks()
    )

    with TestClient(app) as client:
        assert client.get("/me", headers=bearer(hs256_token())).status_code == 200
        assert client.get("/me", headers=bearer(hs256_token(secret="x" * 40))).status_code == 401


def test_unreachable_jwks_is_service_unavailable() -> None:
    app = create_app()
    app.dependency_overrides[auth.get_token_verifier] = lambda: auth.TokenVerifier(
        get_settings(), jwks_client=UnreachableJwks()
    )

    with TestClient(app) as client:
        assert client.get("/me", headers=bearer(es256_token())).status_code == 503


def test_health_stays_public(client: TestClient) -> None:
    assert client.get("/health").status_code == 200


def test_auth_disabled_lets_requests_through_in_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("OWNER_USER_ID", "")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        response = client.get("/me")

    assert response.status_code == 200
    assert response.json()["id"] == auth.DEV_OWNER_ID


def test_auth_disabled_is_refused_in_production() -> None:
    with pytest.raises(ValueError, match="AUTH_DISABLED"):
        Settings(environment="production", auth_disabled=True)


def test_auth_settings_are_required_unless_disabled() -> None:
    with pytest.raises(ValueError, match="SUPABASE_URL, OWNER_USER_ID"):
        Settings(supabase_url="", owner_user_id="")


@pytest.mark.parametrize(
    "url",
    [
        "postgres://u:p@host:5432/db",
        "postgresql://u:p@host:5432/db",
        "postgresql+psycopg://u:p@host:5432/db",
    ],
)
def test_database_url_uses_psycopg_driver(url: str) -> None:
    assert Settings(database_url=url).database_url == "postgresql+psycopg://u:p@host:5432/db"
