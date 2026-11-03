from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables or a `.env` file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "BJJ Journal API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://bjj:bjj@localhost:5432/bjj_journal"
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
