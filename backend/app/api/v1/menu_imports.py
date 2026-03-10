import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse
from arq.connections import RedisSettings, create_pool
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.api.deps import get_current_user, get_store_context, require_role, StoreContext
from app.models.store import MemberRole
from app.models.menu_import import MenuImport, MenuImportItem, ImportStatus, ImportItemStatus, FileType
from app.models.upload import UploadAsset, UploadAssetStatus, UploadIntent
from app.models.product import Category, Product, OptionList, Option
from app.models.audit import AuditLog
from app.schemas.menu_import import (
    MenuImportResponse,
    MenuImportItemUpdate,
    MenuImportItemsBatchUpdateRequest,
)
from app.schemas.upload import CreateMenuImportFromUploadRequest
from app.services.storage import upload_file

router = APIRouter(prefix="/stores/{store_id}/menu-imports", tags=["menu-imports"])


def _detect_file_type(filename: str) -> FileType:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mapping = {"pdf": FileType.pdf, "csv": FileType.csv, "xlsx": FileType.xlsx}
    if ext in mapping:
        return mapping[ext]
    if ext in ("png", "jpg", "jpeg", "webp", "heic"):
        return FileType.image
    raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")


def _redis_settings() -> RedisSettings:
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


async def _enqueue_menu_import(import_id: uuid.UUID) -> bool:
    try:
        redis = await create_pool(_redis_settings())
        await redis.enqueue_job("process_menu_import_task", str(import_id))
        await redis.close()
        return True
    except Exception:
        return False


async def _get_menu_import_with_items(db: AsyncSession, import_id: uuid.UUID) -> MenuImport:
    result = await db.execute(
        select(MenuImport)
        .where(MenuImport.id == import_id)
        .options(selectinload(MenuImport.items))
    )
    menu_import = result.scalar_one_or_none()
    if not menu_import:
        raise HTTPException(status_code=404, detail="Import not found")
    return menu_import


def _apply_item_updates(item: MenuImportItem, updates: dict) -> None:
    incoming_status = updates.pop("status", None)

    for field, value in updates.items():
        setattr(item, field, value)

    if incoming_status is not None:
        item.status = incoming_status
    elif updates and item.status == ImportItemStatus.pending:
        item.status = ImportItemStatus.edited


