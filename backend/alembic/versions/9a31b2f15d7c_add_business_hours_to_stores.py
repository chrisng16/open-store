"""add normalized store business hours

Revision ID: 9a31b2f15d7c
Revises: db6fcfbf9f78
Create Date: 2026-02-26 00:00:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "9a31b2f15d7c"
down_revision: Union[str, None] = "db6fcfbf9f78"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "store_business_hours",
        sa.Column("store_id", sa.UUID(), nullable=False),
        sa.Column("day_of_week", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("start_min", sa.Integer(), nullable=True),
        sa.Column("end_min", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("day_of_week IN ('sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat')", name="ck_store_business_hours_day"),
        sa.CheckConstraint("status IN ('open24', 'closed', 'ranges')", name="ck_store_business_hours_status"),
        sa.CheckConstraint(
            "((status = 'ranges' AND start_min IS NOT NULL AND end_min IS NOT NULL AND end_min > start_min) "
            "OR (status IN ('open24', 'closed') AND start_min IS NULL AND end_min IS NULL))",
            name="ck_store_business_hours_range_shape",
        ),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", "day_of_week", "sort_order", name="uq_store_business_hour_slot"),
    )
    op.create_index(op.f("ix_store_business_hours_store_id"), "store_business_hours", ["store_id"], unique=False)

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    store_columns = {column["name"] for column in inspector.get_columns("stores")}

    if "business_hours" in store_columns:
        stores = bind.execute(
            sa.text("SELECT id, business_hours FROM stores WHERE business_hours IS NOT NULL")
        ).mappings()

        for store in stores:
            business_hours = store["business_hours"] or {}
            for day_of_week in ("sun", "mon", "tue", "wed", "thu", "fri", "sat"):
                day_data = business_hours.get(day_of_week)
                if not day_data:
                    continue

                status = day_data.get("status")
                if status == "ranges":
                    for sort_order, hour_range in enumerate(day_data.get("ranges", [])):
                        bind.execute(
                            sa.text(
                                """
                                INSERT INTO store_business_hours
                                    (id, store_id, day_of_week, status, start_min, end_min, sort_order)
                                VALUES
                                    (:id, :store_id, :day_of_week, :status, :start_min, :end_min, :sort_order)
                                """
                            ),
                            {
                                "id": uuid.uuid4(),
                                "store_id": store["id"],
                                "day_of_week": day_of_week,
                                "status": "ranges",
                                "start_min": hour_range.get("start_min"),
                                "end_min": hour_range.get("end_min"),
                                "sort_order": sort_order,
                            },
                        )
                elif status in ("open24", "closed"):
                    bind.execute(
                        sa.text(
                            """
                            INSERT INTO store_business_hours
                                (id, store_id, day_of_week, status, start_min, end_min, sort_order)
                            VALUES
                                (:id, :store_id, :day_of_week, :status, NULL, NULL, 0)
                            """
                        ),
                        {
                            "id": uuid.uuid4(),
                            "store_id": store["id"],
                            "day_of_week": day_of_week,
                            "status": status,
                        },
                    )

        op.drop_column("stores", "business_hours")


def downgrade() -> None:
    op.add_column(
        "stores",
        sa.Column("business_hours", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.drop_index(op.f("ix_store_business_hours_store_id"), table_name="store_business_hours")
    op.drop_table("store_business_hours")
