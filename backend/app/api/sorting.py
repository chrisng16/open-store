from collections.abc import Mapping
from typing import Any

from sqlalchemy import asc, desc


def resolve_sort_expression(
    sort: str | None,
    *,
    allowed_columns: Mapping[str, Any],
    default_field: str,
    default_direction: str = "asc",
):
    field = default_field
    direction = default_direction.lower()

    if sort:
        raw_field, _, raw_direction = sort.partition(":")
        candidate_field = raw_field.strip()
        candidate_direction = (raw_direction or default_direction).strip().lower()

        if candidate_field in allowed_columns and candidate_direction in {"asc", "desc"}:
            field = candidate_field
            direction = candidate_direction

    column = allowed_columns[field]
    expression = desc(column) if direction == "desc" else asc(column)
    is_desc = direction == "desc"

    return expression, field, is_desc