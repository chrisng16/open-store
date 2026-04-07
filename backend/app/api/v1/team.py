import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    BASE_ROLE_PERMISSIONS,
    ROLE_HIERARCHY,
    CurrentUser,
    StoreContext,
    ensure_manage_target,
    get_current_user,
    require_permission,
)
from app.database import get_db
from app.models.audit import AuditLog
from app.models.store import InviteStatus, MemberRole, StoreInvite, StoreMember, StoreRole
from app.schemas.team import (
    TeamInviteAcceptResponse,
    TeamInviteCreate,
    TeamInviteResponse,
    TeamMemberResponse,
    TeamMemberRoleBulkApplyRequest,
    TeamMemberRoleBulkApplyResponse,
    TeamMemberRoleUpdate,
    TeamRoleCreate,
    TeamRoleResponse,
    TeamRoleUpdate,
)
from app.services.supabase_admin import get_supabase_user_profiles
from app.services.email import enqueue_store_invitation_email
from app.config import get_settings
from app.services.team import build_invite_link, generate_invite_token, invite_expiration, utcnow

store_router = APIRouter(prefix="/stores/{store_id}", tags=["team"])
accept_router = APIRouter(prefix="/team", tags=["team"])
logger = logging.getLogger(__name__)


def _serialize_invite(invite: StoreInvite) -> TeamInviteResponse:
    payload = TeamInviteResponse.model_validate(invite).model_dump(exclude={"invite_link"})
    payload["invite_link"] = build_invite_link(invite.token)
    return TeamInviteResponse(**payload)


