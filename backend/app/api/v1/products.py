import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_store_context, require_role, StoreContext
from app.models.store import MemberRole
from app.models.product import Category, Product, ModifierGroup, Modifier
from app.schemas.product import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
)

router = APIRouter(prefix="/stores/{store_id}", tags=["products"])


# --- Categories ---


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category)
        .where(Category.store_id == store_id)
        .order_by(Category.sort_order)
    )
    return result.scalars().all()


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    category = Category(store_id=ctx.store.id, **data.model_dump())
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.store_id == ctx.store.id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.flush()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    ctx: StoreContext = Depends(require_role(MemberRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.store_id == ctx.store.id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(category)


# --- Products ---


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    store_id: uuid.UUID,
    category_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Product)
        .where(Product.store_id == store_id, Product.is_active == True)
        .options(selectinload(Product.modifier_groups).selectinload(ModifierGroup.modifiers))
        .order_by(Product.sort_order)
    )
    if category_id:
        query = query.where(Product.category_id == category_id)
    result = await db.execute(query)
    return result.scalars().unique().all()


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    store_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id, Product.store_id == store_id)
        .options(selectinload(Product.modifier_groups).selectinload(ModifierGroup.modifiers))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    product_data = data.model_dump(exclude={"modifier_groups"})
    product = Product(store_id=ctx.store.id, **product_data)
    db.add(product)
    await db.flush()

    # Create modifier groups + modifiers
    for mg_data in data.modifier_groups:
        mg = ModifierGroup(
            product_id=product.id,
            name=mg_data.name,
            min_selections=mg_data.min_selections,
            max_selections=mg_data.max_selections,
            is_required=mg_data.is_required,
        )
        db.add(mg)
        await db.flush()

        for mod_data in mg_data.modifiers:
            mod = Modifier(
                modifier_group_id=mg.id,
                name=mod_data.name,
                price_adjustment=mod_data.price_adjustment,
                is_default=mod_data.is_default,
                sort_order=mod_data.sort_order,
            )
            db.add(mod)

    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(selectinload(Product.modifier_groups).selectinload(ModifierGroup.modifiers))
    )
    return result.scalar_one()


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id, Product.store_id == ctx.store.id)
        .options(selectinload(Product.modifier_groups).selectinload(ModifierGroup.modifiers))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_payload = data.model_dump(exclude_unset=True, exclude={"modifier_groups"})
    for field, value in update_payload.items():
        setattr(product, field, value)

    if data.modifier_groups is not None:
        product.modifier_groups.clear()
        await db.flush()

        for mg_data in data.modifier_groups:
            mg = ModifierGroup(
                product_id=product.id,
                name=mg_data.name,
                min_selections=mg_data.min_selections,
                max_selections=mg_data.max_selections,
                is_required=mg_data.is_required,
            )
            product.modifier_groups.append(mg)

            for mod_data in mg_data.modifiers:
                mg.modifiers.append(
                    Modifier(
                        name=mod_data.name,
                        price_adjustment=mod_data.price_adjustment,
                        is_default=mod_data.is_default,
                        sort_order=mod_data.sort_order,
                    )
                )

    await db.flush()
    await db.refresh(product, attribute_names=["updated_at"])
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    ctx: StoreContext = Depends(require_role(MemberRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.store_id == ctx.store.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)
