import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UploadIntent(str, enum.Enum):
    menu_import_file = "menu_import_file"
    product_image = "product_image"


class UploadAssetStatus(str, enum.Enum):
    initiated = "initiated"
    uploaded = "uploaded"
    finalized = "finalized"
    expired = "expired"
    failed = "failed"


class UploadAsset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "upload_assets"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    intent: Mapped[UploadIntent] = mapped_column(Enum(UploadIntent), nullable=False, index=True)
    status: Mapped[UploadAssetStatus] = mapped_column(
        Enum(UploadAssetStatus), nullable=False, default=UploadAssetStatus.initiated, index=True
    )
    object_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @property
    def file_url(self) -> str:
        from app.config import get_settings

        settings = get_settings()
        return f"s3://{settings.s3_bucket_name}/{self.object_key}"
