"""finalize pending payment state

Revision ID: c6f2e97ab4d1
Revises: 83b9d4e2a1c7
Create Date: 2026-04-01 20:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c6f2e97ab4d1"
down_revision: Union[str, None] = "83b9d4e2a1c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Migrate legacy pending rows into the canonical pre-payment status.
    op.execute(
        sa.text(
            """
            UPDATE orders
            SET status = 'pending_payment'::orderstatus
            WHERE status = 'pending'::orderstatus
            """
        )
    )

    # Tighten checkout idempotency uniqueness to the canonical pre-payment status.
    op.drop_index("uq_orders_active_checkout_fingerprint", table_name="orders")
    op.create_index(
        "uq_orders_active_checkout_fingerprint",
        "orders",
        ["store_id", "checkout_fingerprint"],
        unique=True,
        postgresql_where=sa.text("status = 'pending_payment'::orderstatus"),
    )


def downgrade() -> None:
    op.drop_index("uq_orders_active_checkout_fingerprint", table_name="orders")
    op.create_index(
        "uq_orders_active_checkout_fingerprint",
        "orders",
        ["store_id", "checkout_fingerprint"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending_payment'::orderstatus, 'pending'::orderstatus)"),
    )
