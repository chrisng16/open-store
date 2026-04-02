"""make order identifiers lazy and add pending payment status

Revision ID: 7a4d2f61c8be
Revises: 23d79a24529e
Create Date: 2026-04-01 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7a4d2f61c8be"
down_revision: Union[str, None] = "23d79a24529e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add enum value so orders can exist before payment confirmation.
    op.execute(sa.text("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'pending_payment'"))

    # Delay human-facing IDs until payment is confirmed.
    op.alter_column("orders", "daily_sequence", existing_type=sa.Integer(), nullable=True)
    op.alter_column("orders", "order_token", existing_type=sa.String(length=8), nullable=True)
    op.alter_column("orders", "order_reference", existing_type=sa.String(length=32), nullable=True)
    op.alter_column("orders", "display_id", existing_type=sa.String(length=16), nullable=True)


def downgrade() -> None:
    op.alter_column("orders", "display_id", existing_type=sa.String(length=16), nullable=False)
    op.alter_column("orders", "order_reference", existing_type=sa.String(length=32), nullable=False)
    op.alter_column("orders", "order_token", existing_type=sa.String(length=8), nullable=False)
    op.alter_column("orders", "daily_sequence", existing_type=sa.Integer(), nullable=False)
    # Enum value removal is intentionally omitted because PostgreSQL does not support
    # dropping enum values safely in-place.
