"""add upload assets table

Revision ID: c42f6a4bd910
Revises: 9a31b2f15d7c
Create Date: 2026-03-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c42f6a4bd910"
down_revision: Union[str, None] = "9a31b2f15d7c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


upload_intent_enum = postgresql.ENUM("menu_import_file", "product_image", name="uploadintent", create_type=False)
upload_status_enum = postgresql.ENUM("initiated", "uploaded", "finalized", "expired", "failed", name="uploadassetstatus", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE uploadintent AS ENUM ('menu_import_file', 'product_image');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE uploadassetstatus AS ENUM ('initiated', 'uploaded', 'finalized', 'expired', 'failed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "upload_assets",
        sa.Column("store_id", sa.UUID(), nullable=False),
        sa.Column("uploaded_by", sa.UUID(), nullable=False),
        sa.Column("intent", upload_intent_enum, nullable=False),
        sa.Column("status", upload_status_enum, nullable=False),
        sa.Column("object_key", sa.String(length=512), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key", name="uq_upload_assets_object_key"),
    )
    op.create_index(op.f("ix_upload_assets_store_id"), "upload_assets", ["store_id"], unique=False)
    op.create_index(op.f("ix_upload_assets_uploaded_by"), "upload_assets", ["uploaded_by"], unique=False)
    op.create_index(op.f("ix_upload_assets_intent"), "upload_assets", ["intent"], unique=False)
    op.create_index(op.f("ix_upload_assets_status"), "upload_assets", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_upload_assets_status"), table_name="upload_assets")
    op.drop_index(op.f("ix_upload_assets_intent"), table_name="upload_assets")
    op.drop_index(op.f("ix_upload_assets_uploaded_by"), table_name="upload_assets")
    op.drop_index(op.f("ix_upload_assets_store_id"), table_name="upload_assets")
    op.drop_table("upload_assets")

    op.execute("DROP TYPE IF EXISTS uploadassetstatus")
    op.execute("DROP TYPE IF EXISTS uploadintent")
