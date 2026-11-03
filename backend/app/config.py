from functools import lru_cache
from typing import Self

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables or a `.env` file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "BJJ Journal API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://bjj:bjj@localhost:5432/bjj_journal"
    cors_origins: list[str] = ["http://localhost:5173"]

    # Supabase Auth. The API trusts JWTs issued by `{supabase_url}/auth/v1`.
    supabase_url: str = ""
    # Only needed for projects still on the legacy shared HS256 secret. Projects on
    # asymmetric signing keys (the Supabase default) are verified through JWKS instead.
    supabase_jwt_secret: str = ""
    # Supabase user id (UUID) of the single account allowed to use the API.
    owner_user_id: str = ""
    # Local development only: skip JWT checks and treat every request as the owner.
    auth_disabled: bool = False

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        """Accept the plain `postgres://` / `postgresql://` URLs Supabase and Render hand out."""
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value

    @field_validator("supabase_url")
    @classmethod
    def strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @model_validator(mode="after")
    def check_auth_config(self) -> Self:
        if self.auth_disabled:
            if self.is_production:
                raise ValueError("AUTH_DISABLED must not be set in production")
            return self
        missing = [
            name
            for name, value in (
                ("SUPABASE_URL", self.supabase_url),
                ("OWNER_USER_ID", self.owner_user_id),
            )
            if not value
        ]
        if missing:
            raise ValueError(
                f"Missing {', '.join(missing)}. Set them, or set AUTH_DISABLED=true for local dev."
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def jwt_issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.jwt_issuer}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
