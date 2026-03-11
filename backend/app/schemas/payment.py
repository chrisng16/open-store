import uuid

from pydantic import BaseModel, Field


class CreatePaymentIntentRequest(BaseModel):
    store_id: uuid.UUID
    amount: int = Field(..., gt=0)
