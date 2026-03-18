"""add order identifiers and supporting indexes

Revision ID: 5c2e0a7f91b4
Revises: d2c7a9b3c1f0
Create Date: 2026-03-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5c2e0a7f91b4"
down_revision: Union[str, None] = "d2c7a9b3c1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
        op.add_column("orders", sa.Column("daily_sequence", sa.Integer(), nullable=True))
        op.add_column("orders", sa.Column("order_token", sa.String(length=8), nullable=True))
        op.add_column("orders", sa.Column("order_reference", sa.String(length=32), nullable=True))
        op.add_column("orders", sa.Column("display_id", sa.String(length=16), nullable=True))

        # Backfill identifier columns from existing rows using deterministic token/sequence.
        op.execute(
                sa.text(
                        """
                        WITH ranked AS (
                            SELECT
                                id,
                                store_id,
                                created_at,
                                row_number() OVER (
                                    PARTITION BY store_id, (created_at AT TIME ZONE 'UTC')::date
                                    ORDER BY created_at, id
                                ) AS seq
                            FROM orders
                        )
                        UPDATE orders o
                        SET
                            daily_sequence = r.seq,
                            order_token = upper(substr(replace(o.id::text, '-', ''), 1, 4)),
                            order_reference =
                                to_char((o.created_at AT TIME ZONE 'UTC')::date, 'YYYYMMDD')
                                || '-'
                                || upper(substr(replace(o.id::text, '-', ''), 1, 4))
                                || '-'
                                || lpad(r.seq::text, 4, '0'),
                            display_id =
                                upper(substr(replace(o.id::text, '-', ''), 1, 4))
                                || '-'
                                || lpad(r.seq::text, 4, '0')
                        FROM ranked r
                        WHERE r.id = o.id
                        """
                )
    )

        op.alter_column("orders", "daily_sequence", nullable=False)
        op.alter_column("orders", "order_token", nullable=False)
        op.alter_column("orders", "order_reference", nullable=False)
        op.alter_column("orders", "display_id", nullable=False)

        op.create_unique_constraint(
                "uq_orders_store_daily_sequence_token",
                "orders",
                ["store_id", "daily_sequence", "order_token"],
        )
        op.create_index(
                "ix_orders_order_reference",
                "orders",
                ["order_reference"],
                unique=True,
        )
        op.create_index(
                "ix_orders_display_id",
                "orders",
                ["display_id"],
                unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_orders_display_id", table_name="orders")
    op.drop_index("ix_orders_order_reference", table_name="orders")
    op.drop_constraint("uq_orders_store_daily_sequence_token", "orders", type_="unique")
    op.drop_column("orders", "display_id")
    op.drop_column("orders", "order_reference")
    op.drop_column("orders", "order_token")
    op.drop_column("orders", "daily_sequence")
