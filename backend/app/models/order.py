import uuid
import enum
from sqlalchemy import String, Text, Integer, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import inspect
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    preparing = "preparing"
    ready = "ready"
    completed = "completed"
    cancelled = "cancelled"


class Order(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "orders"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), nullable=False, default=OrderStatus.pending
    )
    subtotal_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, default=0)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    decimal_places: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    store: Mapped["Store"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        state = inspect(self)
        order_number = state.dict.get("order_number")
        status = state.dict.get("status")
        if order_number is not None and status is not None:
            return f"<Order #{order_number} {status}>"
        identity = state.identity[0] if state.identity else None
        return f"<Order id={identity}>"


class OrderItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)  # Snapshot
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    order: Mapped["Order"] = relationship(back_populates="items")
    options: Mapped[list["OrderItemOption"]] = relationship(
        back_populates="order_item", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        state = inspect(self)
        product_name = state.dict.get("product_name")
        quantity = state.dict.get("quantity")
        if product_name is not None and quantity is not None:
            return f"<OrderItem {product_name} x{quantity}>"
        identity = state.identity[0] if state.identity else None
        return f"<OrderItem id={identity}>"


class OrderItemOption(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "order_item_options"

    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False
    )
    option_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("options.id", ondelete="SET NULL"), nullable=True
    )
    option_name: Mapped[str] = mapped_column(String(255), nullable=False)  # Snapshot
    unit_amount: Mapped[int] = mapped_column(Integer, default=0)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Relationships
    order_item: Mapped["OrderItem"] = relationship(back_populates="options")

    def __repr__(self) -> str:
        state = inspect(self)
        option_name = state.dict.get("option_name")
        if option_name is not None:
            return f"<OrderItemOption {option_name}>"
        identity = state.identity[0] if state.identity else None
        return f"<OrderItemOption id={identity}>"


# Avoid circular import
from app.models.store import Store  # noqa: E402, F811
