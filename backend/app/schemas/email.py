from pydantic import BaseModel, Field


class StoreInvitationEmailContext(BaseModel):
    store_name: str = Field(min_length=1, max_length=255)
    invited_email: str = Field(min_length=3, max_length=255)
    inviter_email: str = Field(min_length=3, max_length=255)
    invite_link: str = Field(min_length=8, max_length=2048)
    role: str = Field(min_length=3, max_length=32)
    expires_at: str = Field(min_length=10, max_length=64)


class OrderConfirmationEmailContext(BaseModel):
    store_name: str = Field(min_length=1, max_length=255)
    customer_name: str = Field(min_length=1, max_length=255)
    order_display_id: str = Field(min_length=1, max_length=64)
    order_reference: str | None = Field(default=None, max_length=64)
    status: str = Field(min_length=3, max_length=32)
    total_amount_display: str = Field(min_length=1, max_length=64)


class OrderStatusUpdateEmailContext(BaseModel):
    store_name: str = Field(min_length=1, max_length=255)
    customer_name: str = Field(min_length=1, max_length=255)
    order_display_id: str = Field(min_length=1, max_length=64)
    previous_status: str = Field(min_length=3, max_length=32)
    new_status: str = Field(min_length=3, max_length=32)
    total_amount_display: str = Field(min_length=1, max_length=64)
