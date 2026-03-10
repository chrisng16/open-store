import uuid
from sqlalchemy import String, Boolean, Text, Integer, ForeignKey
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
    unit_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    decimal_places: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
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
    option_lists: Mapped[list["OptionList"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        state = inspect(self)
        name = state.dict.get("name")
        unit_amount = state.dict.get("unit_amount")
        if name is not None and unit_amount is not None:
            return f"<Product {name} {unit_amount}c>"
        identity = state.identity[0] if state.identity else None
        return f"<Product id={identity}>"


class OptionList(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "option_lists"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    selection_node: Mapped[str] = mapped_column(String(32), nullable=False, default="multi_select")
    min_num_options: Mapped[int] = mapped_column(Integer, default=0)
    max_num_options: Mapped[int] = mapped_column(Integer, default=1)
    min_aggregate_options_quantity: Mapped[int] = mapped_column(Integer, default=0)
    max_aggregate_options_quantity: Mapped[int] = mapped_column(Integer, default=0)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="option_lists")
    options: Mapped[list["Option"]] = relationship(
        back_populates="option_list", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        state = inspect(self)
        name = state.dict.get("name")
        if name is not None:
            return f"<OptionList {name}>"
        identity = state.identity[0] if state.identity else None
        return f"<OptionList id={identity}>"


class Option(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "options"

    option_list_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("option_lists.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_amount: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    decimal_places: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    min_option_choice_quantity: Mapped[int] = mapped_column(Integer, default=0)
    max_option_choice_quantity: Mapped[int] = mapped_column(Integer, default=1)
    default_quantity: Mapped[int] = mapped_column(Integer, default=0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    option_list: Mapped["OptionList"] = relationship(back_populates="options")

    def __repr__(self) -> str:
        state = inspect(self)
        name = state.dict.get("name")
        unit_amount = state.dict.get("unit_amount")
        if name is not None and unit_amount is not None:
            return f"<Option {name} +{unit_amount}c>"
        identity = state.identity[0] if state.identity else None
        return f"<Option id={identity}>"


# Avoid circular import
from app.models.store import Store  # noqa: E402, F811