def _serialize_role(role: StoreRole) -> TeamRoleResponse:
    return TeamRoleResponse(
        id=role.id,
        store_id=role.store_id,
        name=role.name,
        description=role.description,
        priority=role.priority,
        permissions=role.permissions,
        is_system=role.is_system,
        is_editable=role.is_editable,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


def _serialize_member(member: StoreMember, profile: dict[str, str | None] | None = None) -> TeamMemberResponse:
    profile = profile or {}
    role_name = member.store_role.name if member.store_role else member.role.value
    role_priority = member.store_role.priority if member.store_role else ROLE_HIERARCHY[member.role]
    permissions = member.store_role.permissions if member.store_role else sorted(BASE_ROLE_PERMISSIONS[member.role])

    return TeamMemberResponse(
        id=member.id,
        store_id=member.store_id,
        user_id=member.user_id,
        name=profile.get("name"),
        email=profile.get("email"),
        role=member.role,
        role_name=role_name,
        role_priority=role_priority,
        permissions=permissions,
        created_at=member.created_at,
        updated_at=member.updated_at,
    )


async def _get_store_role_or_404(db: AsyncSession, store_id: uuid.UUID, role_id: uuid.UUID) -> StoreRole:
    result = await db.execute(
        select(StoreRole).where(StoreRole.id == role_id, StoreRole.store_id == store_id)
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@store_router.get("/roles", response_model=list[TeamRoleResponse])
async def list_store_roles(
    store_id: uuid.UUID,
    _: StoreContext = Depends(require_permission("team.roles.read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StoreRole)
        .where(StoreRole.store_id == store_id)
        .order_by(StoreRole.priority.desc(), StoreRole.name.asc())
    )
    return [_serialize_role(role) for role in result.scalars().all()]


@store_router.post("/roles", response_model=TeamRoleResponse, status_code=status.HTTP_201_CREATED)
async def create_store_role(
    store_id: uuid.UUID,
    data: TeamRoleCreate,
    ctx: StoreContext = Depends(require_permission("team.roles.write")),
    db: AsyncSession = Depends(get_db),
):
    if data.priority >= ctx.role_priority:
        raise HTTPException(status_code=403, detail="Cannot create a role with equal or higher priority than your own")

    role_name = data.name.strip().lower().replace(" ", "-")
    if role_name in {"owner"}:
        raise HTTPException(status_code=400, detail="The owner role cannot be created manually")

    exists_result = await db.execute(
        select(StoreRole.id).where(StoreRole.store_id == store_id, StoreRole.name == role_name)
    )
    if exists_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Role name already exists")

    role = StoreRole(
        store_id=store_id,
        name=role_name,
        description=data.description,
        priority=data.priority,
        permissions=sorted(set(data.permissions)),
        is_system=False,
        is_editable=True,
    )
    db.add(role)
    await db.flush()
    await db.refresh(role)

    db.add(
        AuditLog(
            store_id=store_id,
            user_id=ctx.member.user_id,
            action="team_role_created",
            entity_type="store_role",
            entity_id=role.id,
            new_data={"name": role.name, "priority": role.priority, "permissions": role.permissions},
        )
    )

    return _serialize_role(role)


@store_router.patch("/roles/{role_id}", response_model=TeamRoleResponse)
async def update_store_role(
    store_id: uuid.UUID,
    role_id: uuid.UUID,
    data: TeamRoleUpdate,
    ctx: StoreContext = Depends(require_permission("team.roles.write")),
    db: AsyncSession = Depends(get_db),
):
    role = await _get_store_role_or_404(db, store_id, role_id)
    if role.priority >= ctx.role_priority:
        raise HTTPException(status_code=403, detail="Cannot edit a role with equal or higher priority than your own")
    if role.is_system and role.name == "owner":
        raise HTTPException(status_code=403, detail="Owner role cannot be edited")

    old_data = {"description": role.description, "priority": role.priority, "permissions": role.permissions}

    if data.description is not None:
        role.description = data.description
    if data.priority is not None:
        if data.priority >= ctx.role_priority:
            raise HTTPException(status_code=403, detail="Updated priority must be lower than your own")
        role.priority = data.priority
    if data.permissions is not None:
        role.permissions = sorted(set(data.permissions))

    db.add(
        AuditLog(
            store_id=store_id,
            user_id=ctx.member.user_id,
            action="team_role_updated",
            entity_type="store_role",
            entity_id=role.id,
            old_data=old_data,
            new_data={"description": role.description, "priority": role.priority, "permissions": role.permissions},
        )
    )

    await db.flush()
    await db.refresh(role)
    return _serialize_role(role)


@store_router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_store_role(
    store_id: uuid.UUID,
    role_id: uuid.UUID,
    ctx: StoreContext = Depends(require_permission("team.roles.write")),
    db: AsyncSession = Depends(get_db),
):
    role = await _get_store_role_or_404(db, store_id, role_id)
    if role.is_system:
        raise HTTPException(status_code=403, detail="System roles cannot be deleted")
    if role.priority >= ctx.role_priority:
        raise HTTPException(status_code=403, detail="Cannot delete a role with equal or higher priority than your own")

    members_result = await db.execute(
        select(StoreMember.id).where(StoreMember.store_id == store_id, StoreMember.store_role_id == role_id)
    )
    member_ids = [row[0] for row in members_result.fetchall()]
    if member_ids:
        raise HTTPException(status_code=409, detail="Role is in use by one or more team members")

    db.add(
        AuditLog(
            store_id=store_id,
            user_id=ctx.member.user_id,
            action="team_role_deleted",
            entity_type="store_role",
            entity_id=role.id,
            old_data={"name": role.name, "priority": role.priority, "permissions": role.permissions},
        )
    )
    await db.delete(role)


@store_router.get("/members", response_model=list[TeamMemberResponse])
async def list_team_members(
    store_id: uuid.UUID,
    _: StoreContext = Depends(require_permission("team.members.read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StoreMember)
        .options(selectinload(StoreMember.store_role))
        .where(StoreMember.store_id == store_id)
        .order_by(StoreMember.created_at.asc())
    )
    members = result.scalars().all()
    profiles = await get_supabase_user_profiles([member.user_id for member in members])

    return [_serialize_member(member, profiles.get(member.user_id)) for member in members]


@store_router.patch("/members/{member_id}/role", response_model=TeamMemberResponse)
async def update_member_role(
    store_id: uuid.UUID,
    member_id: uuid.UUID,
    data: TeamMemberRoleUpdate,
    ctx: StoreContext = Depends(require_permission("team.members.write")),
    db: AsyncSession = Depends(get_db),
):
    member_result = await db.execute(
        select(StoreMember)
        .options(selectinload(StoreMember.store_role))
        .where(StoreMember.id == member_id, StoreMember.store_id == store_id)
    )
    member = member_result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    ensure_manage_target(ctx, member)
    role = await _get_store_role_or_404(db, store_id, data.role_id)
    if role.priority >= ctx.role_priority:
        raise HTTPException(status_code=403, detail="Cannot assign a role with equal or higher priority than your own")

    old_data = {
        "store_role_id": str(member.store_role_id) if member.store_role_id else None,
        "role": member.role.value,
    }

    member.store_role_id = role.id
    if role.name in MemberRole._value2member_map_:
        member.role = MemberRole(role.name)

    await db.flush()
    member_result = await db.execute(
        select(StoreMember)
        .options(selectinload(StoreMember.store_role))
        .where(StoreMember.id == member.id)
    )
    refreshed_member = member_result.scalar_one()

    db.add(
        AuditLog(
            store_id=store_id,
            user_id=ctx.member.user_id,
            action="team_member_role_updated",
            entity_type="store_member",
            entity_id=member.id,
            old_data=old_data,
            new_data={"store_role_id": str(refreshed_member.store_role_id), "role": refreshed_member.role.value},
        )
    )

    profiles = await get_supabase_user_profiles([refreshed_member.user_id])
    return _serialize_member(refreshed_member, profiles.get(refreshed_member.user_id))


@store_router.post("/members/roles/apply", response_model=TeamMemberRoleBulkApplyResponse)
async def apply_member_roles(
    store_id: uuid.UUID,
    data: TeamMemberRoleBulkApplyRequest,
    ctx: StoreContext = Depends(require_permission("team.members.write")),
    db: AsyncSession = Depends(get_db),
):
    applied_count = 0
    for update in data.updates:
        member_result = await db.execute(
            select(StoreMember)
            .options(selectinload(StoreMember.store_role))
            .where(StoreMember.id == update.member_id, StoreMember.store_id == store_id)
        )
        member = member_result.scalar_one_or_none()
        if member is None:
            raise HTTPException(status_code=404, detail=f"Member not found: {update.member_id}")

        ensure_manage_target(ctx, member)

        role = await _get_store_role_or_404(db, store_id, update.role_id)
        if role.priority >= ctx.role_priority:
            raise HTTPException(status_code=403, detail="Cannot assign a role with equal or higher priority than your own")

        member.store_role_id = role.id
        if role.name in MemberRole._value2member_map_:
            member.role = MemberRole(role.name)

        db.add(
            AuditLog(
                store_id=store_id,
                user_id=ctx.member.user_id,
                action="team_member_role_updated",
                entity_type="store_member",
                entity_id=member.id,
                new_data={"store_role_id": str(member.store_role_id), "role": member.role.value},
            )
        )
        applied_count += 1

    return TeamMemberRoleBulkApplyResponse(applied_count=applied_count)


@store_router.get("/invites", response_model=list[TeamInviteResponse])
async def list_store_invites(
    store_id: uuid.UUID,
    _: StoreContext = Depends(require_permission("team.invites.read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StoreInvite)
        .where(StoreInvite.store_id == store_id)
        .order_by(StoreInvite.created_at.desc())
    )
    invites = result.scalars().all()
    return [_serialize_invite(invite) for invite in invites]


@store_router.post("/invites", response_model=TeamInviteResponse, status_code=status.HTTP_201_CREATED)
async def create_store_invite(
    store_id: uuid.UUID,
    data: TeamInviteCreate,
    user: CurrentUser = Depends(get_current_user),
    ctx: StoreContext = Depends(require_permission("team.invites.write")),
    db: AsyncSession = Depends(get_db),
):
    if data.role == MemberRole.owner:
        raise HTTPException(status_code=400, detail="Invites cannot grant owner role")

    normalized_email = data.invited_email.strip().lower()
    if normalized_email == user.email.strip().lower():
        raise HTTPException(status_code=400, detail="You are already a member of this store")

    existing_invite_result = await db.execute(
        select(StoreInvite).where(
            StoreInvite.store_id == store_id,
            StoreInvite.invited_email == normalized_email,
            StoreInvite.status == InviteStatus.pending,
        )
    )
    existing_invite = existing_invite_result.scalar_one_or_none()
    if existing_invite:
        raise HTTPException(status_code=409, detail="There is already a pending invite for this email")

    invite = StoreInvite(
        store_id=store_id,
        invited_by_user_id=user.id,
        invited_email=normalized_email,
        role=data.role,
        token=generate_invite_token(),
        status=InviteStatus.pending,
        expires_at=invite_expiration(),
    )
    db.add(invite)
    await db.flush()
    await db.refresh(invite)

    invite_link = build_invite_link(invite.token)
    email_enqueued = await enqueue_store_invitation_email(
        normalized_email,
        store_name=ctx.store.name,
        inviter_email=user.email,
        invite_link=invite_link,
        role=invite.role.value,
        expires_at=invite.expires_at.isoformat(),
    )
    if not email_enqueued and get_settings().email_enabled:
        logger.warning(
            "failed to enqueue invitation email store_id=%s invite_id=%s recipient=%s",
            store_id,
            invite.id,
            normalized_email,
        )

    return _serialize_invite(invite)


@store_router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_store_invite(
    store_id: uuid.UUID,
    invite_id: uuid.UUID,
    _: StoreContext = Depends(require_permission("team.invites.write")),
    db: AsyncSession = Depends(get_db),
):
    invite_result = await db.execute(
        select(StoreInvite).where(StoreInvite.id == invite_id, StoreInvite.store_id == store_id)
    )
    invite = invite_result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.status != InviteStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending invites can be revoked")

    invite.status = InviteStatus.revoked


@accept_router.post("/invites/accept/{token}", response_model=TeamInviteAcceptResponse)
async def accept_store_invite(
    token: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    invite_result = await db.execute(select(StoreInvite).where(StoreInvite.token == token))
    invite = invite_result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    now = utcnow()
    if invite.status != InviteStatus.pending:
        raise HTTPException(status_code=400, detail="Invite is no longer pending")

    if invite.expires_at < now:
        raise HTTPException(status_code=400, detail="Invite has expired")

    if invite.invited_email.strip().lower() != user.email.strip().lower():
        raise HTTPException(status_code=403, detail="Invite email does not match signed-in user")

    member_result = await db.execute(
        select(StoreMember)
        .options(selectinload(StoreMember.store_role))
        .where(StoreMember.store_id == invite.store_id, StoreMember.user_id == user.id)
    )
    member = member_result.scalar_one_or_none()

    role_result = await db.execute(
        select(StoreRole).where(StoreRole.store_id == invite.store_id, StoreRole.name == invite.role.value)
    )
    fallback_role = role_result.scalar_one_or_none()

    if member:
        member.role = invite.role
        if fallback_role is not None:
            member.store_role_id = fallback_role.id
    else:
        db.add(
            StoreMember(
                store_id=invite.store_id,
                user_id=user.id,
                role=invite.role,
                store_role_id=fallback_role.id if fallback_role is not None else None,
            )
        )

    invite.status = InviteStatus.accepted
    invite.accepted_at = now

    return TeamInviteAcceptResponse(
        store_id=invite.store_id,
        role=invite.role,
        status="accepted",
    )
