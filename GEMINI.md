# Open Store Project Overview

Open Store is a multi-tenant food ordering platform providing a complete solution for store owners to manage their products and orders, and for customers to browse and place orders.

## Core Technologies
- **Backend**: FastAPI (Python 3.12+), SQLAlchemy ORM, Pydantic, Alembic migrations.
- **Frontend**: Next.js (App Router), TanStack Query, Zustand, Tailwind CSS.
- **Infrastructure**: PostgreSQL, Redis + ARQ (background jobs), AWS S3 (uploads).
- **Integrations**: Supabase (Auth), Stripe Connect (Payments), Gemini AI (Menu ingestion).

## Architecture

### Backend (`backend/`)
- `app/main.py`: Entry point, FastAPI app initialization and router mounting.
- `app/api/v1/`: Versioned API endpoints (stores, products, orders, payments, etc.).
- `app/models/`: SQLAlchemy database models.
- `app/schemas/`: Pydantic schemas for data validation and serialization.
- `app/services/`: Business logic and external service integrations (Stripe, AI, S3).
- `app/workers/`: Background task definitions for ARQ.

### Frontend (`frontend/`)
- `app/`: Next.js pages and layouts (Dashboard and Public Storefront).
- `components/`: Reusable React components.
- `lib/`: Utility functions, API clients, and shared logic.
- `queries/`: TanStack Query hooks for data fetching.
- `stores/`: Zustand stores for local state management (e.g., cart).

## Building and Running

### Prerequisites
- Docker + Docker Compose
- Python 3.12+
- Node.js & pnpm

### Commands
- **Start All (Docker)**: `docker compose up --build`
- **Development Mode (Local)**: `make dev` (Starts API and Frontend)
- **Start All with Workers**: `make dev-all`
- **Database Migrations**:
  - Run migrations: `make db-migrate` (or `alembic upgrade head` in `backend/`)
  - Create migration: `make db-revision msg="description"`
- **Frontend Build**: `make build`
- **Linting**: `make lint`

## Development Conventions

### Coding Style
- **Python**: Follow PEP 8. Use type hints for all function signatures. Pydantic models should be used for all API request/response bodies.
- **TypeScript**: Prefer functional components and hooks. Use TanStack Query for server state and Zustand for client state.
- **Naming**: Use `snake_case` for Python and `camelCase` for TypeScript (except for React components which use `PascalCase`).

### Security & Guest Access
- **Order Access**: Orders can be viewed by guests using an `order_access_token` passed as a query parameter (`?access=...`).
- **Token Generation**: Handled by `build_order_access_token` in `backend/app/api/v1/orders.py`.
- **Cart Management**: The shopping cart is cleared **only** on the Order Confirmation page via the `CartClearer` component, and only if a `session_id` is present in the URL.

### Payments & Tax
- **Stripe Connect**: Uses **Standard** accounts with **Direct Charges**.
- **Checkout**: Integrated via **Stripe Embedded Checkout**.
- **Tax**: Automatic tax is enabled (`automatic_tax={"enabled": True}`).
- **Requirement**: Connected store accounts **must** have tax registrations configured in their Stripe Dashboard for tax calculation to be active.
- **Webhooks**: 
  - Primary event: `checkout.session.completed` (used to update order status and final totals).
  - Secondary event: `payment_intent.succeeded`.
  - Local testing: Use Stripe CLI: `stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe`.

### AI Menu Ingestion
- Ingestion is handled by background ARQ workers.
- The pipeline follows: `Upload` -> `Queue Ingestion` -> `Gemini AI Processing` -> `Review` -> `Publish`.
- Worker settings are in `backend/app/workers/menu_ingestion.py`.
