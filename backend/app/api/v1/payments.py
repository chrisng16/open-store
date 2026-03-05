import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user, get_store_context, require_role, CurrentUser, StoreContext
from app.models.store import Store, MemberRole
from app.config import get_settings
from app.services.stripe_service import (
    create_connect_account,
    create_account_link,
    get_account_status,
    create_payment_intent,
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
        account = await create_connect_account(store.name, ctx.store.owner_id)
        store.stripe_account_id = account.id
        await db.flush()

    link = await create_account_link(
        store.stripe_account_id,
        refresh_url=f"{settings.frontend_url}/dashboard/{store.id}/settings",
        return_url=f"{settings.frontend_url}/dashboard/{store.id}/settings?stripe=complete",
    )
    return {"url": link.url}


@router.get("/stores/{store_id}/stripe/status")
async def stripe_status(
    ctx: StoreContext = Depends(require_role(MemberRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    store = ctx.store
    if not store.stripe_account_id:
        return {"connected": False, "details_submitted": False, "charges_enabled": False}

    status = await get_account_status(store.stripe_account_id)
    store.stripe_onboarding_complete = status["charges_enabled"]
    await db.flush()

    return status


# --- Payment Intent ---


@router.post("/payments/create-intent")
async def create_intent(
    store_id: uuid.UUID,
    amount: int,  # in cents
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if not store.stripe_account_id or not store.stripe_onboarding_complete:
        raise HTTPException(status_code=400, detail="Store not set up for payments")

    settings = get_settings()
    fee = int(amount * settings.stripe_platform_fee_percent / 100)

    intent = await create_payment_intent(
        amount=amount,
        currency="usd",
        destination_account=store.stripe_account_id,
        application_fee=fee,
    )
    return {"client_secret": intent.client_secret, "payment_intent_id": intent.id}


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
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        # Update order status
        from app.models.order import Order, OrderStatus

        result = await db.execute(
            select(Order).where(Order.stripe_payment_intent_id == pi["id"])
        )
        order = result.scalar_one_or_none()
        if order:
            order.status = OrderStatus.confirmed
            await db.flush()

    elif event["type"] == "account.updated":
        account = event["data"]["object"]
        result = await db.execute(
            select(Store).where(Store.stripe_account_id == account["id"])
        )
        store = result.scalar_one_or_none()
        if store:
            store.stripe_onboarding_complete = account.get("charges_enabled", False)
            await db.flush()

    return {"received": True}
