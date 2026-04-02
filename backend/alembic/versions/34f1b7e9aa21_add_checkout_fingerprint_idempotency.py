"""add checkout fingerprint idempotency

Revision ID: 34f1b7e9aa21
Revises: 7a4d2f61c8be
Create Date: 2026-04-01 19:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "34f1b7e9aa21"
down_revision: Union[str, None] = "7a4d2f61c8be"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("checkout_fingerprint", sa.String(length=64), nullable=True))
    op.create_index("ix_orders_checkout_fingerprint", "orders", ["checkout_fingerprint"], unique=False)
    op.create_index(
        "uq_orders_active_checkout_fingerprint",
        "orders",
        ["store_id", "checkout_fingerprint"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending_payment'::orderstatus, 'pending'::orderstatus)"),
    )


def downgrade() -> None:
    op.drop_index("uq_orders_active_checkout_fingerprint", table_name="orders")
    op.drop_index("ix_orders_checkout_fingerprint", table_name="orders")
    op.drop_column("orders", "checkout_fingerprint")
