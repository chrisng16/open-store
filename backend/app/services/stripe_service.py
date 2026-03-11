import stripe
from typing import Any
from app.config import get_settings


def _init_stripe():
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key


async def create_connect_account(business_name: str, owner_id) -> stripe.Account:
    """Create a Stripe Express connected account."""
    _init_stripe()
    account = stripe.Account.create(
        type="express",
        business_type="individual",
        business_profile={"name": business_name},
        capabilities={
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
        metadata={"owner_id": str(owner_id)},
    )
    return account


async def create_account_link(
    account_id: str,
    refresh_url: str,
    return_url: str,
) -> stripe.AccountLink:
    """Create a Stripe Account Link for onboarding."""
    _init_stripe()
    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=refresh_url,
        return_url=return_url,
        type="account_onboarding",
    )
    return link


async def create_account_login_link(account_id: str):
    """Create a Stripe Express dashboard login link for a connected account."""
    _init_stripe()
    return stripe.Account.create_login_link(account_id)


async def get_account_status(account_id: str) -> dict:
    """Get the current status of a connected account."""
    _init_stripe()
    account = stripe.Account.retrieve(account_id)

    requirements = getattr(account, "requirements", None)
    capabilities = getattr(account, "capabilities", None)

    currently_due = list(getattr(requirements, "currently_due", []) or []) if requirements else []
    eventually_due = list(getattr(requirements, "eventually_due", []) or []) if requirements else []
    disabled_reason = getattr(requirements, "disabled_reason", None) if requirements else None

    card_payments_capability = None
    transfers_capability = None
    if capabilities:
        card_payments_capability = getattr(capabilities, "card_payments", None)
        transfers_capability = getattr(capabilities, "transfers", None)

    restricted = bool(disabled_reason) or len(currently_due) > 0

    return {
        "connected": True,
        "details_submitted": account.details_submitted,
        "charges_enabled": account.charges_enabled,
        "payouts_enabled": account.payouts_enabled,
        "restricted": restricted,
        "requirements": {
            "currently_due": currently_due,
            "eventually_due": eventually_due,
            "disabled_reason": disabled_reason,
        },
        "capabilities": {
            "card_payments": card_payments_capability,
            "transfers": transfers_capability,
        },
    }


async def create_payment_intent(
    amount: int,
    currency: str,
    destination_account: str,
    application_fee: int,
    metadata: dict | None = None,
) -> stripe.PaymentIntent:
    """Create a PaymentIntent with destination charge."""
    _init_stripe()
    intent = stripe.PaymentIntent.create(
        amount=amount,
        currency=currency,
        application_fee_amount=application_fee,
        transfer_data={"destination": destination_account},
        metadata=metadata or {},
    )
    return intent


async def create_refund(payment_intent_id: str, amount: int | None = None) -> stripe.Refund:
    """Refund a PaymentIntent (full or partial)."""
    _init_stripe()
    params: dict[str, Any] = {"payment_intent": payment_intent_id}
    if amount is not None:
        params["amount"] = amount
    return stripe.Refund.create(**params)
