"""add store roles and member role foreign key

Revision ID: d2c7a9b3c1f0
Revises: b21d5f9473aa
Create Date: 2026-03-10 00:00:00.000000

"""
from __future__ import annotations

import uuid
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d2c7a9b3c1f0"
down_revision: Union[str, None] = "b21d5f9473aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "store_roles",
        sa.Column("store_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("permissions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_editable", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", "name", name="uq_store_roles_store_name"),
    )
    op.create_index(op.f("ix_store_roles_store_id"), "store_roles", ["store_id"], unique=False)

    op.add_column("store_members", sa.Column("store_role_id", sa.UUID(), nullable=True))
    op.create_index(op.f("ix_store_members_store_role_id"), "store_members", ["store_role_id"], unique=False)
    op.create_foreign_key(
        "fk_store_members_store_role_id",
        "store_members",
        "store_roles",
        ["store_role_id"],
        ["id"],
        ondelete="SET NULL",
    )

    _backfill_store_roles_and_members()


def _backfill_store_roles_and_members() -> None:
    bind = op.get_bind()

    stores = bind.execute(sa.text("SELECT id FROM stores")).fetchall()

    default_roles = [
        (
            "owner",
            100,
            [
                "team.members.read",
                "team.members.write",
                "team.roles.read",
                "team.roles.write",
                "team.invites.read",
                "team.invites.write",
            ],
            True,
            False,
            "Store owner role",
        ),
        (
            "admin",
            60,
            [
                "team.members.read",
                "team.members.write",
                "team.roles.read",
                "team.invites.read",
                "team.invites.write",
            ],
            True,
            True,
            "Store admin role",
        ),
        (
            "staff",
            20,
            [
                "team.members.read",
            ],
            True,
            True,
            "Store staff role",
        ),
    ]

    insert_sql = sa.text(
        """
        INSERT INTO store_roles (
            id, store_id, name, description, priority, permissions, is_system, is_editable, created_at, updated_at
        ) VALUES (
            :id, :store_id, :name, :description, :priority, CAST(:permissions AS jsonb), :is_system, :is_editable, now(), now()
        )
        """
    )

    role_ids_by_store_and_name: dict[tuple[uuid.UUID, str], uuid.UUID] = {}
    for (store_id,) in stores:
        for name, priority, permissions, is_system, is_editable, description in default_roles:
            role_id = uuid.uuid4()
            bind.execute(
                insert_sql,
                {
                    "id": role_id,
                    "store_id": store_id,
                    "name": name,
                    "description": description,
                    "priority": priority,
                    "permissions": json.dumps(permissions),
                    "is_system": is_system,
                    "is_editable": is_editable,
                },
            )
            role_ids_by_store_and_name[(store_id, name)] = role_id

    members = bind.execute(sa.text("SELECT id, store_id, role::text FROM store_members")).fetchall()
    update_sql = sa.text("UPDATE store_members SET store_role_id = :store_role_id WHERE id = :member_id")

    for member_id, store_id, role_name in members:
        mapped_role_id = role_ids_by_store_and_name.get((store_id, role_name))
        if mapped_role_id is None:
            mapped_role_id = role_ids_by_store_and_name.get((store_id, "staff"))
        bind.execute(update_sql, {"store_role_id": mapped_role_id, "member_id": member_id})


def downgrade() -> None:
    op.drop_constraint("fk_store_members_store_role_id", "store_members", type_="foreignkey")
    op.drop_index(op.f("ix_store_members_store_role_id"), table_name="store_members")
    op.drop_column("store_members", "store_role_id")

    op.drop_index(op.f("ix_store_roles_store_id"), table_name="store_roles")
    op.drop_table("store_roles")
