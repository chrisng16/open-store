import uuid
from datetime import datetime

from pydantic import AliasChoices, BaseModel, Field

from app.models.store import MemberRole, InviteStatus


class TeamInviteCreate(BaseModel):
    invited_email: str = Field(
        min_length=3,
        max_length=255,
        validation_alias=AliasChoices("invited_email", "invitedEmail", "email")
    )
    role: MemberRole = MemberRole.admin


class TeamInviteResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    invited_by_user_id: uuid.UUID
    invited_email: str
    role: MemberRole
    status: InviteStatus
    token: str
    invite_link: str = ""
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamMemberResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    user_id: uuid.UUID
    name: str | None = None
    email: str | None = None
    role: MemberRole
    role_name: str
    role_priority: int
    permissions: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamInviteAcceptResponse(BaseModel):
    store_id: uuid.UUID
    role: MemberRole
    status: str


class TeamRoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=64)
    description: str | None = Field(default=None, max_length=500)
    priority: int = Field(ge=0, le=100)
    permissions: list[str] = Field(default_factory=list)


class TeamRoleUpdate(BaseModel):
    description: str | None = Field(default=None, max_length=500)
    priority: int | None = Field(default=None, ge=0, le=100)
    permissions: list[str] | None = None


class TeamRoleResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    name: str
    description: str | None = None
    priority: int
    permissions: list[str] = Field(default_factory=list)
    is_system: bool
    is_editable: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamMemberRoleUpdate(BaseModel):
    role_id: uuid.UUID


class TeamMemberRoleBulkItem(BaseModel):
    member_id: uuid.UUID
    role_id: uuid.UUID


class TeamMemberRoleBulkApplyRequest(BaseModel):
    updates: list[TeamMemberRoleBulkItem] = Field(default_factory=list)


class TeamMemberRoleBulkApplyResponse(BaseModel):
    applied_count: int
