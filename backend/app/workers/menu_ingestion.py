"""ARQ worker for background menu ingestion tasks."""

from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import async_session_factory
from app.models.menu_import import MenuImport, MenuImportItem, ImportStatus, ImportItemStatus
from app.models.upload import UploadAsset, UploadAssetStatus
from app.services.ai.menu_parser import parse_menu_file
from app.services.storage import delete_file


async def process_menu_import_task(ctx: dict, import_id: str) -> dict:
    """Background task: process a menu import through the AI pipeline."""
    async with async_session_factory() as db:
        result = await db.execute(
            select(MenuImport)
            .where(MenuImport.id == import_id)
            .options(selectinload(MenuImport.items))
        )
        menu_import = result.scalar_one_or_none()
        if not menu_import:
            return {"error": "Import not found"}

        menu_import.status = ImportStatus.processing
        menu_import.processing_started_at = datetime.now(timezone.utc)
        menu_import.ingested_at = None
        await db.commit()

        try:
            extraction_result = await parse_menu_file(
                file_url=menu_import.file_url,
                file_type=menu_import.file_type,
            )

            menu_import.raw_extraction = extraction_result.raw_data
            menu_import.parsed_data = extraction_result.parsed_data

            for item in extraction_result.items:
                import_item = MenuImportItem(
                    menu_import_id=menu_import.id,
                    category_name=item.category_name,
                    item_name=item.item_name,
                    description=item.description,
                    unit_amount=item.unit_amount,
                    option_lists=item.option_lists,
                    dietary_tags=item.dietary_tags,
                    allergens=item.allergens,
                    confidence=item.confidence,
                    status=ImportItemStatus.pending,
                )
                db.add(import_item)

            menu_import.status = ImportStatus.review
            menu_import.ingested_at = datetime.now(timezone.utc)
            await db.commit()

            return {"status": "success", "items_count": len(extraction_result.items)}

        except Exception as e:
            menu_import.status = ImportStatus.failed
            menu_import.error_log = str(e)
            await db.commit()
            return {"status": "failed", "error": str(e)}


async def startup(ctx: dict) -> None:
    """Worker startup hook."""
    pass


async def shutdown(ctx: dict) -> None:
    """Worker shutdown hook."""
    pass


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


async def cleanup_stale_uploads_task(ctx: dict) -> dict:
    """Expire stale upload intents and remove orphaned files from storage."""
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.upload_cleanup_max_age_hours)

    async with async_session_factory() as db:
        result = await db.execute(
            select(UploadAsset)
            .where(
                UploadAsset.status.in_([
                    UploadAssetStatus.initiated,
                    UploadAssetStatus.uploaded,
                ]),
                UploadAsset.created_at < cutoff,
            )
            .order_by(UploadAsset.created_at.asc())
            .limit(settings.upload_cleanup_batch_size)
        )
        uploads = list(result.scalars().all())

        expired = 0
        for upload in uploads:
            try:
                await delete_file(upload.object_key)
            except Exception:
                pass
            upload.status = UploadAssetStatus.expired
            expired += 1

        await db.commit()
        return {"status": "ok", "expired_count": expired}


class WorkerSettings:
    """ARQ worker settings."""

    functions = [process_menu_import_task, cleanup_stale_uploads_task]
    cron_jobs = [cron(cleanup_stale_uploads_task, minute={0})]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 5
    job_timeout = 300  # 5 minutes max for AI processing
    redis_settings = _build_redis_settings()
