import stripe
from typing import Any
from app.config import get_settings


def _init_stripe():
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key


async def create_connect_account(owner_id: Any) -> stripe.Account:
    # `business_name` was previously accepted but never forwarded to Stripe —
    # removed to avoid the misleading signature. Standard accounts collect their
    # own business details during onboarding anyway.
    _init_stripe()
    return stripe.Account.create(
        type="standard",
        metadata={"owner_id": str(owner_id)},
    )


async def create_account_link(
    account_id: str,
    refresh_url: str,
    return_url: str,
) -> stripe.AccountLink:
    _init_stripe()
    return stripe.AccountLink.create(
        account=account_id,
        refresh_url=refresh_url,
        return_url=return_url,
        type="account_onboarding",
    )


async def get_account_status(account_id: str) -> dict:
    _init_stripe()
    account = stripe.Account.retrieve(account_id)

    requirements = getattr(account, "requirements", None)
    capabilities = getattr(account, "capabilities", None)

    currently_due = list(getattr(requirements, "currently_due", []) or []) if requirements else []
    eventually_due = list(getattr(requirements, "eventually_due", []) or []) if requirements else []
    disabled_reason = getattr(requirements, "disabled_reason", None) if requirements else None

    return {
        "connected": True,
        "details_submitted": account.details_submitted,
        "charges_enabled": account.charges_enabled,
        "payouts_enabled": account.payouts_enabled,
        "restricted": bool(disabled_reason) or len(currently_due) > 0,
        "requirements": {
            "currently_due": currently_due,
            "eventually_due": eventually_due,
            "disabled_reason": disabled_reason,
        },
        "capabilities": {
            "card_payments": getattr(capabilities, "card_payments", None) if capabilities else None,
            "transfers": getattr(capabilities, "transfers", None) if capabilities else None,
        },
    }


async def get_tax_settings(account_id: str) -> dict:
    """Check if the connected account has configured Stripe Tax."""
    _init_stripe()
    try:
        settings = stripe.tax.Settings.retrieve(stripe_account=account_id)
        return {
            "status": settings.status, # 'active' or 'pending'
            "headquarters": bool(settings.head_office),
            "defaults": bool(settings.defaults),
        }
    except stripe.StripeError:
        return {
            "status": "not_configured",
            "headquarters": False,
            "defaults": False,
        }


async def calculate_stripe_tax(
    store_stripe_account_id: str,
    currency: str,
    line_items: list[Any],
    customer_address: dict[str, Any],
) -> stripe.tax.Calculation:
    """Calculate tax using Stripe Tax API."""
    _init_stripe()

    address: dict[str, str] = {
        "line1": str(customer_address.get("line1") or ""),
        "city": str(customer_address.get("city") or ""),
        "state": str(customer_address.get("state") or ""),
        "postal_code": str(customer_address.get("postal_code") or ""),
        "country": str(customer_address.get("country") or ""),
    }
    
    line2 = customer_address.get("line2")
    if line2:
        address["line2"] = str(line2)

    return stripe.tax.Calculation.create(
        currency=currency,
        line_items=line_items,
        customer_details={
            "address": address, # type: ignore
            "address_source": "shipping",
        },
        stripe_account=store_stripe_account_id,
    )


async def create_payment_intent(
    amount: int,
    stripe_account: str,
    application_fee_amount: int,
    idempotency_key: str,
    metadata: dict | None = None,
) -> stripe.PaymentIntent:
    """Create a PaymentIntent directly on the connected account."""
    _init_stripe()
    return stripe.PaymentIntent.create(
        amount=amount,
        currency="usd",
        application_fee_amount=application_fee_amount,
        metadata=metadata or {},
        stripe_account=stripe_account,
        idempotency_key=idempotency_key,
    )


async def update_payment_intent(
    payment_intent_id: str,
    amount: int,
    stripe_account: str,
    application_fee_amount: int,
    metadata: dict | None = None,
) -> stripe.PaymentIntent:
    """Update an existing PaymentIntent."""
    _init_stripe()
    return stripe.PaymentIntent.modify(
        payment_intent_id,
        amount=amount,
        application_fee_amount=application_fee_amount,
        metadata=metadata or {},
        stripe_account=stripe_account,
    )


async def retrieve_payment_intent(
    payment_intent_id: str,
    stripe_account: str,
) -> stripe.PaymentIntent:
    """Retrieve an existing PaymentIntent from a connected account."""
    _init_stripe()
    return stripe.PaymentIntent.retrieve(
        payment_intent_id,
        stripe_account=stripe_account,
    )


async def create_checkout_session(
    line_items: list[Any],
    stripe_account: str,
    application_fee: int,
    return_url: str,
    idempotency_key: str,
    metadata: dict | None = None,
    billing_address_collection: str = "auto",
) -> stripe.checkout.Session:
    """Create an Embedded Checkout Session with automatic tax.

    `billing_address_collection="auto"` tells Stripe to collect a billing
    address when it needs one for tax-rate determination.  automatic_tax will
    silently return $0 tax without a verified address, so this must be set.
    Use "required" if you always want the address regardless of tax needs.

    `currency` was previously a dead parameter (callers already embed "usd"
    inside their price_data dicts) — removed to avoid confusion.
    """
    _init_stripe()
    return stripe.checkout.Session.create(
        ui_mode="embedded",
        line_items=line_items,
        mode="payment",
        return_url=return_url,
        automatic_tax={"enabled": True},
        billing_address_collection="required",
        payment_intent_data={
            "application_fee_amount": application_fee,
            "metadata": metadata or {},
        },
        metadata=metadata or {},
        stripe_account=stripe_account,
        idempotency_key=idempotency_key,
    )


async def create_refund(
    payment_intent_id: str,
    stripe_account: str,
    amount: int | None = None,
) -> stripe.Refund:
    _init_stripe()
    params: dict[str, Any] = {
        "payment_intent": payment_intent_id,
        "stripe_account": stripe_account,
    }
    if amount is not None:
        params["amount"] = amount
    return stripe.Refund.create(**params)