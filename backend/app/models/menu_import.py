import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import inspect
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class FileType(str, enum.Enum):
    pdf = "pdf"
    image = "image"
    csv = "csv"
    xlsx = "xlsx"


class ImportStatus(str, enum.Enum):
    uploading = "uploading"
    processing = "processing"
    review = "review"
    published = "published"
    failed = "failed"


class ImportItemStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    edited = "edited"
    rejected = "rejected"


class MenuImport(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "menu_imports"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_type: Mapped[FileType] = mapped_column(Enum(FileType), nullable=False)
    status: Mapped[ImportStatus] = mapped_column(
        Enum(ImportStatus), nullable=False, default=ImportStatus.uploading
    )
    raw_extraction: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    parsed_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    confidence_scores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    store: Mapped["Store"] = relationship(back_populates="menu_imports")
    items: Mapped[list["MenuImportItem"]] = relationship(
        back_populates="menu_import", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        state = inspect(self)
        status = state.dict.get("status")
        identity = state.identity[0] if state.identity else None
        if status is not None:
            return f"<MenuImport {identity} status={status}>"
        return f"<MenuImport id={identity}>"

    @property
    def ingest_duration_seconds(self) -> int | None:
        if self.ingested_at:
            return max(0, int((self.ingested_at - self.created_at).total_seconds()))
        if self.status in (ImportStatus.review, ImportStatus.published, ImportStatus.failed):
            return max(0, int((self.updated_at - self.created_at).total_seconds()))
        return None

    @property
    def processing_elapsed_seconds(self) -> int | None:
        if self.ingested_at or self.status not in (ImportStatus.uploading, ImportStatus.processing):
            return None
        now = datetime.now(timezone.utc)
        return max(0, int((now - self.created_at).total_seconds()))

    @property
    def ai_processing_seconds(self) -> int | None:
        start_at = self.processing_started_at or self.created_at
        if self.ingested_at:
            return max(0, int((self.ingested_at - start_at).total_seconds()))
        if self.status in (ImportStatus.uploading, ImportStatus.processing):
            now = datetime.now(timezone.utc)
            return max(0, int((now - start_at).total_seconds()))
        if self.status in (ImportStatus.review, ImportStatus.published, ImportStatus.failed):
            return max(0, int((self.updated_at - start_at).total_seconds()))
        return None

    @property
    def file_size_mb(self) -> float | None:
        if self.file_size_bytes is None:
            return None
        if self.file_size_bytes < 0:
            return None
        return round(self.file_size_bytes / (1024 * 1024), 4)

    @property
    def ai_seconds_per_mb(self) -> float | None:
        ai_seconds = self.ai_processing_seconds
        file_mb = self.file_size_mb
        if ai_seconds is None or file_mb is None or file_mb <= 0:
            return None
        return round(ai_seconds / file_mb, 4)

    @property
    def ai_mb_per_second(self) -> float | None:
        ai_seconds = self.ai_processing_seconds
        file_mb = self.file_size_mb
        if ai_seconds is None or file_mb is None or ai_seconds <= 0:
            return None
        return round(file_mb / ai_seconds, 4)


class MenuImportItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "menu_import_items"

    menu_import_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_imports.id", ondelete="CASCADE"), nullable=False
    )
    category_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    option_lists: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    dietary_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    allergens: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[ImportItemStatus] = mapped_column(
        Enum(ImportItemStatus), nullable=False, default=ImportItemStatus.pending
    )
    linked_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    menu_import: Mapped["MenuImport"] = relationship(back_populates="items")

    def __repr__(self) -> str:
        state = inspect(self)
        item_name = state.dict.get("item_name")
        confidence = state.dict.get("confidence")
        if item_name is not None and confidence is not None:
            return f"<MenuImportItem {item_name} confidence={confidence}>"
        identity = state.identity[0] if state.identity else None
        return f"<MenuImportItem id={identity}>"


# Avoid circular import
from app.models.store import Store  # noqa: E402, F811
