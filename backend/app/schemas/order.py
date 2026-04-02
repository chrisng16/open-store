import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.order import OrderStatus
from app.schemas.pagination import PaginationMetadata


class OrderItemOptionCreate(BaseModel):
    option_id: uuid.UUID
    quantity: int = Field(default=1, ge=1)


class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., ge=1)
    options: list[OrderItemOptionCreate] = []


class OrderCreate(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    notes: str | None = None
    items: list[OrderItemCreate] = Field(..., min_length=1)


class Address(BaseModel):
    line1: str
    line2: str | None = None
    city: str
    state: str
    postal_code: str
    country: str


class CheckoutInitiateRequest(BaseModel):
    items: list[OrderItemCreate]
    shipping_address: Address
    customer_name: str
    customer_email: str
    customer_phone: str | None = None
    notes: str | None = None


class OrderUpdate(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    notes: str | None = None


class OrderLookupRequest(BaseModel):
    order_identifier: str = Field(..., min_length=4, max_length=32)
    email: str | None = None
    phone: str | None = None


class OrderLookupResponse(BaseModel):
    order_id: uuid.UUID
    order_access_token: str


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
    platform_fee_amount: int
    total_amount: int
    currency: str
    decimal_places: int
    stripe_payment_intent_id: str | None
    customer_name: str | None
    customer_email: str | None
    customer_phone: str | None
    notes: str | None
    order_access_token: str | None = None

    # Replaces order_number.
    # display_id is what customers see ("K7XP0042").
    # order_reference is for support staff and internal tooling ("20250315-42-K7XP").
    # daily_sequence is exposed so frontends can sort/display the day's count if needed.
    display_id: str | None
    order_reference: str | None
    daily_sequence: int | None

    items: list[OrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrdersPageResponse(PaginationMetadata):
    items: list[OrderResponse]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus