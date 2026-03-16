import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.order import OrderStatus
from app.schemas.pagination import PaginationMetadata


class OrderItemOptionCreate(BaseModel):
    option_id: uuid.UUID
    option_name: str
    unit_amount: int = Field(default=0, ge=0)
    quantity: int = Field(default=1, ge=1)


class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    product_name: str
    quantity: int = Field(..., ge=1)
    unit_amount: int = Field(..., ge=0)
    options: list[OrderItemOptionCreate] = []


class OrderCreate(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    notes: str | None = None
    items: list[OrderItemCreate] = Field(..., min_length=1)


class OrderItemOptionResponse(BaseModel):
    id: uuid.UUID
    option_id: uuid.UUID | None
    option_name: str
    unit_amount: int
    quantity: int

    model_config = {"from_attributes": True}


class OrderItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID | None
    product_name: str
    quantity: int
    unit_amount: int
    total_amount: int
    options: list[OrderItemOptionResponse] = []

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    customer_id: uuid.UUID | None
    status: OrderStatus
    subtotal_amount: int
    tax_amount: int
    total_amount: int
    currency: str
    decimal_places: int
    stripe_payment_intent_id: str | None
    customer_name: str | None
    customer_email: str | None
    customer_phone: str | None
    notes: str | None
    order_number: int
    items: list[OrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrdersPageResponse(PaginationMetadata):
    items: list[OrderResponse]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
