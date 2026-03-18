import uuid

from pydantic import BaseModel


class CreatePaymentIntentRequest(BaseModel):
    order_id: uuid.UUID
