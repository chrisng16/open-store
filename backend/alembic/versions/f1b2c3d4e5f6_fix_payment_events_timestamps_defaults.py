"""fix payment_events timestamps defaults

Revision ID: f1b2c3d4e5f6
Revises: c6f2e97ab4d1
Create Date: 2026-04-01 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1b2c3d4e5f6"
down_revision: Union[str, None] = "c6f2e97ab4d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("payment_events", "created_at", server_default=sa.text("now()"))
    op.alter_column("payment_events", "updated_at", server_default=sa.text("now()"))


def downgrade() -> None:
    op.alter_column("payment_events", "updated_at", server_default=None)
    op.alter_column("payment_events", "created_at", server_default=None)
