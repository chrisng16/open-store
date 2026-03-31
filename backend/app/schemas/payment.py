from pydantic import BaseModel
import uuid


class CreatePaymentIntentRequest(BaseModel):
    order_id: uuid.UUID


class CreateSessionRequest(BaseModel):
    """Request body for POST /payments/create-session.

    order_access_token is the guest access token returned when the order was
    created. It is optional — orders without token-gated access work fine
    without it — but when present the backend embeds it in the Stripe
    return_url so the confirmation page can fetch the protected order without
    requiring the customer to be authenticated.
    """
    order_id: uuid.UUID
    order_access_token: str | None = None