import uuid
from datetime import date, datetime, time, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.pagination import get_offset_pagination, OffsetPaginationParams, resolve_offset_pagination
from app.api.sorting import resolve_sort_expression
from app.database import get_db
from app.api.deps import (
    get_current_user,
    get_store_context,
    require_role,
    get_optional_user,
    CurrentUser,
    StoreContext,
)
from app.models.store import MemberRole, Store
from app.models.order import Order, OrderItem, OrderItemOption, OrderStatus
from app.schemas.order import OrderCreate, OrderResponse, OrdersPageResponse, OrderStatusUpdate
from app.services.onboarding import get_store_onboarding_status

router = APIRouter(prefix="/stores/{store_id}", tags=["orders"])


def _apply_order_filters(
    query,
    *,
    status: str | None,
    created_from: date | None,
    created_to: date | None,
    q: str | None,
):
    if status:
        valid_statuses = [
            OrderStatus(s.strip())
            for s in status.split(",")
            if s.strip() in {e.value for e in OrderStatus}
        ]
        if valid_statuses:
            query = query.where(Order.status.in_(valid_statuses))
    if created_from:
        start_dt = datetime.combine(created_from, time.min).replace(tzinfo=timezone.utc)
        query = query.where(Order.created_at >= start_dt)
    if created_to:
        end_dt = datetime.combine(created_to, time.max).replace(tzinfo=timezone.utc)
        query = query.where(Order.created_at <= end_dt)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                Order.customer_name.ilike(term),
                Order.customer_email.ilike(term),
                Order.customer_phone.ilike(term),
                cast(Order.order_number, String).ilike(term),
            )
        )
    return query


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

    # Calculate next order number for this store
    result = await db.execute(
        select(func.coalesce(func.max(Order.order_number), 0)).where(Order.store_id == store_id)
    )
    next_order_number = (result.scalar() or 0) + 1

    # Calculate totals
    subtotal_amount = 0
    order_items = []
    for item_data in data.items:
        item_total = item_data.unit_amount * item_data.quantity
        option_total = sum(o.unit_amount * o.quantity for o in item_data.options) * item_data.quantity
        item_total += option_total
        subtotal_amount += item_total

        order_item = OrderItem(
            product_id=item_data.product_id,
            product_name=item_data.product_name,
            quantity=item_data.quantity,
            unit_amount=item_data.unit_amount,
            total_amount=item_total,
        )
        order_items.append((order_item, item_data.options))

    tax_amount = round(subtotal_amount * 0.08)
    total_amount = subtotal_amount + tax_amount

    order = Order(
        store_id=store_id,
        customer_id=user.id if user else None,
        status=OrderStatus.pending,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        total_amount=total_amount,
        currency="USD",
        decimal_places=2,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        customer_phone=data.customer_phone,
        notes=data.notes,
        order_number=next_order_number,
    )
    db.add(order)
    await db.flush()

    for order_item, option_data_list in order_items:
        order_item.order_id = order.id
        db.add(order_item)
        await db.flush()

        for option_data in option_data_list:
            option = OrderItemOption(
                order_item_id=order_item.id,
                option_id=option_data.option_id,
                option_name=option_data.option_name,
                unit_amount=option_data.unit_amount,
                quantity=option_data.quantity,
            )
            db.add(option)

    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.items).selectinload(OrderItem.options))
    )
    return result.scalar_one()


@router.get("/orders", response_model=OrdersPageResponse)
async def list_orders(
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
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
    )

    total_result = await db.execute(
        filtered_query.with_only_columns(func.count(Order.id)).order_by(None)
    )
    total = total_result.scalar_one() or 0
    window = resolve_offset_pagination(total, pagination)

    sort_expression, sort_field, is_desc = resolve_sort_expression(
        sort,
        allowed_columns={
            "orderNumber": Order.order_number,
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
        )
        .options(selectinload(Order.items).selectinload(OrderItem.options))
        .order_by(*order_by_expressions)
        .limit(window.page_size)
        .offset(window.offset)
    )
    result = await db.execute(query)
    return OrdersPageResponse(
        items=result.scalars().unique().all(),
        total=window.total,
        page=window.page,
        page_size=window.page_size,
        page_count=window.page_count,
    )


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    store_id: uuid.UUID,
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
    return order


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: uuid.UUID,
    data: OrderStatusUpdate,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
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

    order.status = data.status
    await db.flush()
    await db.refresh(order, attribute_names=["updated_at"])
    return order
