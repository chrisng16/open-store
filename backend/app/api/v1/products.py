import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.pagination import get_offset_pagination, OffsetPaginationParams, resolve_offset_pagination
from app.api.sorting import resolve_sort_expression
from app.database import get_db
from app.api.deps import get_store_context, require_permission, require_role, StoreContext
from app.models.store import MemberRole
from app.models.product import Category, Product, OptionList, Option
from app.schemas.product import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoriesPageResponse,
    ProductWithCategoryListItemResponse,
    ProductsPageResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
)

router = APIRouter(prefix="/stores/{store_id}", tags=["products"])


# --- Categories ---


@router.get("/categories", response_model=CategoriesPageResponse)
async def list_categories(
    store_id: uuid.UUID,
    status_filter: str = "all",
    q: str | None = None,
    sort: str | None = None,
    pagination: OffsetPaginationParams = Depends(get_offset_pagination),
    db: AsyncSession = Depends(get_db),
):
    filtered_query = select(Category).where(Category.store_id == store_id)

    if status_filter == "active":
        filtered_query = filtered_query.where(Category.is_active.is_(True))
    elif status_filter == "hidden":
        filtered_query = filtered_query.where(Category.is_active.is_(False))

    if q:
        term = f"%{q.strip()}%"
        filtered_query = filtered_query.where(
            or_(
                Category.name.ilike(term),
                Category.description.ilike(term),
            )
        )

    total_result = await db.execute(
        filtered_query.with_only_columns(func.count(Category.id)).order_by(None)
    )
    total = total_result.scalar_one() or 0
    window = resolve_offset_pagination(total, pagination)

    sort_expression, _, is_desc = resolve_sort_expression(
        sort,
        allowed_columns={
            "name": Category.name,
            "description": Category.description,
            "isActive": Category.is_active,
            "sortOrder": Category.sort_order,
            "createdAt": Category.created_at,
            "updatedAt": Category.updated_at,
        },
        default_field="name",
        default_direction="asc",
    )
    tie_breaker = Category.id.desc() if is_desc else Category.id.asc()

    result = await db.execute(
        filtered_query
        .order_by(sort_expression, tie_breaker)
        .limit(window.page_size)
        .offset(window.offset)
    )
    category_items = [CategoryResponse.model_validate(category) for category in result.scalars().all()]
    return CategoriesPageResponse(
        items=category_items,
        total=window.total,
        page=window.page,
        page_size=window.page_size,
        page_count=window.page_count,
    )


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    ctx: StoreContext = Depends(require_permission("categories.write")),
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
    ctx: StoreContext = Depends(require_permission("categories.write")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.store_id == ctx.store.id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    was_active = category.is_active
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)

    # Hiding a category also hides all products assigned to it.
    if was_active and category.is_active is False:
        await db.execute(
            update(Product)
            .where(
                Product.store_id == ctx.store.id,
                Product.category_id == category.id,
                Product.is_active.is_(True),
            )
            .values(is_active=False)
        )

    await db.flush()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    ctx: StoreContext = Depends(require_role(MemberRole.owner)),
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


