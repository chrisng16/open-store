import asyncio
import uuid

import httpx

from app.config import get_settings


async def _fetch_user_profile(
    client: httpx.AsyncClient,
    base_url: str,
    service_role_key: str,
    user_id: uuid.UUID,
) -> dict[str, str | None]:
    response = await client.get(
        f"{base_url}/auth/v1/admin/users/{user_id}",
        headers={
            "Authorization": f"Bearer {service_role_key}",
            "apikey": service_role_key,
        },
    )

    if response.status_code >= 400:
        return {"name": None, "email": None}

    payload = response.json()
    user = payload.get("user") if isinstance(payload, dict) and "user" in payload else payload
    if not isinstance(user, dict):
        return {"name": None, "email": None}

    metadata = user.get("user_metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    name = metadata.get("full_name") or metadata.get("name")
    if not name:
        first = metadata.get("first_name")
        last = metadata.get("last_name")
        if first or last:
            name = " ".join([part for part in [first, last] if part]).strip()

    email = user.get("email")

    return {
        "name": name if isinstance(name, str) and name else None,
        "email": email if isinstance(email, str) and email else None,
    }


async def get_supabase_user_profiles(user_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[str, str | None]]:
    if not user_ids:
        return {}

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return {}

    base_url = settings.supabase_url.rstrip("/")

    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [
            _fetch_user_profile(client, base_url, settings.supabase_service_role_key, user_id)
            for user_id in user_ids
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    profiles: dict[uuid.UUID, dict[str, str | None]] = {}
    for user_id, result in zip(user_ids, results, strict=False):
        if isinstance(result, Exception):
            profiles[user_id] = {"name": None, "email": None}
            continue
        if isinstance(result, dict):
            profiles[user_id] = result
            continue
        profiles[user_id] = {"name": None, "email": None}

    return profiles
