import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from urllib.parse import urlencode

from app.database import get_db
from app.api.deps import require_role, StoreContext
from app.models.store import Store, MemberRole
from app.models.order import Order, OrderStatus, OrderItem
from app.config import get_settings
from app.schemas.payment import CreateSessionRequest
from app.services.stripe_service import (
    create_connect_account,
    create_account_link,
    get_account_status,
    get_tax_settings,
    create_payment_intent,
    update_payment_intent,
)

router = APIRouter(tags=["payments"])


# --- Stripe Connect onboarding ---
@router.post("/stores/{store_id}/stripe/onboard")
async def onboard_stripe(
    ctx: StoreContext = Depends(require_role(MemberRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    store = ctx.store

    if not store.stripe_account_id:
        account = await create_connect_account(ctx.store.owner_id)
        store.stripe_account_id = account.id
        await db.flush()

    link = await create_account_link(
        store.stripe_account_id,
        refresh_url=f"{settings.frontend_url}/dashboard/{store.id}/payments?stripe=refresh",
        return_url=f"{settings.frontend_url}/dashboard/{store.id}/payments?stripe=complete",
    )
    return {"url": link.url}


@router.get("/stores/{store_id}/stripe/status")
async def stripe_status(
    ctx: StoreContext = Depends(require_role(MemberRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    store = ctx.store
    if not store.stripe_account_id:
        return {
            "connected": False,
            "details_submitted": False,
            "charges_enabled": False,
            "payouts_enabled": False,
            "restricted": False,
            "requirements": {"currently_due": [], "eventually_due": [], "disabled_reason": None},
            "capabilities": {"card_payments": None, "transfers": None},
        }

    status = await get_account_status(store.stripe_account_id)
    tax_status = await get_tax_settings(store.stripe_account_id)
    status["tax_settings"] = tax_status
    
    store.stripe_onboarding_complete = status["charges_enabled"]
    await db.flush()
    return status


# --- Checkout Session ---

# Schema expected:
#   class CreateSessionRequest(BaseModel):
#       order_id: uuid.UUID
#       order_access_token: str | None = None

@router.post("/payments/create-session")
async def create_session(
    payload: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
):
    order_result = await db.execute(
        select(Order)
        .where(Order.id == payload.order_id)
        .options(selectinload(Order.items).selectinload(OrderItem.options))
    )
    order = order_result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Guard: only pending orders can start a new session.
    #
    # Previous versions rejected anything non-pending, which was too strict —
    # if the client crashed after order creation but before receiving the
    # clientSecret, the user would be permanently stuck with an unpayable order.
    #
    # Correct behaviour:
    #   - pending, no PI yet  → create a new session (first call or safe retry)
    #   - confirmed/completed → already paid, reject
    #   - cancelled           → reject
    #
    # The Stripe idempotency key (checkout-session-{order.id}) means that even
    # if this endpoint is called multiple times for the same pending order,
    # Stripe returns the original session rather than creating a new one, so
    # the guard here is purely about rejecting already-paid orders.
    if order.status in (OrderStatus.confirmed, OrderStatus.completed, OrderStatus.cancelled):
        raise HTTPException(
            status_code=400,
            detail=f"Order is already {order.status.value} and cannot start a new checkout session.",
        )

    store_result = await db.execute(select(Store).where(Store.id == order.store_id))
    store = store_result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    if not store.stripe_account_id:
        raise HTTPException(status_code=400, detail="Store not set up for payments")

    # Re-check live account status rather than trusting the cached DB flag.
    live_status = await get_account_status(store.stripe_account_id)
    if not live_status.get("charges_enabled"):
        raise HTTPException(status_code=400, detail="Store is not currently accepting payments")

    settings = get_settings()

    if order.stripe_payment_intent_id:
        # Update existing intent if the amount or application fee changed.
        intent = await update_payment_intent(
            payment_intent_id=order.stripe_payment_intent_id,
            amount=order.total_amount,
            stripe_account=store.stripe_account_id,
            application_fee_amount=order.platform_fee_amount,
            metadata={
                "order_id": str(order.id),
                "store_id": str(store.id),
            },
        )
    else:
        # Create a new intent.
        intent = await create_payment_intent(
            amount=order.total_amount,
            stripe_account=store.stripe_account_id,
            application_fee_amount=order.platform_fee_amount,
            idempotency_key=f"pi-{order.id}",
            metadata={
                "order_id": str(order.id),
                "store_id": str(store.id),
            },
        )
        order.stripe_payment_intent_id = intent.id
        await db.flush()

    return {
        "clientSecret": intent.client_secret,
        "client_secret": intent.client_secret,
        "stripe_account_id": store.stripe_account_id,
    }


# --- Stripe Webhook ---
@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    import stripe

    settings = get_settings()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]

    if event_type == "payment_intent.succeeded":
        pi = event["data"]["object"]
        order = None

        # Primary: metadata order_id set in payment_intent_data.metadata.
        order_id = pi.get("metadata", {}).get("order_id")
        if order_id:
            try:
                order_uuid = uuid.UUID(order_id)
                # Use SELECT FOR UPDATE to prevent race conditions during fulfillment
                result = await db.execute(
                    select(Order)
                    .where(Order.id == order_uuid)
                    .with_for_update()
                )
                order = result.scalar_one_or_none()
            except ValueError:
                pass

        # Fallback: PI ID stored after checkout.session.completed fired first.
        if not order:
            result = await db.execute(
                select(Order)
                .where(Order.stripe_payment_intent_id == pi["id"])
                .with_for_update()
            )
            order = result.scalar_one_or_none()

        if order:
            if order.status == OrderStatus.pending:
                order.status = OrderStatus.confirmed
            if not order.stripe_payment_intent_id:
                order.stripe_payment_intent_id = pi["id"]
            await db.flush()

    elif event_type == "payment_intent.payment_failed":
        obj = event["data"]["object"]
        order = None

        # Check metadata first
        order_id = obj.get("metadata", {}).get("order_id")
        if order_id:
            try:
                order_uuid = uuid.UUID(order_id)
                result = await db.execute(select(Order).where(Order.id == order_uuid))
                order = result.scalar_one_or_none()
            except ValueError:
                pass

        # For payment intents, try fallback by ID
        if not order and event_type == "payment_intent.payment_failed":
            result = await db.execute(
                select(Order).where(Order.stripe_payment_intent_id == obj["id"])
            )
            order = result.scalar_one_or_none()

        if order and order.status == OrderStatus.pending:
            order.status = OrderStatus.cancelled
            await db.flush()

    elif event_type == "account.updated":
        account = event["data"]["object"]
        result = await db.execute(
            select(Store).where(Store.stripe_account_id == account["id"])
        )
        store = result.scalar_one_or_none()
        if store:
            store.stripe_onboarding_complete = account.get("charges_enabled", False)
            await db.flush()

    return {"received": True}