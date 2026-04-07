import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.pagination import PaginationMetadata


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


class OptionCreate(BaseModel):
    id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=255)
    unit_amount: int = Field(default=0, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    decimal_places: int = Field(default=2, ge=0, le=4)
    min_option_choice_quantity: int = Field(default=0, ge=0)
    max_option_choice_quantity: int = Field(default=1, ge=0)
    default_quantity: int = Field(default=0, ge=0)
    is_default: bool = False
    sort_order: int = 0


class OptionResponse(BaseModel):
    id: uuid.UUID
    option_list_id: uuid.UUID
    name: str
    unit_amount: int
    currency: str
    decimal_places: int
    min_option_choice_quantity: int
    max_option_choice_quantity: int
    default_quantity: int
    is_default: bool
    sort_order: int

    model_config = {"from_attributes": True}


class OptionListCreate(BaseModel):
    id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=255)
    selection_node: str = Field(default="multi_select")
    min_num_options: int = Field(default=0, ge=0)
    max_num_options: int = Field(default=1, ge=0)
    min_aggregate_options_quantity: int = Field(default=0, ge=0)
    max_aggregate_options_quantity: int = Field(default=0, ge=0)
    is_optional: bool = True
    sort_order: int = 0
    options: list[OptionCreate] = []


class OptionListResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    name: str
    selection_node: str
    min_num_options: int
    max_num_options: int
    min_aggregate_options_quantity: int
    max_aggregate_options_quantity: int
    is_optional: bool
    sort_order: int
    options: list[OptionResponse] = []

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    unit_amount: int = Field(..., ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    decimal_places: int = Field(default=2, ge=0, le=4)
    image_url: str | None = None
    is_active: bool = True
    sort_order: int = 0
    dietary_tags: list[str] = []
    allergens: list[str] = []
    ingredients: str | None = None
    option_lists: list[OptionListCreate] = []


class ProductUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    unit_amount: int | None = Field(None, ge=0)
    currency: str | None = Field(None, min_length=3, max_length=3)
    decimal_places: int | None = Field(None, ge=0, le=4)
    image_url: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    dietary_tags: list[str] | None = None
    allergens: list[str] | None = None
    ingredients: str | None = None
    option_lists: list[OptionListCreate] | None = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    category_id: uuid.UUID | None
    name: str
    description: str | None
    unit_amount: int
    currency: str
    decimal_places: int
    image_url: str | None
    is_active: bool
    sort_order: int
    dietary_tags: list[str] | None
    allergens: list[str] | None
    ingredients: str | None
    option_lists: list[OptionListResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListItemResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    category_id: uuid.UUID | None
    name: str
    description: str | None
    unit_amount: int
    currency: str
    decimal_places: int
    image_url: str | None
    is_active: bool
    sort_order: int
    dietary_tags: list[str] | None
    allergens: list[str] | None
    ingredients: str | None
    option_lists: list[OptionListResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListItemCategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool

    model_config = {"from_attributes": True}


class ProductWithCategoryListItemResponse(ProductListItemResponse):
    category: ProductListItemCategoryResponse | None = None


class CategoriesPageResponse(PaginationMetadata):
    items: list[CategoryResponse]


class ProductsPageResponse(PaginationMetadata):
    items: list[ProductWithCategoryListItemResponse]
