import uuid
import enum
from datetime import datetime
from sqlalchemy import DateTime, String, Boolean, Text, ForeignKey, UniqueConstraint, Enum, Integer, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.orm.base import NO_VALUE
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MemberRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    staff = "staff"


class InviteStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    revoked = "revoked"
    expired = "expired"


DAY_OF_WEEK_ORDER = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")


class Store(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "stores"

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    theme_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)
    stripe_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    # Relationships
    members: Mapped[list["StoreMember"]] = relationship(back_populates="store", cascade="all, delete-orphan")
    business_hour_entries: Mapped[list["StoreBusinessHour"]] = relationship(
        back_populates="store", cascade="all, delete-orphan"
    )
    categories: Mapped[list["Category"]] = relationship(back_populates="store", cascade="all, delete-orphan")
    products: Mapped[list["Product"]] = relationship(back_populates="store", cascade="all, delete-orphan")
    orders: Mapped[list["Order"]] = relationship(back_populates="store", cascade="all, delete-orphan")
    menu_imports: Mapped[list["MenuImport"]] = relationship(back_populates="store", cascade="all, delete-orphan")
    invites: Mapped[list["StoreInvite"]] = relationship(back_populates="store", cascade="all, delete-orphan")
    roles: Mapped[list["StoreRole"]] = relationship(back_populates="store", cascade="all, delete-orphan")

    @property
    def business_hours(self) -> dict | None:
        loaded_entries = inspect(self).attrs.business_hour_entries.loaded_value
        if loaded_entries is NO_VALUE:
            return None

        if not loaded_entries:
            return None

        business_hours: dict[str, dict] = {day: {"status": "closed"} for day in DAY_OF_WEEK_ORDER}

        for day in DAY_OF_WEEK_ORDER:
            day_entries = [entry for entry in loaded_entries if entry.day_of_week == day]
            if not day_entries:
                continue

            day_entries.sort(key=lambda entry: entry.sort_order)
            status = day_entries[0].status
            if status == "ranges":
                business_hours[day] = {
                    "status": "ranges",
                    "ranges": [
                        {"start_min": entry.start_min, "end_min": entry.end_min}
                        for entry in day_entries
                        if entry.start_min is not None and entry.end_min is not None
                    ],
                }
            else:
                business_hours[day] = {"status": status}

        return business_hours

    def set_business_hours(self, business_hours: dict | None) -> None:
        existing_by_slot = {
            (entry.day_of_week, entry.sort_order): entry for entry in self.business_hour_entries
        }
        desired_slots: set[tuple[str, int]] = set()

        if business_hours:
            for day in DAY_OF_WEEK_ORDER:
                day_data = business_hours.get(day)
                if not day_data:
                    continue

                status = day_data["status"]
                if status == "ranges":
                    for index, hour_range in enumerate(day_data.get("ranges", [])):
                        slot = (day, index)
                        desired_slots.add(slot)
                        existing = existing_by_slot.get(slot)
                        if existing:
                            existing.status = "ranges"
                            existing.start_min = hour_range["start_min"]
                            existing.end_min = hour_range["end_min"]
                        else:
                            self.business_hour_entries.append(
                                StoreBusinessHour(
                                    day_of_week=day,
                                    status="ranges",
                                    start_min=hour_range["start_min"],
                                    end_min=hour_range["end_min"],
                                    sort_order=index,
                                )
                            )
                else:
                    slot = (day, 0)
                    desired_slots.add(slot)
                    existing = existing_by_slot.get(slot)
                    if existing:
                        existing.status = status
                        existing.start_min = None
                        existing.end_min = None
                    else:
                        self.business_hour_entries.append(
                            StoreBusinessHour(day_of_week=day, status=status, sort_order=0)
                        )

        for entry in list(self.business_hour_entries):
            slot = (entry.day_of_week, entry.sort_order)
            if slot not in desired_slots:
                self.business_hour_entries.remove(entry)

    def __repr__(self) -> str:
        state = inspect(self)
        slug = state.dict.get("slug")
        if slug is not None:
            return f"<Store {slug}>"
        identity = state.identity[0] if state.identity else None
        return f"<Store id={identity}>"


class StoreMember(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "store_members"
    __table_args__ = (UniqueConstraint("store_id", "user_id", name="uq_store_member"),)

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    role: Mapped[MemberRole] = mapped_column(Enum(MemberRole), nullable=False, default=MemberRole.staff)
    store_role_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("store_roles.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Relationships
    store: Mapped["Store"] = relationship(back_populates="members")
    store_role: Mapped["StoreRole | None"] = relationship(back_populates="members")

    def __repr__(self) -> str:
        return f"<StoreMember store={self.store_id} user={self.user_id} role={self.role}>"


class StoreBusinessHour(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "store_business_hours"
    __table_args__ = (
        UniqueConstraint("store_id", "day_of_week", "sort_order", name="uq_store_business_hour_slot"),
        CheckConstraint("day_of_week IN ('sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat')", name="ck_store_business_hours_day"),
        CheckConstraint("status IN ('open24', 'closed', 'ranges')", name="ck_store_business_hours_status"),
        CheckConstraint(
            "((status = 'ranges' AND start_min IS NOT NULL AND end_min IS NOT NULL AND end_min > start_min) "
            "OR (status IN ('open24', 'closed') AND start_min IS NULL AND end_min IS NULL))",
            name="ck_store_business_hours_range_shape",
        ),
    )

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_of_week: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    start_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    store: Mapped["Store"] = relationship(back_populates="business_hour_entries")

    def __repr__(self) -> str:
        return (
            f"<StoreBusinessHour store={self.store_id} day={self.day_of_week} "
            f"status={self.status} order={self.sort_order}>"
        )


class StoreInvite(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "store_invites"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invited_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    invited_email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[MemberRole] = mapped_column(Enum(MemberRole), nullable=False, default=MemberRole.staff)
    token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    status: Mapped[InviteStatus] = mapped_column(
        Enum(InviteStatus), nullable=False, default=InviteStatus.pending, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    store: Mapped["Store"] = relationship(back_populates="invites")

    def __repr__(self) -> str:
        return f"<StoreInvite store={self.store_id} email={self.invited_email} status={self.status}>"


class StoreRole(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "store_roles"
    __table_args__ = (UniqueConstraint("store_id", "name", name="uq_store_roles_store_name"),)

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    permissions: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_editable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    store: Mapped["Store"] = relationship(back_populates="roles")
    members: Mapped[list["StoreMember"]] = relationship(back_populates="store_role")

    def __repr__(self) -> str:
        return f"<StoreRole store={self.store_id} name={self.name} priority={self.priority}>"


# Avoid circular imports — these are referenced as strings in relationships
from app.models.product import Category, Product  # noqa: E402, F811
from app.models.order import Order  # noqa: E402, F811
from app.models.menu_import import MenuImport  # noqa: E402, F811
