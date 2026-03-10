from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.v1.health import router as health_router
from app.api.v1.stores import router as stores_router
from app.api.v1.products import router as products_router
from app.api.v1.orders import router as orders_router
from app.api.v1.menu_imports import router as menu_imports_router
from app.api.v1.uploads import router as uploads_router
from app.api.v1.payments import router as payments_router
from app.api.v1.team import store_router as team_store_router, accept_router as team_accept_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = get_settings()
    print(f"Starting Open Store API ({settings.environment})")
    yield
    # Shutdown
    print("Shutting down Open Store API")


app = FastAPI(
    title="Open Store API",
    description="Multi-tenant food ordering platform with AI menu ingestion",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api/v1
api_prefix = "/api/v1"
app.include_router(health_router, prefix=api_prefix)
app.include_router(stores_router, prefix=api_prefix)
app.include_router(products_router, prefix=api_prefix)
app.include_router(orders_router, prefix=api_prefix)
app.include_router(menu_imports_router, prefix=api_prefix)
app.include_router(uploads_router, prefix=api_prefix)
app.include_router(payments_router, prefix=api_prefix)
app.include_router(team_store_router, prefix=api_prefix)
app.include_router(team_accept_router, prefix=api_prefix)


@app.get("/")
async def root():
    return {"name": "Open Store API", "version": "0.1.0", "docs": "/docs"}
