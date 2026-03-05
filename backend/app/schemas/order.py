import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.order import OrderStatus


# --- Order creation ---

class OrderItemModifierCreate(BaseModel):
    modifier_id: uuid.UUID
    modifier_name: str
    price_adjustment: Decimal


class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    product_name: str
    quantity: int = Field(..., ge=1)
    unit_price: Decimal
    modifiers: list[OrderItemModifierCreate] = []


class OrderCreate(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    notes: str | None = None
    items: list[OrderItemCreate] = Field(..., min_length=1)


# --- Order response ---

class OrderItemModifierResponse(BaseModel):
    id: uuid.UUID
    modifier_id: uuid.UUID | None
    modifier_name: str
    price_adjustment: Decimal

    model_config = {"from_attributes": True}


class OrderItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID | None
    product_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    modifiers: list[OrderItemModifierResponse] = []

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    customer_id: uuid.UUID | None
    status: OrderStatus
    subtotal: Decimal
    tax: Decimal
    total: Decimal
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


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
