import uuid
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
from app.schemas.order import OrderCreate, OrderResponse, OrderStatusUpdate
from app.services.onboarding import get_store_onboarding_status

router = APIRouter(prefix="/stores/{store_id}", tags=["orders"])


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


@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
    status_filter: OrderStatus | None = None,
    limit: int = 50,
    offset: int = 0,
):
    query = (
        select(Order)
        .where(Order.store_id == ctx.store.id)
        .options(selectinload(Order.items).selectinload(OrderItem.options))
        .order_by(Order.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status_filter:
        query = query.where(Order.status == status_filter)
    result = await db.execute(query)
    return result.scalars().unique().all()


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
