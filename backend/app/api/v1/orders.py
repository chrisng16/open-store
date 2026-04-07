import secrets
import string
import uuid
import hmac
import re
import json
import logging
from hashlib import sha256
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, func, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.api.pagination import get_offset_pagination, OffsetPaginationParams, resolve_offset_pagination
from app.api.sorting import resolve_sort_expression
from app.config import get_settings
from app.database import get_db
from app.api.deps import (
    require_permission,
    get_optional_user,
    CurrentUser,
    StoreContext,
)
from app.models.store import Store, StoreMember
from app.models.order import Order, OrderItem, OrderItemOption, OrderStatus
from app.models.product import Product, Option, OptionList
from app.schemas.order import (
    Address,
    CheckoutInitiateRequest,
    OrderCreate,
    OrderLookupRequest,
    OrderLookupResponse,
    OrderResponse,
    OrdersPageResponse,
    OrderStatusUpdate,
    OrderUpdate,
)
from app.services.stripe_service import (
    calculate_stripe_tax,
    create_payment_intent,
    update_payment_intent,
)
from app.services.onboarding import get_store_onboarding_status
from app.services.email import enqueue_order_status_update_email

router = APIRouter(prefix="/stores/{store_id}", tags=["orders"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Order reference helpers
# ---------------------------------------------------------------------------

def _generate_order_token(length: int = 4) -> str:
    """
    Short random suffix appended to the daily sequence.
    Prevents enumeration without being a true secret — just raises
    the cost of guessing from O(1) to O(36^4 ≈ 1.6M) per day.

    Ambiguous characters (O, 0, I, 1) are excluded so the token
    is easy to read aloud or transcribe from a receipt.
    """
    alphabet = string.ascii_uppercase + string.digits
    alphabet = alphabet.translate(str.maketrans("", "", "O0I1"))
    return "".join(secrets.choice(alphabet) for _ in range(length))


def build_order_reference(order_date: date, daily_sequence: int, token: str) -> str:
    """
    Internal reference used by support staff and DB lookups.
    Encodes the date so queries can target the exact day partition.

    Example: "20250315-K7XP-0042"
    """
    return f"{order_date.strftime('%Y%m%d')}-{token}-{daily_sequence:04d}"


def build_display_id(daily_sequence: int, token: str) -> str:
    """
    Customer-facing ID shown on receipts, emails, and SMS.
    Token-first so it doesn't look like a plain incrementing number.

    Example: "K7XP-0042"
    """
    return f"{token}-{daily_sequence:04d}"


def parse_order_reference(reference: str) -> tuple[date, str, int]:
    """
    Decompose an internal reference back into its parts for a
    targeted, partition-aware DB lookup.

    Raises ValueError on malformed input so callers can return 400.
    """
    parts = reference.split("-")
    if len(parts) != 3:
        raise ValueError(f"Invalid order reference format: {reference!r}")
    order_date = datetime.strptime(parts[0], "%Y%m%d").date()
    token = parts[1].upper()
    sequence = int(parts[2])
    return order_date, token, sequence


def _order_access_secret() -> str:
    settings = get_settings()
    return settings.supabase_jwt_secret or settings.stripe_webhook_secret or "dev-order-access-secret"


def build_order_access_token(order_id: uuid.UUID, store_id: uuid.UUID) -> str:
    issued_at = int(datetime.now(timezone.utc).timestamp())
    payload = f"{order_id}:{store_id}:{issued_at}"
    signature = hmac.new(
        _order_access_secret().encode("utf-8"),
        payload.encode("utf-8"),
        sha256,
    ).hexdigest()
    return f"{issued_at}.{signature}"


def validate_order_access_token(order_id: uuid.UUID, store_id: uuid.UUID, token: str) -> bool:
    try:
        issued_at_raw, provided_signature = token.split(".", 1)
        issued_at = int(issued_at_raw)
    except (ValueError, AttributeError):
        return False

    now_ts = int(datetime.now(timezone.utc).timestamp())
    max_age_seconds = 60 * 60 * 24 * 14  # 14 days
    if issued_at <= 0 or now_ts - issued_at > max_age_seconds:
        return False

    payload = f"{order_id}:{store_id}:{issued_at}"
    expected_signature = hmac.new(
        _order_access_secret().encode("utf-8"),
        payload.encode("utf-8"),
        sha256,
    ).hexdigest()
    return hmac.compare_digest(provided_signature, expected_signature)


def _normalize_email(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower()
    return normalized or None


def _normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits_only = re.sub(r"\D", "", value)
    return digits_only or None


def _build_checkout_fingerprint(payload: CheckoutInitiateRequest) -> str:
    """Create a deterministic fingerprint for checkout idempotency."""
    normalized_items = []
    for item in sorted(payload.items, key=lambda i: str(i.product_id)):
        normalized_options = [
            {
                "option_id": str(opt.option_id),
                "quantity": opt.quantity,
            }
            for opt in sorted(item.options, key=lambda o: str(o.option_id))
        ]
        normalized_items.append(
            {
                "product_id": str(item.product_id),
                "quantity": item.quantity,
                "options": normalized_options,
            }
        )

    payload_snapshot = {
        "customer_email": _normalize_email(payload.customer_email),
        "shipping_address": payload.shipping_address.model_dump(),
        "items": normalized_items,
    }
    serialized = json.dumps(payload_snapshot, sort_keys=True, separators=(",", ":"))
    return sha256(serialized.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Shared filter helper
# ---------------------------------------------------------------------------

def _apply_order_filters(
    query,
    *,
    status: str | None,
    created_from: date | None,
    created_to: date | None,
    q: str | None,
    store_timezone: str | None = None,
):
    try:
        store_tz = ZoneInfo(store_timezone or "UTC")
    except ZoneInfoNotFoundError:
        store_tz = timezone.utc

    if status:
        valid_statuses = [
            OrderStatus(s.strip())
            for s in status.split(",")
            if s.strip() in {e.value for e in OrderStatus}
        ]
        if valid_statuses:
            query = query.where(Order.status.in_(valid_statuses))
    if created_from:
        start_dt = datetime.combine(created_from, time.min, tzinfo=store_tz).astimezone(timezone.utc)
        query = query.where(Order.created_at >= start_dt)
    if created_to:
        end_dt = datetime.combine(created_to, time.max, tzinfo=store_tz).astimezone(timezone.utc)
        query = query.where(Order.created_at <= end_dt)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                Order.customer_name.ilike(term),
                Order.customer_email.ilike(term),
                Order.customer_phone.ilike(term),
                # Support staff can search by either the display ID or
                # the full internal reference.
                Order.display_id.ilike(term),
                Order.order_reference.ilike(term),
            )
        )
    return query


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/checkout/initiate")
async def initiate_checkout(
    store_id: uuid.UUID,
    payload: CheckoutInitiateRequest,
    user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch the store to get the Stripe account ID
    store_result = await db.execute(select(Store).where(Store.id == store_id))
    store = store_result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    if not store.stripe_account_id:
        raise HTTPException(status_code=400, detail="Store is not set up for payments")

    checkout_fingerprint = _build_checkout_fingerprint(payload)

    existing_result = await db.execute(
        select(Order)
        .where(
            Order.store_id == store_id,
            Order.checkout_fingerprint == checkout_fingerprint,
            Order.status == OrderStatus.pending_payment,
        )
        .order_by(Order.created_at.desc())
        .limit(1)
    )
    existing_order = existing_result.scalar_one_or_none()
    if existing_order:
        if existing_order.stripe_payment_intent_id:
            intent = await update_payment_intent(
                payment_intent_id=existing_order.stripe_payment_intent_id,
                amount=existing_order.total_amount,
                stripe_account=store.stripe_account_id,
                application_fee_amount=existing_order.platform_fee_amount,
                metadata={
                    "order_id": str(existing_order.id),
                    "store_id": str(store.id),
                },
            )
        else:
            intent = await create_payment_intent(
                amount=existing_order.total_amount,
                stripe_account=store.stripe_account_id,
                application_fee_amount=existing_order.platform_fee_amount,
                idempotency_key=f"pi-{existing_order.id}",
                metadata={
                    "order_id": str(existing_order.id),
                },
            )
            existing_order.stripe_payment_intent_id = intent.id
            await db.flush()

        existing_tax_rate = 0.0
        if existing_order.subtotal_amount > 0:
            existing_tax_rate = round(existing_order.tax_amount * 100 / existing_order.subtotal_amount, 2)

        return {
            "client_secret": intent.client_secret,
            "order_id": existing_order.id,
            "order_access_token": build_order_access_token(existing_order.id, existing_order.store_id),
            "subtotal": existing_order.subtotal_amount,
            "tax": existing_order.tax_amount,
            "tax_rate": existing_tax_rate,
            "platform_fee": existing_order.platform_fee_amount,
            "total": existing_order.total_amount,
        }

    # Security: Lookup real prices for products and options.
    subtotal_amount = 0
    order_items_to_create = []
    stripe_tax_items = []

    # Build IDs for lookup.
    product_ids = {item.product_id for item in payload.items}
    
    # Fetch all relevant products.
    p_result = await db.execute(
        select(Product).where(
            Product.id.in_(product_ids),
            Product.store_id == store_id,
            Product.is_active.is_(True)
        )
    )
    products = {p.id: p for p in p_result.scalars().all()}

    # Fetch all relevant options.
    all_option_ids = {
        opt.option_id
        for item in payload.items
        for opt in item.options
    }
    
    options_by_id: dict[uuid.UUID, tuple[uuid.UUID, Option]] = {}
    if all_option_ids:
        options_result = await db.execute(
            select(OptionList.product_id, Option)
            .join(Option, Option.option_list_id == OptionList.id)
            .where(Option.id.in_(all_option_ids))
        )
        options_by_id = {
            option.id: (product_id, option)
            for product_id, option in options_result.all()
        }

    for item_data in payload.items:
        product = products.get(item_data.product_id)
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item_data.product_id} not found or unavailable")

        item_total = product.unit_amount * item_data.quantity
        resolved_options: list[OrderItemOption] = []
        
        for opt_data in item_data.options:
            option_entry = options_by_id.get(opt_data.option_id)
            if not option_entry:
                raise HTTPException(status_code=400, detail=f"Option {opt_data.option_id} not found")
            
            option_product_id, option_model = option_entry
            if option_product_id != product.id:
                raise HTTPException(status_code=400, detail=f"Option {opt_data.option_id} does not belong to product {product.id}")

            option_total = option_model.unit_amount * opt_data.quantity * item_data.quantity
            item_total += option_total
            resolved_options.append(
                OrderItemOption(
                    option_id=option_model.id,
                    option_name=option_model.name,
                    unit_amount=option_model.unit_amount,
                    quantity=opt_data.quantity,
                )
            )

        subtotal_amount += item_total
        
        order_item = OrderItem(
            product_id=product.id,
            product_name=product.name,
            quantity=item_data.quantity,
            unit_amount=product.unit_amount,
            total_amount=item_total,
        )
        order_items_to_create.append((order_item, resolved_options))

        # Build Stripe Tax line item.
        stripe_tax_items.append({
            "amount": item_total,
            "reference": str(product.id),
        })

    # Call calculate_stripe_tax.
    tax_calc = await calculate_stripe_tax(
        store_stripe_account_id=store.stripe_account_id,
        currency="usd",
        line_items=stripe_tax_items,
        customer_address=payload.shipping_address.model_dump(),
    )

    print(f"Stripe tax calculation result: {tax_calc}")

    tax_amount = tax_calc.tax_amount_exclusive + tax_calc.tax_amount_inclusive
    
    # Extract total tax rate percentage by summing all breakdown components
    tax_rate = 0.0
    if tax_calc.tax_breakdown:
        for b in tax_calc.tax_breakdown:
            rate_details = b.get("tax_rate_details")
            if rate_details:
                try:
                    # percentage_decimal is a string like "8.25"
                    tax_rate += float(rate_details.get("percentage_decimal", 0.0))
                except (ValueError, TypeError):
                    continue

    settings = get_settings()
    platform_fee_percent = settings.stripe_platform_fee_percent or 0
    platform_fee_amount = int((subtotal_amount + tax_amount) * platform_fee_percent / 100)
    total_amount = subtotal_amount + tax_amount + platform_fee_amount

    order = Order(
        store_id=store_id,
        customer_id=user.id if user else None,
        status=OrderStatus.pending_payment,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        platform_fee_amount=platform_fee_amount,
        total_amount=total_amount,
        currency="USD",
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        notes=payload.notes,
        checkout_fingerprint=checkout_fingerprint,
    )
    db.add(order)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        conflict_result = await db.execute(
            select(Order)
            .where(
                Order.store_id == store_id,
                Order.checkout_fingerprint == checkout_fingerprint,
                Order.status == OrderStatus.pending_payment,
            )
            .order_by(Order.created_at.desc())
            .limit(1)
        )
        conflict_order = conflict_result.scalar_one_or_none()
        if not conflict_order:
            raise HTTPException(status_code=409, detail="Checkout is being processed, please retry")

        if conflict_order.stripe_payment_intent_id:
            intent = await update_payment_intent(
                payment_intent_id=conflict_order.stripe_payment_intent_id,
                amount=conflict_order.total_amount,
                stripe_account=store.stripe_account_id,
                application_fee_amount=conflict_order.platform_fee_amount,
                metadata={
                    "order_id": str(conflict_order.id),
                    "store_id": str(store.id),
                },
            )
        else:
            intent = await create_payment_intent(
                amount=conflict_order.total_amount,
                stripe_account=store.stripe_account_id,
                application_fee_amount=conflict_order.platform_fee_amount,
                idempotency_key=f"pi-{conflict_order.id}",
                metadata={
                    "order_id": str(conflict_order.id),
                },
            )
            conflict_order.stripe_payment_intent_id = intent.id
            await db.flush()

        existing_tax_rate = 0.0
        if conflict_order.subtotal_amount > 0:
            existing_tax_rate = round(conflict_order.tax_amount * 100 / conflict_order.subtotal_amount, 2)

        return {
            "client_secret": intent.client_secret,
            "order_id": conflict_order.id,
            "order_access_token": build_order_access_token(conflict_order.id, conflict_order.store_id),
            "subtotal": conflict_order.subtotal_amount,
            "tax": conflict_order.tax_amount,
            "tax_rate": existing_tax_rate,
            "platform_fee": conflict_order.platform_fee_amount,
            "total": conflict_order.total_amount,
        }

    for order_item, option_models in order_items_to_create:
        order_item.order_id = order.id
        db.add(order_item)
        await db.flush()

        for option_model in option_models:
            option_model.order_item_id = order_item.id
            db.add(option_model)

    await db.flush()

    # Create payment intent.
    intent = await create_payment_intent(
        amount=total_amount,
        stripe_account=store.stripe_account_id,
        application_fee_amount=platform_fee_amount,
        idempotency_key=f"pi-{order.id}",
        metadata={
            "order_id": str(order.id),
        },
    )
    
    order.stripe_payment_intent_id = intent.id
    await db.flush()

    return {
        "client_secret": intent.client_secret,
        "order_id": order.id,
        "order_access_token": build_order_access_token(order.id, order.store_id),
        "subtotal": subtotal_amount,
        "tax": tax_amount,
        "tax_rate": tax_rate,
        "platform_fee": platform_fee_amount,
        "total": total_amount,
    }


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    store_id: uuid.UUID,
    data: OrderCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser | None = Depends(get_optional_user),
):
    store_result = await db.execute(select(Store).where(Store.id == store_id))
    store = store_result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    onboarding_status = await get_store_onboarding_status(db=db, store=store)
    if not onboarding_status.onboarding_complete:
        response.headers["X-Store-Onboarding-Warning"] = (
            f"Store onboarding incomplete. Next required step: {onboarding_status.next_step_id or 'unknown'}"
        )

    product_ids = {item.product_id for item in data.items}
    products_result = await db.execute(
        select(Product).where(
            Product.store_id == store_id,
            Product.id.in_(product_ids),
            Product.is_active.is_(True),
        )
    )
    products_by_id = {product.id: product for product in products_result.scalars().all()}

    all_option_ids = {
        option.option_id
        for item in data.items
        for option in item.options
    }
    options_by_id: dict[uuid.UUID, tuple[uuid.UUID, Option]] = {}
    if all_option_ids:
        options_result = await db.execute(
            select(OptionList.product_id, Option)
            .join(Option, Option.option_list_id == OptionList.id)
            .where(Option.id.in_(all_option_ids))
        )
        options_by_id = {
            option.id: (product_id, option)
            for product_id, option in options_result.all()
        }

    subtotal_amount = 0
    order_items = []
    for item_data in data.items:
        product = products_by_id.get(item_data.product_id)
        if not product:
            raise HTTPException(
                status_code=400,
                detail=f"Product is unavailable or does not belong to this store: {item_data.product_id}",
            )

        item_total = product.unit_amount * item_data.quantity
        option_total = 0
        resolved_options: list[OrderItemOption] = []

        for incoming_option in item_data.options:
            option_entry = options_by_id.get(incoming_option.option_id)
            if not option_entry:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown option: {incoming_option.option_id}",
                )

            option_product_id, option_model = option_entry
            if option_product_id != product.id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Option does not belong to product {product.id}: {incoming_option.option_id}",
                )

            option_total += option_model.unit_amount * incoming_option.quantity * item_data.quantity
            resolved_options.append(
                OrderItemOption(
                    option_id=option_model.id,
                    option_name=option_model.name,
                    unit_amount=option_model.unit_amount,
                    quantity=incoming_option.quantity,
                )
            )

        item_total += option_total
        subtotal_amount += item_total

        order_item = OrderItem(
            product_id=item_data.product_id,
            product_name=product.name,
            quantity=item_data.quantity,
            unit_amount=product.unit_amount,
            total_amount=item_total,
        )
        order_items.append((order_item, resolved_options))

    tax_amount = round(subtotal_amount * 0.08)
    settings = get_settings()
    platform_fee_amount = int((subtotal_amount + tax_amount) * settings.stripe_platform_fee_percent / 100)
    total_amount = subtotal_amount + tax_amount + platform_fee_amount

    order = Order(
        store_id=store_id,
        customer_id=user.id if user else None,
        status=OrderStatus.pending_payment,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        platform_fee_amount=platform_fee_amount,
        total_amount=total_amount,
        currency="USD",
        decimal_places=2,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        customer_phone=data.customer_phone,
        notes=data.notes,
    )
    db.add(order)
    await db.flush()

    for order_item, option_models in order_items:
        order_item.order_id = order.id
        db.add(order_item)
        await db.flush()

        for option_model in option_models:
            option_model.order_item_id = order_item.id
            db.add(option_model)

    await db.flush()

    result = await db.execute(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.items).selectinload(OrderItem.options))
    )
    created_order = result.scalar_one()
    response_model = OrderResponse.model_validate(created_order)
    return response_model.model_copy(
        update={
            "order_access_token": build_order_access_token(created_order.id, created_order.store_id),
        }
    )