@router.post("/upload", response_model=MenuImportResponse, status_code=status.HTTP_201_CREATED)
async def upload_menu(
    file: UploadFile = File(...),
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    from app.api.deps import get_current_user

    file_type = _detect_file_type(file.filename or "unknown")
    content = await file.read()

    # Upload to S3
    s3_key = f"{ctx.store.id}/imports/{uuid.uuid4()}/{file.filename}"
    file_url = await upload_file(content, s3_key, file.content_type or "application/octet-stream")

    # Create import record
    menu_import = MenuImport(
        store_id=ctx.store.id,
        uploaded_by=ctx.store.owner_id,  # We'll improve this with actual user
        file_url=file_url,
        file_size_bytes=len(content),
        file_type=file_type,
        status=ImportStatus.uploading,
    )
    db.add(menu_import)
    await db.flush()
    await db.flush()
    return await _get_menu_import_with_items(db, menu_import.id)


@router.post("/from-upload", response_model=MenuImportResponse, status_code=status.HTTP_201_CREATED)
async def create_menu_import_from_upload(
    payload: CreateMenuImportFromUploadRequest,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UploadAsset).where(
            UploadAsset.id == payload.upload_id,
            UploadAsset.store_id == ctx.store.id,
            UploadAsset.uploaded_by == user.id,
            UploadAsset.intent == UploadIntent.menu_import_file,
        )
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    if upload.status == UploadAssetStatus.finalized:
        existing_result = await db.execute(
            select(MenuImport)
            .where(MenuImport.store_id == ctx.store.id, MenuImport.file_url == upload.file_url)
            .options(selectinload(MenuImport.items))
            .order_by(MenuImport.created_at.desc())
        )
        existing = existing_result.scalars().first()
        if existing:
            return existing

    if upload.status != UploadAssetStatus.uploaded:
        raise HTTPException(status_code=400, detail="Upload must be completed before import creation")

    file_type = _detect_file_type(upload.file_name)
    menu_import = MenuImport(
        store_id=ctx.store.id,
        uploaded_by=user.id,
        file_url=upload.file_url,
        file_size_bytes=upload.size_bytes,
        file_type=file_type,
        status=ImportStatus.uploading,
    )
    db.add(menu_import)

    upload.status = UploadAssetStatus.finalized
    await db.flush()
    return await _get_menu_import_with_items(db, menu_import.id)


@router.post("/{import_id}/process", response_model=MenuImportResponse)
async def process_menu_import(
    import_id: uuid.UUID,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MenuImport)
        .where(MenuImport.id == import_id, MenuImport.store_id == ctx.store.id)
        .options(selectinload(MenuImport.items))
    )
    menu_import = result.scalar_one_or_none()
    if not menu_import:
        raise HTTPException(status_code=404, detail="Import not found")

    if menu_import.status not in (ImportStatus.uploading, ImportStatus.failed):
        raise HTTPException(status_code=400, detail="Import already processed or in progress")

    menu_import.status = ImportStatus.processing
    menu_import.processing_started_at = datetime.now(timezone.utc)
    menu_import.ingested_at = None
    menu_import.error_log = None
    await db.flush()

    enqueued = await _enqueue_menu_import(menu_import.id)
    if enqueued:
        return await _get_menu_import_with_items(db, menu_import.id)
    menu_import.status = ImportStatus.failed
    menu_import.error_log = "Queue unavailable: failed to enqueue menu import processing task"
    await db.flush()
    raise HTTPException(status_code=503, detail="Processing queue unavailable. Please retry.")


@router.get("/{import_id}", response_model=MenuImportResponse)
async def get_menu_import(
    import_id: uuid.UUID,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MenuImport)
        .where(MenuImport.id == import_id, MenuImport.store_id == ctx.store.id)
        .options(selectinload(MenuImport.items))
    )
    menu_import = result.scalar_one_or_none()
    if not menu_import:
        raise HTTPException(status_code=404, detail="Import not found")
    return menu_import


@router.get("", response_model=list[MenuImportResponse])
async def list_menu_imports(
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MenuImport)
        .where(MenuImport.store_id == ctx.store.id)
        .options(selectinload(MenuImport.items))
        .order_by(MenuImport.created_at.desc())
    )
    return result.scalars().unique().all()


@router.patch("/{import_id}/items/{item_id}", response_model=MenuImportResponse)
async def update_import_item(
    import_id: uuid.UUID,
    item_id: uuid.UUID,
    data: MenuImportItemUpdate,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MenuImportItem)
        .join(MenuImport, MenuImport.id == MenuImportItem.menu_import_id)
        .where(
            MenuImportItem.id == item_id,
            MenuImportItem.menu_import_id == import_id,
            MenuImport.store_id == ctx.store.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Import item not found")

    updates = data.model_dump(exclude_unset=True)
    _apply_item_updates(item, updates)
    await db.flush()

    # Return parent import with all items
    result = await db.execute(
        select(MenuImport)
        .where(MenuImport.id == import_id, MenuImport.store_id == ctx.store.id)
        .options(selectinload(MenuImport.items))
    )
    return result.scalar_one()


@router.patch("/{import_id}/items:batch", response_model=MenuImportResponse)
async def batch_update_import_items(
    import_id: uuid.UUID,
    payload: MenuImportItemsBatchUpdateRequest,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MenuImport)
        .where(MenuImport.id == import_id, MenuImport.store_id == ctx.store.id)
        .options(selectinload(MenuImport.items))
    )
    menu_import = result.scalar_one_or_none()
    if not menu_import:
        raise HTTPException(status_code=404, detail="Import not found")

    if menu_import.status != ImportStatus.review:
        raise HTTPException(status_code=400, detail="Import must be in review state")

    items_by_id = {item.id: item for item in menu_import.items}
    for item_update in payload.items:
        item = items_by_id.get(item_update.item_id)
        if not item:
            raise HTTPException(
                status_code=404,
                detail=f"Import item not found: {item_update.item_id}",
            )
        updates = item_update.model_dump(exclude_unset=True)
        updates.pop("item_id", None)
        _apply_item_updates(item, updates)

    await db.flush()
    return await _get_menu_import_with_items(db, import_id)


