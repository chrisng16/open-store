# Open Store

Open Store is a multi-tenant food ordering platform with an admin dashboard and a public storefront.

It combines:

- FastAPI backend for APIs, authz, business logic, uploads, and payments.
- Next.js frontend for store administration and customer ordering.
- PostgreSQL for application data.
- Redis + ARQ for background jobs.
- AWS S3 for upload storage.
- Supabase for authentication.
- Stripe Connect for payment processing.
- Gemini-powered AI menu ingestion for converting menu files into structured products.

## Architecture

### Backend (`backend/`)

Key responsibilities:

- Store/team management with role-based access control.
- Product/category/option management.
- Order creation and tracking.
- Upload intent and S3 signed URL flow.
- AI menu import pipeline (upload -> process -> review -> publish).
- Stripe Connect onboarding and payment intents.

Primary modules:

- `backend/app/main.py`: FastAPI bootstrapping and router mounting.
- `backend/app/api/v1/`: versioned API endpoints.
- `backend/app/models/`: SQLAlchemy ORM models.
- `backend/app/schemas/`: Pydantic request/response contracts.
- `backend/app/services/`: integrations and domain services (AI, Stripe, S3, team, Supabase admin).
- `backend/app/workers/menu_ingestion.py`: ARQ background worker tasks.
- `backend/alembic/versions/`: migration history.

### Frontend (`frontend/`)

Key responsibilities:

- Auth flows (login, signup, OAuth callback).
- Dashboard routes for store operations (products, categories, orders, team, AI import).
- Public storefront routes for browsing and ordering.
- Query/state abstractions for API data and local UI/cart state.

Primary modules:

- `frontend/app/`: Next.js App Router pages and layouts.
- `frontend/components/`: reusable UI and feature components.
- `frontend/lib/`: API helpers, auth fetch, cart/store contexts, uploads, Supabase clients.
- `frontend/queries/`: TanStack Query hooks.
- `frontend/stores/`: Zustand stores.

## Main User Flows

### 1. Store Setup and Team

- User signs in via Supabase.
- User creates a store.
- Owner/admin invites teammates and assigns roles/permissions.

### 2. Inventory Management

- Dashboard users create categories and products manually.
- Products can include option lists and options.

### 3. AI Menu Import

- User uploads a menu file (PDF/image/CSV/XLSX).
- Backend queues ingestion job.
- Worker extracts structured menu items.
- User reviews/edits extracted items in dashboard.
- User publishes approved items into live catalog.

### 4. Customer Ordering

- Customer visits public store page (`/store/[slug]`).
- Customer browses products and adds options to cart.
- Checkout creates order records and can initiate payment.

## Local Development

## Prerequisites

- Docker + Docker Compose
- Node.js and pnpm (for local frontend development without Docker)
- Python 3.12+ (for local backend development without Docker)

## Option A: Full stack with Docker Compose

From repo root:

```bash
docker compose up --build
```

Expected services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Option B: Local processes with Makefile helpers

From repo root:

```bash
make dev
```

Starts backend and frontend in development mode.

To include worker:

```bash
make dev-all
```

## Database Migrations

From `backend/`:

```bash
alembic upgrade head
```

Create a migration:

```bash
alembic revision --autogenerate -m "your_message"
```

## Environment Configuration

Use `.env.example` as a reference and configure:

- `backend/.env` for backend secrets and service credentials.
- `frontend/.env.local` for frontend runtime/build variables.

Important integration variables include:

- Supabase keys/URLs
- Postgres URL
- Redis URL
- AWS S3 bucket and credentials
- Stripe keys
- Gemini API key

## API Surface (high level)

Mounted under `/api/v1`:

- `health`
- `stores`
- `products`
- `orders`
- `menu_imports`
- `uploads`
- `payments`
- `team`

## Additional Documentation

- Detailed structure reference: `.github/project-structure/open-store-structure.md`
- Frontend-specific notes: `frontend/README.md`

## Current Notes

- There are a few backup/duplicate files in the frontend tree (`*.bak`, `menu-browser copy.tsx`) that may be candidates for cleanup after confirming they are no longer needed.
