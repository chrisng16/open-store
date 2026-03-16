from pydantic import BaseModel, Field


class PaginationMetadata(BaseModel):
    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1)
    page_count: int = Field(..., ge=1)