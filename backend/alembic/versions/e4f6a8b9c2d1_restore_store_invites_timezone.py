"""restore store_invites timezone-aware timestamps

Revision ID: e4f6a8b9c2d1
Revises: 23d79a24529e
Create Date: 2026-04-07 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e4f6a8b9c2d1"
down_revision: Union[str, None] = "23d79a24529e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "store_invites",
        "expires_at",
        existing_type=sa.DateTime(),
        type_=postgresql.TIMESTAMP(timezone=True),
        existing_nullable=False,
        postgresql_using="expires_at AT TIME ZONE 'UTC'",
    )
    op.alter_column(
        "store_invites",
        "accepted_at",
        existing_type=sa.DateTime(),
        type_=postgresql.TIMESTAMP(timezone=True),
        existing_nullable=True,
        postgresql_using="accepted_at AT TIME ZONE 'UTC'",
    )


def downgrade() -> None:
    op.alter_column(
        "store_invites",
        "accepted_at",
        existing_type=postgresql.TIMESTAMP(timezone=True),
        type_=sa.DateTime(),
        existing_nullable=True,
        postgresql_using="accepted_at AT TIME ZONE 'UTC'",
    )
    op.alter_column(
        "store_invites",
        "expires_at",
        existing_type=postgresql.TIMESTAMP(timezone=True),
        type_=sa.DateTime(),
        existing_nullable=False,
        postgresql_using="expires_at AT TIME ZONE 'UTC'",
    )
