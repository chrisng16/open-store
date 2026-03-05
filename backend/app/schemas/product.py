import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


# --- Category ---

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    sort_order: int = 0
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    name: str
    description: str | None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Modifier ---

class ModifierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    price_adjustment: Decimal = Decimal("0.00")
    is_default: bool = False
    sort_order: int = 0


class ModifierResponse(BaseModel):
    id: uuid.UUID
    modifier_group_id: uuid.UUID
    name: str
    price_adjustment: Decimal
    is_default: bool
    sort_order: int

    model_config = {"from_attributes": True}


# --- ModifierGroup ---

class ModifierGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    min_selections: int = 0
    max_selections: int = 1
    is_required: bool = False
    modifiers: list[ModifierCreate] = []


class ModifierGroupResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    name: str
    min_selections: int
    max_selections: int
    is_required: bool
    modifiers: list[ModifierResponse] = []

    model_config = {"from_attributes": True}


# --- Product ---

class ProductCreate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    base_price: Decimal = Field(..., ge=0)
    image_url: str | None = None
    is_active: bool = True
    sort_order: int = 0
    dietary_tags: list[str] = []
    allergens: list[str] = []
    ingredients: str | None = None
    modifier_groups: list[ModifierGroupCreate] = []


class ProductUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    base_price: Decimal | None = Field(None, ge=0)
    image_url: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    dietary_tags: list[str] | None = None
    allergens: list[str] | None = None
    ingredients: str | None = None
    modifier_groups: list[ModifierGroupCreate] | None = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    category_id: uuid.UUID | None
    name: str
    description: str | None
    base_price: Decimal
    image_url: str | None
    is_active: bool
    sort_order: int
    dietary_tags: list[str] | None
    allergens: list[str] | None
    ingredients: str | None
    modifier_groups: list[ModifierGroupResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
