import uuid
from datetime import datetime
from typing import Literal
from pydantic import AliasChoices, BaseModel, Field, model_validator


class BusinessHourRange(BaseModel):
    start_min: int = Field(..., ge=0, le=1439)
    end_min: int = Field(..., ge=1, le=1440)

    @model_validator(mode="after")
    def validate_range(self) -> "BusinessHourRange":
        if self.end_min <= self.start_min:
            raise ValueError("end_min must be greater than start_min")
        return self


class BusinessDayHours(BaseModel):
    status: Literal["open24", "closed", "ranges"]
    ranges: list[BusinessHourRange] | None = None

    @model_validator(mode="after")
    def validate_status_ranges(self) -> "BusinessDayHours":
        if self.status == "ranges":
            if not self.ranges:
                raise ValueError("ranges must be provided when status is 'ranges'")
        elif self.ranges:
            raise ValueError("ranges must only be provided when status is 'ranges'")
        return self


class BusinessHours(BaseModel):
    sun: BusinessDayHours
    mon: BusinessDayHours
    tue: BusinessDayHours
    wed: BusinessDayHours
    thu: BusinessDayHours
    fri: BusinessDayHours
    sat: BusinessDayHours


class StoreCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = None
    address: str | None = None
    phone: str | None = None
    timezone: str = "UTC"
    business_hours: BusinessHours | None = Field(
        default=None,
        validation_alias=AliasChoices("business_hours", "businessHours"),
    )


class StoreUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    logo_url: str | None = None
    banner_url: str | None = None
    theme_config: dict | None = None
    address: str | None = None
    phone: str | None = None
    timezone: str | None = None
    is_active: bool | None = None
    business_hours: BusinessHours | None = Field(
        default=None,
        validation_alias=AliasChoices("business_hours", "businessHours"),
    )


class StoreResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    slug: str
    description: str | None
    logo_url: str | None
    banner_url: str | None
    theme_config: dict | None
    stripe_account_id: str | None
    stripe_onboarding_complete: bool
    is_active: bool
    address: str | None
    phone: str | None
    timezone: str
    business_hours: BusinessHours | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StorePublicResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    logo_url: str | None
    banner_url: str | None
    theme_config: dict | None
    is_active: bool
    address: str | None
    phone: str | None
    business_hours: BusinessHours | None
    timezone: str | None
    model_config = {"from_attributes": True}


class StoreMemberResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
