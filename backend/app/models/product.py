import uuid
from decimal import Decimal
from sqlalchemy import String, Boolean, Text, Integer, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Category(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "categories"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    store: Mapped["Store"] = relationship(back_populates="categories")
    products: Mapped[list["Product"]] = relationship(back_populates="category", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        state = inspect(self)
        name = state.dict.get("name")
        if name is not None:
            return f"<Category {name}>"
        identity = state.identity[0] if state.identity else None
        return f"<Category id={identity}>"


class Product(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "products"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    dietary_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    allergens: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    ingredients: Mapped[str | None] = mapped_column(Text, nullable=True)
    # embedding column for Phase 2 semantic search — vector(768)
    # Will be added via migration when pgvector is enabled

    # Relationships
    store: Mapped["Store"] = relationship(back_populates="products")
    category: Mapped["Category | None"] = relationship(back_populates="products")
    modifier_groups: Mapped[list["ModifierGroup"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        state = inspect(self)
        name = state.dict.get("name")
        base_price = state.dict.get("base_price")
        if name is not None and base_price is not None:
            return f"<Product {name} ${base_price}>"
        identity = state.identity[0] if state.identity else None
        return f"<Product id={identity}>"


class ModifierGroup(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "modifier_groups"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    min_selections: Mapped[int] = mapped_column(Integer, default=0)
    max_selections: Mapped[int] = mapped_column(Integer, default=1)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="modifier_groups")
    modifiers: Mapped[list["Modifier"]] = relationship(
        back_populates="modifier_group", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        state = inspect(self)
        name = state.dict.get("name")
        if name is not None:
            return f"<ModifierGroup {name}>"
        identity = state.identity[0] if state.identity else None
        return f"<ModifierGroup id={identity}>"


class Modifier(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "modifiers"

    modifier_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modifier_groups.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price_adjustment: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    modifier_group: Mapped["ModifierGroup"] = relationship(back_populates="modifiers")

    def __repr__(self) -> str:
        state = inspect(self)
        name = state.dict.get("name")
        price_adjustment = state.dict.get("price_adjustment")
        if name is not None and price_adjustment is not None:
            return f"<Modifier {name} +${price_adjustment}>"
        identity = state.identity[0] if state.identity else None
        return f"<Modifier id={identity}>"


# Avoid circular import
from app.models.store import Store  # noqa: E402, F811
