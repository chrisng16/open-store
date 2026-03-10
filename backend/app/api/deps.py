import uuid
from typing import Annotated, Any, cast

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import httpx
import jwt

from app.config import get_settings
from app.database import get_db
from app.models.store import MemberRole, Store, StoreMember

get_settings.cache_clear()

_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.get(settings.supabase_jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()

    assert _jwks_cache is not None
    return _jwks_cache


def clear_jwks_cache() -> None:
    global _jwks_cache
    _jwks_cache = None


class CurrentUser:
    def __init__(self, id: uuid.UUID, email: str, raw_token: str):
        self.id = id
        self.email = email
        self.raw_token = raw_token


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = authorization.removeprefix("Bearer ")
    settings = get_settings()

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        kid = header.get("kid")

        if alg is None:
            raise jwt.InvalidAlgorithmError("Missing token algorithm")

        if alg.startswith("HS"):
            if not settings.supabase_jwt_secret:
                raise jwt.InvalidTokenError("HS token received but Supabase JWT secret is not configured")
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=[alg],
                audience="authenticated",
            )
        elif alg.startswith("RS") or alg.startswith("ES"):
            if not settings.supabase_jwks_url:
                raise jwt.InvalidTokenError("Asymmetric token received but Supabase JWKS URL is not configured")

            jwks = await _get_jwks()
            key = None
            for jwk_key in jwks.get("keys", []):
                key_kid = jwk_key.get("kid")
                key_alg = jwk_key.get("alg")
                kid_matches = key_kid == kid if kid is not None else True
                alg_matches = key_alg == alg if key_alg else True
                if kid_matches and alg_matches:
                    key = jwt.PyJWK.from_dict(cast(dict[str, Any], jwk_key)).key
                    break

            if not key:
                raise jwt.InvalidKeyError("No matching key found")

            payload = jwt.decode(
                token,
                cast(Any, key),
                algorithms=[alg],
                audience="authenticated",
            )
        else:
            raise jwt.InvalidAlgorithmError(f"Unsupported token algorithm: {alg}")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as e:
        clear_jwks_cache()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")

    user_id = payload.get("sub")
    email = payload.get("email", "")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    return CurrentUser(id=uuid.UUID(user_id), email=email, raw_token=token)


async def get_optional_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser | None:
    if not authorization:
        return None
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None


ROLE_HIERARCHY = {MemberRole.staff: 20, MemberRole.admin: 60, MemberRole.owner: 100}

BASE_ROLE_PERMISSIONS: dict[MemberRole, set[str]] = {
    MemberRole.owner: {
        "team.members.read",
        "team.members.write",
        "team.roles.read",
        "team.roles.write",
        "team.invites.read",
        "team.invites.write",
    },
    MemberRole.admin: {
        "team.members.read",
        "team.members.write",
        "team.roles.read",
        "team.invites.read",
        "team.invites.write",
    },
    MemberRole.staff: {"team.members.read"},
}


class StoreContext:
    def __init__(
        self,
        store: Store,
        member: StoreMember,
        role: MemberRole,
        role_name: str,
        role_priority: int,
        permissions: set[str],
    ):
        self.store = store
        self.member = member
        self.role = role
        self.role_name = role_name
        self.role_priority = role_priority
        self.permissions = permissions


async def get_store_by_id(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Store:
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.business_hour_entries))
        .where(Store.id == store_id)
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return store


def _member_role_priority(member: StoreMember) -> int:
    if member.store_role is not None:
        return member.store_role.priority
    return ROLE_HIERARCHY[member.role]


def _member_role_name(member: StoreMember) -> str:
    if member.store_role is not None:
        return member.store_role.name
    return member.role.value


def _member_permissions(member: StoreMember) -> set[str]:
    if member.store_role is not None:
        return set(member.store_role.permissions)
    return BASE_ROLE_PERMISSIONS[member.role]


async def get_store_context(
    store_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StoreContext:
    store = await get_store_by_id(store_id, db)
    result = await db.execute(
        select(StoreMember)
        .options(selectinload(StoreMember.store_role))
        .where(
            StoreMember.store_id == store_id,
            StoreMember.user_id == user.id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this store",
        )

    return StoreContext(
        store=store,
        member=member,
        role=member.role,
        role_name=_member_role_name(member),
        role_priority=_member_role_priority(member),
        permissions=_member_permissions(member),
    )


def require_role(min_role: MemberRole):
    async def _check(ctx: StoreContext = Depends(get_store_context)) -> StoreContext:
        if ctx.role_priority < ROLE_HIERARCHY[min_role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least {min_role.value} role",
            )
        return ctx

    return _check


def require_permission(permission: str):
    async def _check(ctx: StoreContext = Depends(get_store_context)) -> StoreContext:
        if permission not in ctx.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}",
            )
        return ctx

    return _check


def ensure_manage_target(actor: StoreContext, target: StoreMember) -> None:
    if actor.member.id == target.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot modify your own membership")

    actor_priority = actor.role_priority
    target_priority = _member_role_priority(target)
    if actor_priority <= target_priority:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only modify members with a lower-priority role",
        )
