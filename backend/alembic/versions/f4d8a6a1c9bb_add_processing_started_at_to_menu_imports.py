"""add processing_started_at to menu imports

Revision ID: f4d8a6a1c9bb
Revises: e8b0f34419d2
Create Date: 2026-03-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f4d8a6a1c9bb"
down_revision: Union[str, None] = "e8b0f34419d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("menu_imports", sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("menu_imports", "processing_started_at")
