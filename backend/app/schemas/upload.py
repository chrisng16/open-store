import uuid

from pydantic import BaseModel, Field

from app.models.upload import UploadAssetStatus, UploadIntent


class UploadIntentCreate(BaseModel):
    intent: UploadIntent
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=128)
    size_bytes: int | None = Field(default=None, ge=1)


class UploadIntentResponse(BaseModel):
    upload_id: uuid.UUID
    upload_url: str
    object_key: str
    file_url: str
    expires_in: int
    status: UploadAssetStatus


class UploadCompleteResponse(BaseModel):
    upload_id: uuid.UUID
    status: UploadAssetStatus
    size_bytes: int | None = None
    file_url: str


class CreateMenuImportFromUploadRequest(BaseModel):
    upload_id: uuid.UUID
