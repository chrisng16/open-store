"""ARQ worker for background menu ingestion tasks.

Two worker classes — deploy them as separate processes:

    # AI-heavy import jobs (scale horizontally as needed)
    arq app.worker.AIWorkerSettings

    # Fast maintenance / cron jobs (single process is fine)
    arq app.worker.MaintenanceWorkerSettings
"""

import logging
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

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Queue names — single source of truth
# ---------------------------------------------------------------------------

QUEUE_AI = "menu_imports"
QUEUE_MAINTENANCE = "maintenance"


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

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


_redis_settings = _build_redis_settings()


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

async def process_menu_import_task(ctx: dict, import_id: str) -> dict:
    """Background task: process a menu import through the AI pipeline."""
    logger.info("process_menu_import_task started import_id=%s", import_id)

    async with async_session_factory() as db:
        result = await db.execute(
            select(MenuImport)
            .where(MenuImport.id == import_id)
            .options(selectinload(MenuImport.items))
        )
        menu_import = result.scalar_one_or_none()
        if not menu_import:
            logger.warning("process_menu_import_task: import not found id=%s", import_id)
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

            logger.info(
                "process_menu_import_task completed import_id=%s items=%d",
                import_id, len(extraction_result.items),
            )
            return {"status": "success", "items_count": len(extraction_result.items)}

        except Exception as e:
            logger.exception("process_menu_import_task failed import_id=%s", import_id)
            menu_import.status = ImportStatus.failed
            menu_import.error_log = str(e)
            await db.commit()
            return {"status": "failed", "error": str(e)}


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
        failed_deletes = 0
        for upload in uploads:
            try:
                await delete_file(upload.object_key)
            except Exception:
                logger.warning(
                    "cleanup_stale_uploads_task: failed to delete object_key=%s",
                    upload.object_key,
                )
                failed_deletes += 1
            upload.status = UploadAssetStatus.expired
            expired += 1

        await db.commit()
        logger.info(
            "cleanup_stale_uploads_task done expired=%d failed_storage_deletes=%d",
            expired, failed_deletes,
        )
        return {"status": "ok", "expired_count": expired, "failed_deletes": failed_deletes}


# ---------------------------------------------------------------------------
# Lifecycle hooks
# ---------------------------------------------------------------------------

async def startup(ctx: dict) -> None:
    """Worker startup hook."""
    logger.info("ARQ worker starting queue=%s", ctx.get("queue_name", "unknown"))


async def shutdown(ctx: dict) -> None:
    """Worker shutdown hook."""
    logger.info("ARQ worker shutting down queue=%s", ctx.get("queue_name", "unknown"))


# ---------------------------------------------------------------------------
# Worker settings
# ---------------------------------------------------------------------------

class AIWorkerSettings:
    """
    Worker for AI-heavy menu import jobs.

    Scale this horizontally — run 2-4 replicas to reduce queue wait time:

        arq app.worker.AIWorkerSettings   # replica 1
        arq app.worker.AIWorkerSettings   # replica 2
        ...

    Each replica can handle up to `max_jobs` concurrent Gemini calls.
    Because parse_menu_file is async/IO-bound, high concurrency is safe here.
    """

    functions = [process_menu_import_task]
    on_startup = startup
    on_shutdown = shutdown

    queue_name = QUEUE_AI

    # Each Gemini call is async/IO-bound — 10 concurrent is reasonable per replica.
    # Increase if you observe low CPU/memory pressure and still see queue delays.
    max_jobs = 10

    # Menu parsing is complex but should still complete within 5 minutes.
    job_timeout = 5*60  # seconds

    # 5s poll is invisible for imports that take 60–135s anyway.
    # Cuts Redis reads by ~80% vs the default 0.5s.
    poll_delay = 5.0

    # 60s is the sweet spot — low noise, still catches a crashed worker
    # within a minute. Go higher only if you have external process monitoring
    # (k8s liveness probes, supervisor, etc.) watching the worker for you.
    health_check_interval = 60

    redis_settings = _redis_settings


class MaintenanceWorkerSettings:
    """
    Worker for fast, short-running maintenance/cron jobs.

    Run a SINGLE instance of this — it owns the cron schedule.
    If you run multiple replicas, ARQ will de-duplicate cron jobs,
    but it's unnecessary overhead for lightweight tasks.

        arq app.worker.MaintenanceWorkerSettings
    """

    functions = [cleanup_stale_uploads_task]
    cron_jobs = [cron(cleanup_stale_uploads_task, minute={0})]
    on_startup = startup
    on_shutdown = shutdown

    queue_name = QUEUE_MAINTENANCE

    # Cleanup is fast and low-concurrency — 5 is generous.
    max_jobs = 5

    # Cleanup jobs should never take more than a minute.
    job_timeout = 60  # seconds

    # Cron fires once an hour — polling every 10s is more than responsive enough.
    poll_delay = 60.0

    # Single process, low stakes — 300s is fine. If it crashes your cron
    # simply misses one run, which is acceptable for hourly cleanup.
    health_check_interval = 300

    redis_settings = _redis_settings


# ---------------------------------------------------------------------------
# Legacy alias — keeps existing deployments working during migration.
# Remove once all workers are redeployed with the new class names.
# ---------------------------------------------------------------------------
WorkerSettings = AIWorkerSettings