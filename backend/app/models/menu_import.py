import uuid
import enum
from decimal import Decimal
from datetime import datetime
from sqlalchemy import String, Text, Float, DateTime, ForeignKey, Enum
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
    file_type: Mapped[FileType] = mapped_column(Enum(FileType), nullable=False)
    status: Mapped[ImportStatus] = mapped_column(
        Enum(ImportStatus), nullable=False, default=ImportStatus.uploading
    )
    raw_extraction: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    parsed_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    confidence_scores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
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


class MenuImportItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "menu_import_items"

    menu_import_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_imports.id", ondelete="CASCADE"), nullable=False
    )
    category_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Float, nullable=True)
    modifiers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
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
