import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
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
from app.models.store import MemberRole
from app.models.order import Order, OrderItem, OrderItemModifier, OrderStatus
from app.schemas.order import OrderCreate, OrderResponse, OrderStatusUpdate

router = APIRouter(prefix="/stores/{store_id}", tags=["orders"])


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    store_id: uuid.UUID,
    data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser | None = Depends(get_optional_user),
):
    # Calculate next order number for this store
    result = await db.execute(
        select(func.coalesce(func.max(Order.order_number), 0)).where(Order.store_id == store_id)
    )
    next_order_number = (result.scalar() or 0) + 1

    # Calculate totals
    subtotal = Decimal("0.00")
    order_items = []
    for item_data in data.items:
        item_total = item_data.unit_price * item_data.quantity
        modifier_total = sum(m.price_adjustment for m in item_data.modifiers) * item_data.quantity
        item_total += modifier_total
        subtotal += item_total

        order_item = OrderItem(
            product_id=item_data.product_id,
            product_name=item_data.product_name,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            total_price=item_total,
        )
        order_items.append((order_item, item_data.modifiers))

    tax = (subtotal * Decimal("0.08")).quantize(Decimal("0.01"))  # 8% default tax
    total = subtotal + tax

    order = Order(
        store_id=store_id,
        customer_id=user.id if user else None,
        status=OrderStatus.pending,
        subtotal=subtotal,
        tax=tax,
        total=total,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        customer_phone=data.customer_phone,
        notes=data.notes,
        order_number=next_order_number,
    )
    db.add(order)
    await db.flush()

    for order_item, modifier_data_list in order_items:
        order_item.order_id = order.id
        db.add(order_item)
        await db.flush()

        for mod_data in modifier_data_list:
            mod = OrderItemModifier(
                order_item_id=order_item.id,
                modifier_id=mod_data.modifier_id,
                modifier_name=mod_data.modifier_name,
                price_adjustment=mod_data.price_adjustment,
            )
            db.add(mod)

    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
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
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
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
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
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
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = data.status
    await db.flush()
    await db.refresh(order, attribute_names=["updated_at"])
    return order
