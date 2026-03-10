"""add store invites table

Revision ID: b21d5f9473aa
Revises: a1f9257dbd11
Create Date: 2026-03-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b21d5f9473aa"
down_revision: Union[str, None] = "a1f9257dbd11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "store_invites",
        sa.Column("store_id", sa.UUID(), nullable=False),
        sa.Column("invited_by_user_id", sa.UUID(), nullable=False),
        sa.Column("invited_email", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM("owner", "admin", "staff", name="memberrole", create_type=False),
            nullable=False,
        ),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "accepted", "revoked", "expired", name="invitestatus"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_store_invites_store_id"), "store_invites", ["store_id"], unique=False)
    op.create_index(op.f("ix_store_invites_invited_by_user_id"), "store_invites", ["invited_by_user_id"], unique=False)
    op.create_index(op.f("ix_store_invites_status"), "store_invites", ["status"], unique=False)
    op.create_index(op.f("ix_store_invites_token"), "store_invites", ["token"], unique=True)

    op.create_index(
        "uq_store_invites_pending_email",
        "store_invites",
        ["store_id", "invited_email"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("uq_store_invites_pending_email", table_name="store_invites")
    op.drop_index(op.f("ix_store_invites_token"), table_name="store_invites")
    op.drop_index(op.f("ix_store_invites_status"), table_name="store_invites")
    op.drop_index(op.f("ix_store_invites_invited_by_user_id"), table_name="store_invites")
    op.drop_index(op.f("ix_store_invites_store_id"), table_name="store_invites")
    op.drop_table("store_invites")

    sa.Enum("pending", "accepted", "revoked", "expired", name="invitestatus").drop(op.get_bind(), checkfirst=True)
