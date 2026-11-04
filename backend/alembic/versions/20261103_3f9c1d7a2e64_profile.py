"""Profile: belt, stripes and focus techniques (a single row).

Revision ID: 3f9c1d7a2e64
Revises: 6be2593b96ba
Create Date: 2026-11-03 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3f9c1d7a2e64"
down_revision: str | Sequence[str] | None = "6be2593b96ba"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    profile = op.create_table(
        "profile",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("belt", sa.String(length=20), nullable=False),
        sa.Column("stripes", sa.Integer(), nullable=False),
        sa.Column("focus_technique_ids", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "belt IN ('white', 'blue', 'purple', 'brown', 'black')",
            name=op.f("ck_profile_belt"),
        ),
        sa.CheckConstraint("stripes BETWEEN 0 AND 4", name=op.f("ck_profile_stripes")),
        sa.CheckConstraint("id = 1", name=op.f("ck_profile_single_row")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_profile")),
    )
    # Starting point: white belt, 1 stripe.
    op.bulk_insert(profile, [{"id": 1, "belt": "white", "stripes": 1, "focus_technique_ids": []}])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("profile")
