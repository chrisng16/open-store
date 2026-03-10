"""add ingested_at to menu imports

Revision ID: e8b0f34419d2
Revises: c42f6a4bd910
Create Date: 2026-03-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e8b0f34419d2"
down_revision: Union[str, None] = "c42f6a4bd910"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("menu_imports", sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("menu_imports", "ingested_at")