@router.get("/orders/ref/{reference}", response_model=OrderResponse)
async def get_order_by_reference(
    store_id: uuid.UUID,
    reference: str,
    ctx: StoreContext = Depends(require_permission("orders.read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Partition-aware lookup by internal reference (e.g. "20250315-K7XP-0042").
    Extracts the date from the reference so the query can constrain
    created_at, enabling partition pruning on large tables.
    """
    try:
        order_date, token, sequence = parse_order_reference(reference)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid order reference format")

    day_start = datetime.combine(order_date, time.min, tzinfo=timezone.utc)
    day_end = datetime.combine(order_date, time.max, tzinfo=timezone.utc)

    result = await db.execute(
        select(Order)
        .where(
            Order.store_id == store_id,
            Order.created_at >= day_start,   # partition pruning
            Order.created_at <= day_end,
            Order.daily_sequence == sequence,
            Order.order_token == token,
        )
        .options(selectinload(Order.items).selectinload(OrderItem.options))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/orders", response_model=OrdersPageResponse)
async def list_orders(
    ctx: StoreContext = Depends(require_permission("orders.read")),
    db: AsyncSession = Depends(get_db),
    status: str | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    q: str | None = None,
    sort: str | None = None,
    pagination: OffsetPaginationParams = Depends(get_offset_pagination),
):
    filtered_query = _apply_order_filters(
        select(Order).where(Order.store_id == ctx.store.id),
        status=status,
        created_from=created_from,
        created_to=created_to,
        q=q,
        store_timezone=ctx.store.timezone,
    )

    total_result = await db.execute(
        filtered_query.with_only_columns(func.count(Order.id)).order_by(None)
    )
    total = total_result.scalar_one() or 0
    window = resolve_offset_pagination(total, pagination)

    sort_expression, sort_field, is_desc = resolve_sort_expression(
        sort,
        allowed_columns={
            "displayId": Order.daily_sequence,
            "status": Order.status,
            "totalAmount": Order.total_amount,
            "createdAt": Order.created_at,
            "customer": Order.customer_name,
        },
        default_field="createdAt",
        default_direction="desc",
    )

    tie_breaker = Order.id.desc() if is_desc else Order.id.asc()
    order_by_expressions = [sort_expression]
    if sort_field != "id":
        order_by_expressions.append(tie_breaker)

    query = (
        _apply_order_filters(
            select(Order).where(Order.store_id == ctx.store.id),
            status=status,
            created_from=created_from,
            created_to=created_to,
            q=q,
            store_timezone=ctx.store.timezone,
        )
        .options(selectinload(Order.items).selectinload(OrderItem.options))
        .order_by(*order_by_expressions)
        .limit(window.page_size)
        .offset(window.offset)
    )
    result = await db.execute(query)
    order_models = [
        OrderResponse.model_validate(order)
        for order in result.scalars().unique().all()
    ]
    return OrdersPageResponse(
        items=order_models,
        total=window.total,
        page=window.page,
        page_size=window.page_size,
        page_count=window.page_count,
    )


@router.post("/orders/lookup", response_model=OrderLookupResponse)
async def lookup_order(
    store_id: uuid.UUID,
    payload: OrderLookupRequest,
    db: AsyncSession = Depends(get_db),
):
    lookup_value = payload.order_identifier.strip().upper()
    normalized_email = _normalize_email(payload.email)
    normalized_phone = _normalize_phone(payload.phone)

    if not normalized_email and not normalized_phone:
        raise HTTPException(status_code=400, detail="Provide email or phone to verify the order")

    result = await db.execute(
        select(Order)
        .where(
            Order.store_id == store_id,
            or_(
                func.upper(Order.display_id) == lookup_value,
                func.upper(Order.order_reference) == lookup_value,
            ),
        )
        .order_by(Order.created_at.desc())
    )
    candidates = result.scalars().all()
    if not candidates:
        raise HTTPException(status_code=404, detail="Order not found")

    matched_order = None
    for candidate in candidates:
        email_ok = bool(
            normalized_email
            and _normalize_email(candidate.customer_email) == normalized_email
        )
        phone_ok = bool(
            normalized_phone
            and _normalize_phone(candidate.customer_phone) == normalized_phone
        )
        if email_ok or phone_ok:
            matched_order = candidate
            break

    if not matched_order:
        raise HTTPException(status_code=404, detail="Order not found")

    return OrderLookupResponse(
        order_id=matched_order.id,
        order_access_token=build_order_access_token(matched_order.id, matched_order.store_id),
    )


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    store_id: uuid.UUID,
    order_id: uuid.UUID,
    access_token: str | None = Query(default=None, alias="access"),
    user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.store_id == store_id)
        .options(selectinload(Order.items).selectinload(OrderItem.options))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    has_valid_token = bool(access_token and validate_order_access_token(order.id, order.store_id, access_token))

    is_owner_customer = bool(user and order.customer_id and user.id == order.customer_id)

    is_store_member = False
    if user:
        member_result = await db.execute(
            select(StoreMember.id).where(
                StoreMember.store_id == order.store_id,
                StoreMember.user_id == user.id,
            )
        )
        is_store_member = member_result.scalar_one_or_none() is not None

    if not (has_valid_token or is_owner_customer or is_store_member):
        raise HTTPException(status_code=403, detail="Not allowed to view this order")

    return order


@router.patch("/orders/{order_id}", response_model=OrderResponse)
async def update_order(
    store_id: uuid.UUID,
    order_id: uuid.UUID,
    data: OrderUpdate,
    access_token: str | None = Query(default=None, alias="access"),
    user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Update order details (e.g. contact info) before payment is finalized."""
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.store_id == store_id)
        .options(selectinload(Order.items).selectinload(OrderItem.options))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Security check: must have valid guest token, be the customer who placed
    # it, or be a store member.
    has_valid_token = bool(access_token and validate_order_access_token(order.id, order.store_id, access_token))
    is_owner_customer = bool(user and order.customer_id and user.id == order.customer_id)
    is_store_member = False
    if user:
        member_result = await db.execute(
            select(StoreMember.id).where(
                StoreMember.store_id == order.store_id,
                StoreMember.user_id == user.id,
            )
        )
        is_store_member = member_result.scalar_one_or_none() is not None

    if not (has_valid_token or is_owner_customer or is_store_member):
        raise HTTPException(status_code=403, detail="Not allowed to update this order")

    # Guard: only pending orders can be updated.
    if order.status != OrderStatus.pending_payment:
        raise HTTPException(
            status_code=400,
            detail="Only pending payment orders can be updated.",
        )

    # Apply updates
    if data.customer_name is not None:
        order.customer_name = data.customer_name
    if data.customer_email is not None:
        order.customer_email = data.customer_email
    if data.customer_phone is not None:
        order.customer_phone = data.customer_phone
    if data.notes is not None:
        order.notes = data.notes

    await db.flush()
    await db.refresh(order, attribute_names=["updated_at"])
    return order


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: uuid.UUID,
    data: OrderStatusUpdate,
    ctx: StoreContext = Depends(require_permission("orders.write")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.store_id == ctx.store.id)
        .options(selectinload(Order.items).selectinload(OrderItem.options))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    previous_status = order.status
    order.status = data.status
    await db.flush()

    if previous_status != order.status and order.customer_email:
        email_enqueued = await enqueue_order_status_update_email(
            order.customer_email,
            order=order,
            store_name=ctx.store.name,
            previous_status=previous_status,
        )
        if not email_enqueued:
            logger.warning(
                "failed to enqueue order status update email order_id=%s recipient=%s",
                order.id,
                order.customer_email,
            )

    await db.refresh(order, attribute_names=["updated_at"])
    return order