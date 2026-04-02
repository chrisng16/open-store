import uuid
import enum
from sqlalchemy import String, Text, Integer, ForeignKey, Enum, UniqueConstraint, Index, text as sa_text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import inspect
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OrderStatus(str, enum.Enum):
    pending = "pending"
    pending_payment = "pending_payment"
    confirmed = "confirmed"
    preparing = "preparing"
    ready = "ready"
    completed = "completed"
    cancelled = "cancelled"


class Order(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "orders"
    __table_args__ = (
        # Uniqueness is now scoped to store + day + sequence so the sequence
        # can safely reset to 1 each UTC day without collisions across days.
        UniqueConstraint(
            "store_id", "daily_sequence", "order_token",
            name="uq_orders_store_daily_sequence_token",
        ),
        # Unique index on order_reference for support-tool lookups.
        # Partial or full — full is fine since the reference already encodes
        # the store date, making collisions across stores impossible.
        Index("ix_orders_order_reference", "order_reference", unique=True),
        # Non-unique index on display_id so customer-facing search is fast.
        Index("ix_orders_display_id", "display_id"),
        # Deterministic checkout idempotency for active pending orders.
        Index(
            "uq_orders_active_checkout_fingerprint",
            "store_id",
            "checkout_fingerprint",
            unique=True,
            postgresql_where=sa_text("status = 'pending_payment'::orderstatus"),
        ),
    )

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), nullable=False, default=OrderStatus.pending_payment
    )
    subtotal_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, default=0)
    platform_fee_amount: Mapped[int] = mapped_column(Integer, default=0)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    decimal_places: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    checkout_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # ------------------------------------------------------------------
    # Order identification — replaces the old all-time `order_number`.
    #
    #   daily_sequence   int          Resets to 1 each UTC day per store.
    #                                 Kept small and human-readable.
    #
    #   order_token      VARCHAR(8)   Random suffix (e.g. "K7XP").
    #                                 Prevents enumeration without being a
    #                                 true secret.
    #
    #   order_reference  VARCHAR(32)  Internal / support-staff reference.
    #                                 Format: "YYYYMMDD-<token>-<seq>"
    #                                 e.g.    "20250315-K7XP-0042"
    #                                 Encodes the date so DB lookups can
    #                                 constrain created_at for partition
    #                                 pruning.
    #
    #   display_id       VARCHAR(16)  Customer-facing ID shown on receipts,
    #                                 confirmation emails, and SMS.
    #                                 Format: "<token>-<seq>"
    #                                 e.g.    "K7XP-0042"
    # ------------------------------------------------------------------
    daily_sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    order_token: Mapped[str | None] = mapped_column(String(8), nullable=True)
    order_reference: Mapped[str | None] = mapped_column(String(32), nullable=True)
    display_id: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Relationships
    store: Mapped["Store"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        state = inspect(self)
        display_id = state.dict.get("display_id")
        status = state.dict.get("status")
        if display_id is not None and status is not None:
            return f"<Order {display_id} {status}>"
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