.PHONY: dev dev-api dev-web build lint db-migrate db-revision install docker-up docker-down

# ---------------------------------------------------------------------------
# Development (run each in a separate terminal, or use `make dev`)
# ---------------------------------------------------------------------------

# Start both backend + frontend (requires a terminal multiplexer / two bg jobs)
dev:
	@echo "Starting backend and frontend..."
	@make -j2 dev-api dev-web

dev-api:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd frontend && pnpm dev

# ---------------------------------------------------------------------------
# Build / Lint
# ---------------------------------------------------------------------------

build:
	cd frontend && pnpm build

lint:
	cd frontend && pnpm lint

# ---------------------------------------------------------------------------
# Database (Alembic)
# ---------------------------------------------------------------------------

db-migrate:
	cd backend && alembic upgrade head

# Usage: make db-revision msg="add foo table"
db-revision:
	cd backend && alembic revision --autogenerate -m "$(msg)"

# ---------------------------------------------------------------------------
# Install dependencies
# ---------------------------------------------------------------------------

install:
	cd frontend && pnpm install
	cd backend && pip install -e ".[dev]"

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

docker-up:
	docker compose up -d

docker-down:
	docker compose down
