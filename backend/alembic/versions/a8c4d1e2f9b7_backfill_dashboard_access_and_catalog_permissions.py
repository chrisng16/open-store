"""backfill dashboard access and catalog permissions

Revision ID: a8c4d1e2f9b7
Revises: f7a9c1d2e3b4
Create Date: 2026-04-07 00:00:00.000000

"""
from __future__ import annotations

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a8c4d1e2f9b7"
down_revision: Union[str, None] = "f7a9c1d2e3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_OWNER_ADD = {
    "dashboard.access",
    "products.read",
    "products.write",
    "products.pricing.write",
    "categories.write",
    "orders.read",
    "orders.write",
    "orders.refund",
}

_ADMIN_ADD = {
    "dashboard.access",
    "products.read",
    "products.write",
    "categories.write",
    "orders.read",
    "orders.write",
    "orders.refund",
}

_STAFF_ADD = {
    "products.read",
    "products.write",
    "categories.write",
    "orders.read",
    "orders.write",
}


def _normalize_permissions(raw_value: object) -> set[str]:
    if isinstance(raw_value, list):
        return {str(item) for item in raw_value if isinstance(item, str)}
    return set()


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT id, name, permissions
            FROM store_roles
            WHERE is_system = true
            """
        )
    ).fetchall()

    for role_id, role_name, permissions in rows:
        current = _normalize_permissions(permissions)

        if role_name == "owner":
            next_permissions = sorted(current | _OWNER_ADD)
        elif role_name == "admin":
            next_permissions = sorted((current | _ADMIN_ADD) - {"products.pricing.write"})
        elif role_name == "staff":
            next_permissions = sorted((current | _STAFF_ADD) - {"dashboard.access", "products.pricing.write", "orders.refund"})
        else:
            continue

        bind.execute(
            sa.text(
                """
                UPDATE store_roles
                SET permissions = CAST(:permissions AS jsonb), updated_at = now()
                WHERE id = :role_id
                """
            ),
            {
                "role_id": role_id,
                "permissions": json.dumps(next_permissions),
            },
        )


def downgrade() -> None:
    # Intentionally no-op: permissions may have been edited by owners/admins after backfill.
    pass
