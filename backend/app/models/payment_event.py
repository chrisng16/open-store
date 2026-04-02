import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PaymentEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "payment_events"

    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="stripe")
    provider_event_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )

    def __repr__(self) -> str:
        return f"<PaymentEvent {self.provider}:{self.event_type}:{self.provider_event_id}>"
