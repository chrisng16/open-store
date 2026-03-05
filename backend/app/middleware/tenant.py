"""Optional middleware for tenant extraction from request headers."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Extract tenant/store info from request headers or path.
    This is optional — most tenant resolution happens in API deps.
    """

    async def dispatch(self, request: Request, call_next):
        # Extract store_id from x-tenant-id header if present
        tenant_id = request.headers.get("x-tenant-id")
        if tenant_id:
            request.state.tenant_id = tenant_id

        response = await call_next(request)
        return response
