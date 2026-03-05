import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.menu_import import ImportStatus, ImportItemStatus, FileType


class MenuImportResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    uploaded_by: uuid.UUID
    file_url: str
    file_type: FileType
    status: ImportStatus
    raw_extraction: dict | None
    parsed_data: dict | None
    confidence_scores: dict | None
    error_log: str | None
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
    price: float | None
    modifiers: dict | None
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
    price: float | None = Field(None, ge=0)
    modifiers: dict | None = None
    dietary_tags: list | None = None
    allergens: list | None = None
    status: ImportItemStatus | None = None


class MenuImportItemBatchUpdate(BaseModel):
    item_id: uuid.UUID
    category_name: str | None = None
    item_name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    price: float | None = Field(None, ge=0)
    modifiers: dict | None = None
    dietary_tags: list | None = None
    allergens: list | None = None
    status: ImportItemStatus | None = None


class MenuImportItemsBatchUpdateRequest(BaseModel):
    items: list[MenuImportItemBatchUpdate] = Field(min_length=1)