@router.post("/{import_id}/publish", response_model=MenuImportResponse)
async def publish_menu_import(
    import_id: uuid.UUID,
    ctx: StoreContext = Depends(require_role(MemberRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MenuImport)
        .where(MenuImport.id == import_id, MenuImport.store_id == ctx.store.id)
        .options(selectinload(MenuImport.items))
    )
    menu_import = result.scalar_one_or_none()
    if not menu_import:
        raise HTTPException(status_code=404, detail="Import not found")
    if menu_import.status != ImportStatus.review:
        raise HTTPException(status_code=400, detail="Import must be in review state to publish")

    approved_items = [
        item for item in menu_import.items
        if item.status == ImportItemStatus.approved
    ]
    if not approved_items:
        raise HTTPException(status_code=400, detail="No items to publish")

    # Group by category → create categories + products
    categories_cache: dict[str, Category] = {}

    for item in approved_items:
        cat_name = item.category_name or "Uncategorized"

        # Get or create category
        if cat_name not in categories_cache:
            existing_cat = await db.execute(
                select(Category).where(
                    Category.store_id == ctx.store.id,
                    Category.name == cat_name,
                )
            )
            cat = existing_cat.scalar_one_or_none()
            if not cat:
                cat = Category(store_id=ctx.store.id, name=cat_name)
                db.add(cat)
                await db.flush()
            categories_cache[cat_name] = cat

        category = categories_cache[cat_name]

        # Create product
        product = Product(
            store_id=ctx.store.id,
            category_id=category.id,
            name=item.item_name,
            description=item.description,
            unit_amount=item.unit_amount or 0,
            currency="USD",
            decimal_places=2,
            dietary_tags=item.dietary_tags or [],
            allergens=item.allergens or [],
        )
        db.add(product)
        await db.flush()

        # Create option lists from parsed option lists
        if item.option_lists:
            def _looks_like_option_list(value: object) -> bool:
                if not isinstance(value, dict):
                    return False
                return isinstance(value.get("options"), list) or isinstance(value.get("selectionNode"), str) or isinstance(value.get("selection_node"), str)

            def _extract_option_lists(raw: object) -> list[dict]:
                if isinstance(raw, list):
                    return [entry for entry in raw if isinstance(entry, dict)]

                if not isinstance(raw, dict):
                    return []

                for wrapper_key in ("optionLists", "option_lists"):
                    wrapped = raw.get(wrapper_key)
                    if isinstance(wrapped, list):
                        candidates = [entry for entry in wrapped if isinstance(entry, dict)]
                        # Recover malformed shape: [{ name: "option_lists", options: [<actual option lists>] }]
                        if (
                            len(candidates) == 1
                            and str(candidates[0].get("name") or "").strip().lower() in {"option_lists", "optionlists"}
                            and isinstance(candidates[0].get("options"), list)
                            and all(_looks_like_option_list(v) for v in candidates[0].get("options") or [])
                        ):
                            return [entry for entry in (candidates[0].get("options") or []) if isinstance(entry, dict)]
                        return candidates

                # Legacy map format: {"Size": [{...}, {...}]}
                payload: list[dict] = []
                for list_name, options in raw.items():
                    if list_name in {"optionLists", "option_lists"}:
                        continue
                    if not isinstance(options, list):
                        continue
                    payload.append({
                        "name": list_name,
                        "selectionNode": "multi_select",
                        "minNumOptions": 0,
                        "maxNumOptions": len(options),
                        "isOptional": True,
                        "sortOrder": 0,
                        "options": options,
                    })
                return payload

            option_lists_payload = _extract_option_lists(item.option_lists)

            def _safe_int(value: object, default: int) -> int:
                try:
                    candidate = default if value is None else value
                    if isinstance(candidate, bool):
                        return max(0, int(candidate))
                    if isinstance(candidate, (int, float, str)):
                        return max(0, int(candidate))
                    return default
                except (TypeError, ValueError):
                    return default

            for option_list in option_lists_payload:
                list_name = str(option_list.get("name") or option_list.get("group_name") or "Options").strip()
                selection_node = str(option_list.get("selectionNode") or option_list.get("selection_node") or "multi_select")
                options_raw = option_list.get("options")
                options: list[dict[str, object]] = (
                    [option for option in options_raw if isinstance(option, dict)]
                    if isinstance(options_raw, list)
                    else []
                )

                ol = OptionList(
                    product_id=product.id,
                    name=list_name,
                    selection_node=selection_node,
                    min_num_options=_safe_int(option_list.get("minNumOptions", option_list.get("min_num_options")), 0),
                    max_num_options=max(1, _safe_int(option_list.get("maxNumOptions", option_list.get("max_num_options")), len(options) or 1)),
                    min_aggregate_options_quantity=_safe_int(option_list.get("minAggregateOptionsQuantity", option_list.get("min_aggregate_options_quantity")), 0),
                    max_aggregate_options_quantity=_safe_int(option_list.get("maxAggregateOptionsQuantity", option_list.get("max_aggregate_options_quantity")), 0),
                    is_optional=bool(option_list.get("isOptional", option_list.get("is_optional", True))),
                    sort_order=_safe_int(option_list.get("sortOrder", option_list.get("sort_order")), 0),
                )
                db.add(ol)
                await db.flush()

                for option in options:
                    if not isinstance(option, dict):
                        continue
                    opt = Option(
                        option_list_id=ol.id,
                        name=str(option.get("name") or "Unknown").strip(),
                        unit_amount=_safe_int(option.get("unitAmount", option.get("unit_amount")), 0),
                        currency=str(option.get("currency") or "USD"),
                        decimal_places=_safe_int(option.get("decimalPlaces", option.get("decimal_places")), 2),
                        min_option_choice_quantity=_safe_int(option.get("minOptionChoiceQuantity", option.get("min_option_choice_quantity")), 0),
                        max_option_choice_quantity=max(1, _safe_int(option.get("maxOptionChoiceQuantity", option.get("max_option_choice_quantity")), 1)),
                        default_quantity=_safe_int(option.get("defaultQuantity", option.get("default_quantity")), 0),
                        is_default=bool(option.get("isDefault", option.get("is_default", False))),
                        sort_order=_safe_int(option.get("sortOrder", option.get("sort_order")), 0),
                    )
                    db.add(opt)

        # Link import item to created product
        item.linked_product_id = product.id
        item.status = ImportItemStatus.approved

    menu_import.status = ImportStatus.published
    menu_import.published_at = datetime.now(timezone.utc)

    # Audit log
    audit = AuditLog(
        store_id=ctx.store.id,
        user_id=ctx.store.owner_id,
        action="menu_import_published",
        entity_type="menu_import",
        entity_id=menu_import.id,
        new_data={"items_published": len(approved_items)},
    )
    db.add(audit)
    await db.flush()

    # Reload
    result = await db.execute(
        select(MenuImport)
        .where(MenuImport.id == import_id)
        .options(selectinload(MenuImport.items))
    )
    return result.scalar_one()
