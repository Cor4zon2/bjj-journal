"""Supabase JWT verification and the single-owner access check."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any, Protocol

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings

AUDIENCE = "authenticated"
ASYMMETRIC_ALGORITHMS = ("ES256", "RS256")
DEV_OWNER_ID = "00000000-0000-0000-0000-000000000000"


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None


class InvalidTokenError(Exception):
    """The token is missing, malformed, expired or not issued by our Supabase project."""


class KeysUnavailableError(Exception):
    """The Supabase JWKS endpoint could not be reached."""


class SigningKeySource(Protocol):
    """What `TokenVerifier` needs from `jwt.PyJWKClient` (lets tests supply keys offline)."""

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK: ...


class TokenVerifier:
    """Verifies Supabase access tokens.

    Tokens signed with asymmetric keys (ES256/RS256, the Supabase default) are checked
    against the project's JWKS. Tokens signed with the legacy shared secret (HS256) are
    accepted only when `SUPABASE_JWT_SECRET` is configured.
    """

    def __init__(self, settings: Settings, jwks_client: SigningKeySource | None = None) -> None:
        self._issuer = settings.jwt_issuer
        self._jwks_url = settings.jwks_url
        self._secret = settings.supabase_jwt_secret
        self._jwks = jwks_client

    def _signing_keys(self) -> SigningKeySource:
        # Created on first use so the app starts (and AUTH_DISABLED works) without Supabase.
        if self._jwks is None:
            self._jwks = jwt.PyJWKClient(self._jwks_url, lifespan=600, timeout=5)
        return self._jwks

    def verify(self, token: str) -> dict[str, Any]:
        try:
            algorithm = jwt.get_unverified_header(token).get("alg")
        except jwt.InvalidTokenError as error:
            raise InvalidTokenError("Malformed token") from error

        key: Any
        if algorithm in ASYMMETRIC_ALGORITHMS:
            try:
                key = self._signing_keys().get_signing_key_from_jwt(token).key
            except jwt.PyJWKClientConnectionError as error:
                raise KeysUnavailableError(str(error)) from error
            except (jwt.PyJWKClientError, jwt.InvalidTokenError) as error:
                raise InvalidTokenError("Unknown signing key") from error
        elif algorithm == "HS256" and self._secret:
            key = self._secret
        else:
            raise InvalidTokenError(f"Unsupported signing algorithm: {algorithm}")

        try:
            return jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                audience=AUDIENCE,
                issuer=self._issuer,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
        except jwt.InvalidTokenError as error:
            raise InvalidTokenError(str(error)) from error


@lru_cache
def _cached_verifier() -> TokenVerifier:
    return TokenVerifier(get_settings())


def get_token_verifier() -> TokenVerifier:
    return _cached_verifier()


bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_owner(
    settings: Annotated[Settings, Depends(get_settings)],
    verifier: Annotated[TokenVerifier, Depends(get_token_verifier)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> CurrentUser:
    """Allow the request only if it carries a valid token for `OWNER_USER_ID`."""
    if settings.auth_disabled:
        return CurrentUser(id=settings.owner_user_id or DEV_OWNER_ID, email=None)

    if credentials is None:
        raise _unauthorized("Not authenticated")

    try:
        claims = verifier.verify(credentials.credentials)
    except KeysUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot reach the auth provider to verify the token",
        ) from error
    except InvalidTokenError as error:
        raise _unauthorized("Invalid or expired token") from error

    if claims["sub"] != settings.owner_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner")

    email = claims.get("email")
    return CurrentUser(id=claims["sub"], email=email if isinstance(email, str) else None)


Owner = Annotated[CurrentUser, Depends(require_owner)]
