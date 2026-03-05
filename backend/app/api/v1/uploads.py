import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import StoreContext, get_current_user, require_role
from app.database import get_db
from app.models.store import MemberRole
from app.models.upload import UploadAsset, UploadAssetStatus, UploadIntent
from app.schemas.upload import (
    UploadCompleteResponse,
    UploadIntentCreate,
    UploadIntentResponse,
)
from app.services.storage import get_upload_url, head_file

router = APIRouter(prefix="/stores/{store_id}/uploads", tags=["uploads"])

UPLOAD_URL_EXPIRES_IN = 900

INTENT_POLICY: dict[UploadIntent, dict[str, object]] = {
    UploadIntent.menu_import_file: {
        "content_types": {
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
            "text/csv",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        "max_size_bytes": 25 * 1024 * 1024,
    },
    UploadIntent.product_image: {
        "content_types": {"image/png", "image/jpeg", "image/webp"},
        "max_size_bytes": 10 * 1024 * 1024,
    },
}


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", name.strip())
    return cleaned or "upload.bin"


def _validate_upload_policy(intent: UploadIntent, content_type: str, size_bytes: int | None) -> None:
    policy = INTENT_POLICY[intent]
    allowed = policy["content_types"]
    max_size_bytes = policy["max_size_bytes"]

    if content_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content_type for {intent.value}: {content_type}",
        )
    if size_bytes is not None and size_bytes > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File is too large for {intent.value}",
        )


@router.post("/intents", response_model=UploadIntentResponse, status_code=status.HTTP_201_CREATED)
async def create_upload_intent(
    payload: UploadIntentCreate,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _validate_upload_policy(payload.intent, payload.content_type, payload.size_bytes)

    safe_name = _safe_filename(payload.filename)
    object_key = f"{ctx.store.id}/uploads/{payload.intent.value}/{uuid.uuid4()}/{safe_name}"
    upload_url = await get_upload_url(object_key, payload.content_type, expires_in=UPLOAD_URL_EXPIRES_IN)

    upload = UploadAsset(
        store_id=ctx.store.id,
        uploaded_by=user.id,
        intent=payload.intent,
        status=UploadAssetStatus.initiated,
        object_key=object_key,
        file_name=safe_name,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
    )
    db.add(upload)
    await db.flush()
    await db.refresh(upload)

    return UploadIntentResponse(
        upload_id=upload.id,
        upload_url=upload_url,
        object_key=upload.object_key,
        file_url=upload.file_url,
        expires_in=UPLOAD_URL_EXPIRES_IN,
        status=upload.status,
    )


@router.post("/{upload_id}/complete", response_model=UploadCompleteResponse)
async def complete_upload(
    upload_id: uuid.UUID,
    ctx: StoreContext = Depends(require_role(MemberRole.staff)),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UploadAsset).where(
            UploadAsset.id == upload_id,
            UploadAsset.store_id == ctx.store.id,
            UploadAsset.uploaded_by == user.id,
        )
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    if upload.status != UploadAssetStatus.initiated:
        return UploadCompleteResponse(
            upload_id=upload.id,
            status=upload.status,
            size_bytes=upload.size_bytes,
            file_url=upload.file_url,
        )

    try:
        metadata = await head_file(upload.object_key)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded object not found in storage")

    content_length = metadata.get("ContentLength")
    policy = INTENT_POLICY[upload.intent]
    max_size_bytes = policy["max_size_bytes"]
    if content_length and content_length > max_size_bytes:
        upload.status = UploadAssetStatus.failed
        await db.flush()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded object exceeds maximum size")

    upload.size_bytes = content_length
    upload.status = UploadAssetStatus.uploaded
    await db.flush()

    return UploadCompleteResponse(
        upload_id=upload.id,
        status=upload.status,
        size_bytes=upload.size_bytes,
        file_url=upload.file_url,
    )
