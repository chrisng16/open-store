import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_user, get_store_context, require_role, CurrentUser, StoreContext
from app.models.store import Store, StoreMember, MemberRole
from app.schemas.store import StoreCreate, StoreUpdate, StoreResponse, StorePublicResponse
from app.services.team import build_default_store_roles

router = APIRouter(prefix="/stores", tags=["stores"])

@router.get("", response_model=list[StoreResponse])
async def list_stores(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.business_hour_entries))
        .join(StoreMember, StoreMember.store_id == Store.id)
        .where(StoreMember.user_id == user.id)
    )
    return result.scalars().all()

@router.post("", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
async def create_store(
    data: StoreCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check slug uniqueness
    existing = await db.execute(select(Store).where(Store.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slug already taken")

    store = Store(
        owner_id=user.id,
        name=data.name,
        slug=data.slug,
        description=data.description,
        address=data.address,
        phone=data.phone,
        timezone=data.timezone,
    )
    if data.business_hours:
        store.set_business_hours(data.business_hours.model_dump())
    db.add(store)
    await db.flush()

    seeded_roles = build_default_store_roles(store.id)
    for role in seeded_roles:
        db.add(role)
    await db.flush()

    owner_role = next(role for role in seeded_roles if role.name == MemberRole.owner.value)

    # Make the creator the owner
    member = StoreMember(
        store_id=store.id,
        user_id=user.id,
        role=MemberRole.owner,
        store_role_id=owner_role.id,
    )
    db.add(member)
    await db.flush()
    await db.refresh(store)

    return store


@router.get("/slug/{slug}", response_model=StorePublicResponse)
async def get_store_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.business_hour_entries))
        .where(Store.slug == slug, Store.is_active == True)
    )

    print("Executed query for slug:", slug)  # Debug log
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store

@router.get("/{store_id}", response_model=StorePublicResponse)
async def get_store_by_id(
    store_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.business_hour_entries))
        .where(Store.id == store_id)
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@router.patch("/{store_id}", response_model=StoreResponse)
async def update_store(
    data: StoreUpdate,
    ctx: StoreContext = Depends(require_role(MemberRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    store = ctx.store
    update_data = data.model_dump(exclude_unset=True)
    business_hours = update_data.pop("business_hours", Ellipsis)

    for field, value in update_data.items():
        setattr(store, field, value)
    if business_hours is not Ellipsis:
        store.set_business_hours(business_hours)
    await db.flush()
    await db.refresh(store)
    return store
