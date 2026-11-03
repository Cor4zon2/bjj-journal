"""Test fixtures.

Tests run against an in-memory SQLite database by default. Set `TEST_DATABASE_URL` to run
them against Postgres instead (CI does); that database is wiped by the tests.
The schema is always built by running the Alembic migrations, so migrations are tested too.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, StaticPool, text
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.db import Base, get_db, make_engine
from app.main import create_app
from app.seed.loader import load_seed, read_seed_file

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite://")


def alembic_config(engine: Engine) -> Config:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.attributes["configure_logger"] = False
    return config


def run_alembic(engine: Engine, action: str, revision: str) -> None:
    config = alembic_config(engine)
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        getattr(command, action)(config, revision)


def drop_everything(engine: Engine) -> None:
    Base.metadata.drop_all(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    if TEST_DATABASE_URL.startswith("sqlite"):
        test_engine = make_engine(
            TEST_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    else:
        test_engine = make_engine(TEST_DATABASE_URL)
    drop_everything(test_engine)
    run_alembic(test_engine, "upgrade", "head")
    yield test_engine
    test_engine.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture
def db(engine: Engine, session_factory: sessionmaker[Session]) -> Iterator[Session]:
    """A session for setting up and inspecting data directly. Tables are emptied afterwards."""
    with session_factory() as session:
        yield session
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())


@pytest.fixture
def client(db: Session, session_factory: sessionmaker[Session]) -> Iterator[TestClient]:
    """API client; like in production, every request gets its own session."""
    app = create_app()

    def _get_db() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def seeded(db: Session) -> Session:
    load_seed(db, read_seed_file())
    return db
