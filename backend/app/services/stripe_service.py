import stripe
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


async def get_account_status(account_id: str) -> dict:
    """Get the current status of a connected account."""
    _init_stripe()
    account = stripe.Account.retrieve(account_id)
    return {
        "connected": True,
        "details_submitted": account.details_submitted,
        "charges_enabled": account.charges_enabled,
        "payouts_enabled": account.payouts_enabled,
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
    params = {"payment_intent": payment_intent_id}
    if amount:
        params["amount"] = amount
    return stripe.Refund.create(**params)