@router.get("/products", response_model=ProductsPageResponse)
async def list_products(
    store_id: uuid.UUID,
    category_id: uuid.UUID | None = None,
    status_filter: str = "active",
    q: str | None = None,
    sort: str | None = None,
    pagination: OffsetPaginationParams = Depends(get_offset_pagination),
    db: AsyncSession = Depends(get_db),
):
    filtered_query = (
        select(Product)
        .outerjoin(Category, Product.category_id == Category.id)
        .where(Product.store_id == store_id)
    )

    if status_filter == "active":
        filtered_query = filtered_query.where(Product.is_active.is_(True))
    elif status_filter == "hidden":
        filtered_query = filtered_query.where(Product.is_active.is_(False))

    if category_id:
        filtered_query = filtered_query.where(Product.category_id == category_id)

    if q:
        term = f"%{q.strip()}%"
        filtered_query = filtered_query.where(
            or_(
                Product.name.ilike(term),
                Product.description.ilike(term),
                Product.ingredients.ilike(term),
            )
        )

    total_result = await db.execute(
        filtered_query.with_only_columns(func.count(Product.id)).order_by(None)
    )
    total = total_result.scalar_one() or 0
    window = resolve_offset_pagination(total, pagination)

    sort_expression, _, is_desc = resolve_sort_expression(
        sort,
        allowed_columns={
            "name": Product.name,
            "category": func.coalesce(Category.name, ""),
            "unitAmount": Product.unit_amount,
            "isActive": Product.is_active,
            "sortOrder": Product.sort_order,
            "createdAt": Product.created_at,
            "updatedAt": Product.updated_at,
        },
        default_field="name",
        default_direction="asc",
    )
    tie_breaker = Product.id.desc() if is_desc else Product.id.asc()

    result = await db.execute(
        filtered_query
        .options(
            selectinload(Product.category),
            selectinload(Product.option_lists).selectinload(OptionList.options)
        )
        .order_by(sort_expression, tie_breaker)
        .limit(window.page_size)
        .offset(window.offset)
    )
    product_items = [
        ProductWithCategoryListItemResponse.model_validate(product)
        for product in result.scalars().unique().all()
    ]
    return ProductsPageResponse(
        items=product_items,
        total=window.total,
        page=window.page,
        page_size=window.page_size,
        page_count=window.page_count,
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    store_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id, Product.store_id == store_id)
        .options(selectinload(Product.option_lists).selectinload(OptionList.options))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    ctx: StoreContext = Depends(require_permission("products.write")),
    db: AsyncSession = Depends(get_db),
):
    product_data = data.model_dump(exclude={"option_lists"})
    product = Product(store_id=ctx.store.id, **product_data)
    db.add(product)
    await db.flush()

    # Create option lists + options
    for ol_data in data.option_lists:
        ol = OptionList(
            product_id=product.id,
            name=ol_data.name,
            selection_node=ol_data.selection_node,
            min_num_options=ol_data.min_num_options,
            max_num_options=ol_data.max_num_options,
            min_aggregate_options_quantity=ol_data.min_aggregate_options_quantity,
            max_aggregate_options_quantity=ol_data.max_aggregate_options_quantity,
            is_optional=ol_data.is_optional,
            sort_order=ol_data.sort_order,
        )
        db.add(ol)
        await db.flush()

        for option_data in ol_data.options:
            option = Option(
                option_list_id=ol.id,
                name=option_data.name,
                unit_amount=option_data.unit_amount,
                currency=option_data.currency,
                decimal_places=option_data.decimal_places,
                min_option_choice_quantity=option_data.min_option_choice_quantity,
                max_option_choice_quantity=option_data.max_option_choice_quantity,
                default_quantity=option_data.default_quantity,
                is_default=option_data.is_default,
                sort_order=option_data.sort_order,
            )
            db.add(option)

    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(selectinload(Product.option_lists).selectinload(OptionList.options))
    )
    return result.scalar_one()


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    ctx: StoreContext = Depends(require_permission("products.write")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id, Product.store_id == ctx.store.id)
        .options(selectinload(Product.option_lists).selectinload(OptionList.options))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_payload = data.model_dump(exclude_unset=True, exclude={"option_lists"})
    if "unit_amount" in update_payload and "products.pricing.write" not in ctx.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can update product prices",
        )

    for field, value in update_payload.items():
        setattr(product, field, value)

    if data.option_lists is not None:
        # 1. Map existing option lists by ID for easy lookup
        existing_ol_map = {ol.id: ol for ol in product.option_lists}
        incoming_ol_ids = {ol_data.id for ol_data in data.option_lists if ol_data.id}

        # 2. Remove option lists that are not in the incoming data
        for ol_id in list(existing_ol_map.keys()):
            if ol_id not in incoming_ol_ids:
                # This will also delete orphan options due to cascade="all, delete-orphan"
                product.option_lists.remove(existing_ol_map[ol_id])

        # 3. Process incoming option lists
        for ol_data in data.option_lists:
            if ol_data.id and ol_data.id in existing_ol_map:
                # Update existing option list
                ol = existing_ol_map[ol_data.id]
                for field, value in ol_data.model_dump(exclude_unset=True, exclude={"id", "options"}).items():
                    setattr(ol, field, value)
            else:
                # Create new option list
                ol = OptionList(
                    product_id=product.id,
                    name=ol_data.name,
                    selection_node=ol_data.selection_node,
                    min_num_options=ol_data.min_num_options,
                    max_num_options=ol_data.max_num_options,
                    min_aggregate_options_quantity=ol_data.min_aggregate_options_quantity,
                    max_aggregate_options_quantity=ol_data.max_aggregate_options_quantity,
                    is_optional=ol_data.is_optional,
                    sort_order=ol_data.sort_order,
                )
                product.option_lists.append(ol)

            # 4. Process options for this list (same merge logic)
            existing_opt_map = {opt.id: opt for opt in ol.options}
            incoming_opt_ids = {opt_data.id for opt_data in ol_data.options if opt_data.id}

            # Remove options not in incoming data
            for opt_id in list(existing_opt_map.keys()):
                if opt_id not in incoming_opt_ids:
                    ol.options.remove(existing_opt_map[opt_id])

            # Update or create options
            for opt_data in ol_data.options:
                if opt_data.id and opt_data.id in existing_opt_map:
                    opt = existing_opt_map[opt_data.id]
                    for field, value in opt_data.model_dump(exclude_unset=True, exclude={"id"}).items():
                        setattr(opt, field, value)
                else:
                    ol.options.append(
                        Option(
                            name=opt_data.name,
                            unit_amount=opt_data.unit_amount,
                            currency=opt_data.currency,
                            decimal_places=opt_data.decimal_places,
                            min_option_choice_quantity=opt_data.min_option_choice_quantity,
                            max_option_choice_quantity=opt_data.max_option_choice_quantity,
                            default_quantity=opt_data.default_quantity,
                            is_default=opt_data.is_default,
                            sort_order=opt_data.sort_order,
                        )
                    )

    await db.flush()
    await db.refresh(product, attribute_names=["updated_at"])
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    ctx: StoreContext = Depends(require_role(MemberRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.store_id == ctx.store.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)
