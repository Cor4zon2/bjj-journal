from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Engine, inspect

from app.db import Base
from tests.conftest import run_alembic


def test_migrations_match_models(engine: Engine) -> None:
    with engine.connect() as connection:
        context = MigrationContext.configure(
            connection, opts={"compare_type": True, "render_as_batch": True}
        )
        diff = compare_metadata(context, Base.metadata)

    assert diff == []


def test_downgrade_and_upgrade_again(engine: Engine) -> None:
    run_alembic(engine, "downgrade", "base")
    assert "technique" not in inspect(engine).get_table_names()

    run_alembic(engine, "upgrade", "head")
    assert {"position", "technique", "technique_prereq", "video_link", "common_mistake"} <= set(
        inspect(engine).get_table_names()
    )
