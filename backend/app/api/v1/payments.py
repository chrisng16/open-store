import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import require_role, StoreContext
from app.models.store import Store, MemberRole
from app.models.order import Order, OrderStatus
from app.config import get_settings
from app.schemas.payment import CreatePaymentIntentRequest
from app.services.stripe_service import (
    create_connect_account,
    create_account_link,
    create_account_login_link,
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
            "requirements": {
                "currently_due": [],
                "eventually_due": [],
                "disabled_reason": None,
            },
            "capabilities": {"card_payments": None, "transfers": None},
        }

    status = await get_account_status(store.stripe_account_id)
    print("Stripe account status:", status)
    store.stripe_onboarding_complete = status["charges_enabled"]
    await db.flush()

    return status


@router.post("/stores/{store_id}/stripe/login-link")
async def stripe_login_link(
    ctx: StoreContext = Depends(require_role(MemberRole.owner)),
):
    store = ctx.store
    if not store.stripe_account_id:
        raise HTTPException(status_code=400, detail="Store not set up for payments")

    link = await create_account_login_link(store.stripe_account_id)
    return {"url": link.url}


# --- Payment Intent ---
@router.post("/payments/create-intent")
async def create_intent(
    payload: CreatePaymentIntentRequest,
    db: AsyncSession = Depends(get_db),
):
    order_result = await db.execute(select(Order).where(Order.id == payload.order_id))
    order = order_result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != OrderStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending orders can create a payment intent")

    if order.stripe_payment_intent_id:
        raise HTTPException(status_code=409, detail="Payment intent already created for this order")

    store_result = await db.execute(select(Store).where(Store.id == order.store_id))
    store = store_result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    if not store.stripe_account_id:
        raise HTTPException(status_code=400, detail="Store not set up for payments")

    live_status = await get_account_status(store.stripe_account_id)
    store.stripe_onboarding_complete = bool(live_status.get("charges_enabled"))
    await db.flush()

    if not live_status.get("charges_enabled"):
        raise HTTPException(status_code=400, detail="Store not set up for payments")

    transfers_capability = (live_status.get("capabilities") or {}).get("transfers")
    if transfers_capability and transfers_capability != "active":
        raise HTTPException(status_code=400, detail="Store transfer capability is not active")

    settings = get_settings()
    fee = int(order.total_amount * settings.stripe_platform_fee_percent / 100)

    intent = await create_payment_intent(
        amount=order.total_amount,
        currency="usd",
        destination_account=store.stripe_account_id,
        application_fee=fee,
        metadata={
            "order_id": str(order.id),
            "store_id": str(store.id),
        },
    )

    order.stripe_payment_intent_id = intent.id
    await db.flush()

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
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        result = await db.execute(
            select(Order).where(Order.stripe_payment_intent_id == pi["id"])
        )
        order = result.scalar_one_or_none()
        if order and order.status == OrderStatus.pending:
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
