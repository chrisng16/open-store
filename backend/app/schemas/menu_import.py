import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.menu_import import ImportStatus, ImportItemStatus, FileType


class MenuImportResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    uploaded_by: uuid.UUID
    file_url: str
    file_size_bytes: int | None
    file_size_mb: float | None
    file_type: FileType
    status: ImportStatus
    raw_extraction: dict | None
    parsed_data: dict | None
    confidence_scores: dict | None
    error_log: str | None
    processing_started_at: datetime | None
    ingested_at: datetime | None
    ingest_duration_seconds: int | None
    processing_elapsed_seconds: int | None
    ai_processing_seconds: int | None
    ai_seconds_per_mb: float | None
    ai_mb_per_second: float | None
    published_at: datetime | None
    items: list["MenuImportItemResponse"] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MenuImportItemResponse(BaseModel):
    id: uuid.UUID
    menu_import_id: uuid.UUID
    category_name: str | None
    item_name: str
    description: str | None
    unit_amount: int | None
    option_lists: dict | None
    dietary_tags: list | None
    allergens: list | None
    confidence: float
    status: ImportItemStatus
    linked_product_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MenuImportItemUpdate(BaseModel):
    category_name: str | None = None
    item_name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    unit_amount: int | None = Field(None, ge=0)
    option_lists: dict | None = None
    dietary_tags: list | None = None
    allergens: list | None = None
    status: ImportItemStatus | None = None


class MenuImportItemBatchUpdate(BaseModel):
    item_id: uuid.UUID
    category_name: str | None = None
    item_name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    unit_amount: int | None = Field(None, ge=0)
    option_lists: dict | None = None
    dietary_tags: list | None = None
    allergens: list | None = None
    status: ImportItemStatus | None = None


class MenuImportItemsBatchUpdateRequest(BaseModel):
    items: list[MenuImportItemBatchUpdate] = Field(min_length=1)
