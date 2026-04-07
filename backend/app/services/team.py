import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.models.store import StoreRole

from app.config import get_settings


INVITE_TTL_DAYS = 7

DEFAULT_STORE_ROLES = [
    {
        "name": "owner",
        "description": "Store owner role",
        "priority": 100,
        "permissions": [
            "team.members.read",
            "team.members.write",
            "team.roles.read",
            "team.roles.write",
            "team.invites.read",
            "team.invites.write",
        ],
        "is_system": True,
        "is_editable": False,
    },
    {
        "name": "admin",
        "description": "Store admin role",
        "priority": 60,
        "permissions": [
            "team.members.read",
            "team.members.write",
            "team.roles.read",
            "team.invites.read",
            "team.invites.write",
        ],
        "is_system": True,
        "is_editable": True,
    },
    {
        "name": "staff",
        "description": "Store staff role",
        "priority": 20,
        "permissions": ["team.members.read"],
        "is_system": True,
        "is_editable": True,
    },
]


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def invite_expiration() -> datetime:
    return utcnow() + timedelta(days=INVITE_TTL_DAYS)


def build_invite_link(token: str) -> str:
    settings = get_settings()
    return f"{settings.frontend_url}/invites/{token}"


def build_default_store_roles(store_id: uuid.UUID) -> list[StoreRole]:
    return [
        StoreRole(
            store_id=store_id,
            name=role_data["name"],
            description=role_data["description"],
            priority=role_data["priority"],
            permissions=role_data["permissions"],
            is_system=role_data["is_system"],
            is_editable=role_data["is_editable"],
        )
        for role_data in DEFAULT_STORE_ROLES
    ]
