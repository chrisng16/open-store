# Project Guidelines

## Code Style

- Backend: Python 3.12+, FastAPI, SQLAlchemy, Pydantic.
- Frontend: Next.js App Router, TypeScript, TanStack Query, Zustand.
- Naming: `snake_case` in Python and API payloads; `camelCase` in frontend app code; React components use `PascalCase`.
- Keep request/response contracts in `backend/app/schemas/` and avoid ad-hoc response shapes in route handlers.

## Architecture

- Backend API routes live in `backend/app/api/v1/` and should keep business logic in `backend/app/services/` where practical.
- Data models belong in `backend/app/models/` and schema changes require Alembic migrations in `backend/alembic/versions/`.
- Frontend pages live in `frontend/app/`; shared UI in `frontend/components/`; shared client utilities in `frontend/lib/`; data hooks in `frontend/queries/`.
- Background processing uses ARQ workers in `backend/app/workers/menu_ingestion.py`.

## Build and Test

- Install deps: `make install`
- Run API + web: `make dev`
- Run API + web + workers: `make dev-all`
- Frontend lint: `make lint`
- Frontend build: `make build`
- Apply DB migrations: `make db-migrate`
- Create DB migration: `make db-revision msg="your_message"`
- Regenerate frontend API types after backend OpenAPI changes: `cd frontend && pnpm generate:api`

## Conventions

- Authn/Authz:
  - Backend uses Supabase JWT auth and store-role checks via dependencies in `backend/app/api/deps.py`.
  - Prefer explicit role guards for staff/admin/owner routes.
- API shape:
  - Backend returns snake_case fields.
  - Frontend normalizes to camelCase via `frontend/lib/normalize-response.ts`.
- Payments/orders:
  - Keep payment state transitions webhook-safe and idempotent.
  - For order-date filtering, interpret day filters in store timezone (not browser timezone assumptions).

## Common Pitfalls

- Migrations:
  - If `alembic` is not found, run commands from the backend virtual environment.
  - Always migrate before validating API behavior that touches models.
- Workers:
  - ARQ worker setting names must match exactly (`AIWorkerSettings`, `MaintenanceWorkerSettings`).
- Env setup:
  - Ensure `backend/.env` and `frontend/.env.local` are configured from `.env.example` before running app flows.

## Key Paths

- Backend entrypoint: `backend/app/main.py`
- Frontend entrypoint: `frontend/app/layout.tsx`
- Orders API: `backend/app/api/v1/orders.py`
- Payments API: `backend/app/api/v1/payments.py`
- Storefront checkout: `frontend/app/store/[slug]/checkout/`
- Dashboard orders: `frontend/app/dashboard/[storeId]/orders/`

## Further Reading

- Project overview and local setup: `README.md`
- Additional engineering notes: `GEMINI.md`
- Deep structure map: `.github/project-structure/open-store-structure.md`
- Risk backlog and future improvements: `.github/future-plan.md`
