import math
from dataclasses import dataclass

from fastapi import Query

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 500


@dataclass(frozen=True)
class OffsetPaginationParams:
    page: int = DEFAULT_PAGE
    page_size: int = DEFAULT_PAGE_SIZE


@dataclass(frozen=True)
class OffsetPaginationWindow:
    total: int
    page: int
    page_size: int
    page_count: int
    offset: int


def get_offset_pagination(
    page: int = Query(default=DEFAULT_PAGE, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
) -> OffsetPaginationParams:
    return OffsetPaginationParams(page=page, page_size=page_size)


def resolve_offset_pagination(
    total: int,
    pagination: OffsetPaginationParams,
) -> OffsetPaginationWindow:
    page_count = max(1, math.ceil(total / pagination.page_size)) if total else 1
    page = min(pagination.page, page_count)
    offset = (page - 1) * pagination.page_size

    return OffsetPaginationWindow(
        total=total,
        page=page,
        page_size=pagination.page_size,
        page_count=page_count,
        offset=offset,
    )