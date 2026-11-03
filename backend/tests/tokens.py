"""Helpers for minting Supabase-shaped JWTs in tests."""

import time
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec

SUPABASE_URL = "https://test-project.supabase.co"
ISSUER = f"{SUPABASE_URL}/auth/v1"
OWNER_ID = "11111111-1111-1111-1111-111111111111"
STRANGER_ID = "22222222-2222-2222-2222-222222222222"
HS256_SECRET = "legacy-secret-at-least-32-bytes-long!!"
KEY_ID = "test-key"

PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())


class FakeJwks:
    """Stands in for the project's JWKS endpoint, serving one ES256 public key."""

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        if jwt.get_unverified_header(token).get("kid") != KEY_ID:
            raise jwt.PyJWKClientError("Unable to find a signing key that matches")
        jwk = jwt.algorithms.ECAlgorithm.to_jwk(PRIVATE_KEY.public_key(), as_dict=True)
        return jwt.PyJWK({**jwk, "kid": KEY_ID, "alg": "ES256"})


class UnreachableJwks:
    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        raise jwt.PyJWKClientConnectionError("connection refused")


def claims(**overrides: Any) -> dict[str, Any]:
    now = int(time.time())
    base: dict[str, Any] = {
        "sub": OWNER_ID,
        "email": "owner@example.com",
        "aud": "authenticated",
        "iss": ISSUER,
        "role": "authenticated",
        "iat": now,
        "exp": now + 3600,
    }
    base.update(overrides)
    return {key: value for key, value in base.items() if value is not None}


def es256_token(key: ec.EllipticCurvePrivateKey = PRIVATE_KEY, **overrides: Any) -> str:
    return jwt.encode(claims(**overrides), key, algorithm="ES256", headers={"kid": KEY_ID})


def hs256_token(secret: str = HS256_SECRET, **overrides: Any) -> str:
    return jwt.encode(claims(**overrides), secret, algorithm="HS256")


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
