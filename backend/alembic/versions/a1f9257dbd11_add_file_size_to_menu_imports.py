"""add file size to menu imports

Revision ID: a1f9257dbd11
Revises: f4d8a6a1c9bb
Create Date: 2026-03-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1f9257dbd11"
down_revision: Union[str, None] = "f4d8a6a1c9bb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("menu_imports", sa.Column("file_size_bytes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("menu_imports", "file_size_bytes")
