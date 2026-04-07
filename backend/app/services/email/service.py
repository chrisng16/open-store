import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from functools import lru_cache
from pathlib import Path
from typing import Literal, NotRequired, TypedDict
from urllib.parse import urlparse

from arq.connections import RedisSettings, create_pool
import certifi
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.models.order import Order, OrderStatus
from app.schemas.email import (
    OrderConfirmationEmailContext,
    OrderStatusUpdateEmailContext,
    StoreInvitationEmailContext,
)

logger = logging.getLogger(__name__)

EmailTemplateKey = Literal[
    "store_invitation",
    "order_confirmation",
    "order_status_update",
]


class EmailDispatchResult(TypedDict):
    status: Literal["enqueued", "disabled", "failed"]
    reason: NotRequired[str]

_TEMPLATE_SCHEMAS: dict[str, type[BaseModel]] = {
    "store_invitation": StoreInvitationEmailContext,
    "order_confirmation": OrderConfirmationEmailContext,
    "order_status_update": OrderStatusUpdateEmailContext,
}


def _build_redis_settings() -> RedisSettings:
    settings = get_settings()
    parsed = urlparse(settings.redis_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379
    db = int(parsed.path.lstrip("/") or "0")
    use_ssl = parsed.scheme == "rediss"
    cert_reqs = (settings.redis_ssl_cert_reqs or "required").lower()
    if cert_reqs not in {"none", "optional", "required"}:
        cert_reqs = "required"

    return RedisSettings(
        host=host,
        port=port,
        database=db,
        username=parsed.username,
        password=parsed.password,
        ssl=use_ssl,
        ssl_cert_reqs=cert_reqs,
        ssl_ca_certs=settings.redis_ssl_ca_certs if use_ssl else None,
    )


@lru_cache
def _get_template_env() -> Environment:
    template_root = Path(__file__).resolve().parent / "templates"
    return Environment(
        loader=FileSystemLoader(str(template_root)),
        autoescape=select_autoescape(["html", "xml"]),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )


def _template_schema(template_key: EmailTemplateKey) -> type[BaseModel]:
    schema = _TEMPLATE_SCHEMAS.get(template_key)
    if schema is None:
        raise ValueError(f"Unknown email template key: {template_key}")
    return schema


def _render_email(template_key: EmailTemplateKey, context: dict) -> tuple[str, str, str, dict]:
    schema = _template_schema(template_key)
    payload = schema.model_validate(context).model_dump()

    env = _get_template_env()
    subject = env.get_template(f"{template_key}.subject.j2").render(**payload).strip()
    text_body = env.get_template(f"{template_key}.text.j2").render(**payload).strip()
    html_body = env.get_template(f"{template_key}.html.j2").render(**payload).strip()
    return subject, text_body, html_body, payload


def _send_smtp_message_sync(recipient: str, subject: str, text_body: str, html_body: str) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        raise RuntimeError("SMTP host is not configured")
    if not settings.smtp_from_email:
        raise RuntimeError("SMTP from email is not configured")

    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    timeout = max(1, settings.smtp_timeout_seconds)
    tls_context = ssl.create_default_context(cafile=certifi.where())
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=timeout) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls(context=tls_context)
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


async def send_template_email(template_key: EmailTemplateKey, recipient: str, context: dict) -> dict:
    settings = get_settings()

    if not settings.email_enabled:
        return {"status": "disabled", "template_key": template_key}

    if not recipient:
        return {"status": "skipped", "reason": "empty_recipient", "template_key": template_key}

    try:
        subject, text_body, html_body, payload = _render_email(template_key, context)
    except ValidationError as exc:
        logger.warning(
            "email context validation failed template=%s recipient=%s error=%s",
            template_key,
            recipient,
            exc,
        )
        return {"status": "failed", "reason": "invalid_context", "template_key": template_key}
    except ValueError as exc:
        logger.warning("email template validation failed template=%s error=%s", template_key, exc)
        return {"status": "failed", "reason": "invalid_template", "template_key": template_key}

    try:
        await asyncio.to_thread(_send_smtp_message_sync, recipient, subject, text_body, html_body)
        logger.info("email sent template=%s recipient=%s", template_key, recipient)
        return {
            "status": "sent",
            "template_key": template_key,
            "recipient": recipient,
            "payload": payload,
        }
    except Exception as exc:  # pragma: no cover
        logger.exception("email send failed template=%s recipient=%s", template_key, recipient)
        return {
            "status": "failed",
            "template_key": template_key,
            "recipient": recipient,
            "error": str(exc),
        }


async def enqueue_template_email(
    template_key: EmailTemplateKey,
    recipient: str,
    context: dict,
) -> EmailDispatchResult:
    settings = get_settings()
    if not settings.email_enabled:
        return {"status": "disabled", "reason": "email_disabled"}

    from app.workers.menu_ingestion import QUEUE_EMAIL

    redis = None
    try:
        redis = await create_pool(_build_redis_settings())
        await redis.enqueue_job(
            "send_email_task",
            template_key,
            recipient,
            context,
            _queue_name=QUEUE_EMAIL,
        )
        return {"status": "enqueued"}
    except Exception as exc:
        logger.exception("email enqueue failed template=%s recipient=%s", template_key, recipient)
        return {"status": "failed", "reason": str(exc)}
    finally:
        if redis is not None:
            await redis.close()


def _format_money(amount: int, currency: str, decimal_places: int) -> str:
    value = amount / (10 ** decimal_places)
    return f"{currency.upper()} {value:.{decimal_places}f}"


def _status_label(status: str | OrderStatus) -> str:
    raw = status.value if isinstance(status, OrderStatus) else status
    return raw.replace("_", " ").title()


async def enqueue_store_invitation_email(
    recipient: str,
    *,
    store_name: str,
    inviter_email: str,
    invite_link: str,
    role: str,
    expires_at: str,
) -> bool:
    context = {
        "store_name": store_name,
        "invited_email": recipient,
        "inviter_email": inviter_email,
        "invite_link": invite_link,
        "role": role,
        "expires_at": expires_at,
    }
    result = await enqueue_template_email("store_invitation", recipient, context)
    return result["status"] == "enqueued"


async def enqueue_order_confirmation_email(
    recipient: str,
    *,
    order: Order,
    store_name: str,
) -> bool:
    if not recipient:
        return False

    context = {
        "store_name": store_name,
        "customer_name": (order.customer_name or "Customer").strip() or "Customer",
        "order_display_id": order.display_id or str(order.id),
        "order_reference": order.order_reference,
        "status": _status_label(order.status),
        "total_amount_display": _format_money(order.total_amount, order.currency, order.decimal_places),
    }
    result = await enqueue_template_email("order_confirmation", recipient, context)
    return result["status"] == "enqueued"


async def enqueue_order_status_update_email(
    recipient: str,
    *,
    order: Order,
    store_name: str,
    previous_status: OrderStatus,
) -> bool:
    if not recipient:
        return False

    context = {
        "store_name": store_name,
        "customer_name": (order.customer_name or "Customer").strip() or "Customer",
        "order_display_id": order.display_id or str(order.id),
        "previous_status": _status_label(previous_status),
        "new_status": _status_label(order.status),
        "total_amount_display": _format_money(order.total_amount, order.currency, order.decimal_places),
    }
    result = await enqueue_template_email("order_status_update", recipient, context)
    return result["status"] == "enqueued"
