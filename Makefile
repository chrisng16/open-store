.PHONY: dev dev-api dev-web dev-worker dev-all \
	kill-backend kill-frontend kill-worker kill-all \
	restart-backend restart-frontend restart-worker restart-all \
	status build lint db-migrate db-revision install docker-up docker-down

# ---------------------------------------------------------------------------
# Development (run each in a separate terminal, or use `make dev`)
# ---------------------------------------------------------------------------

# Start both backend + frontend (requires a terminal multiplexer / two bg jobs)
dev:
	@echo "Starting backend and frontend..."
	@make -j2 dev-api dev-web

dev-all:
	@echo "Starting backend, frontend, and worker..."
	@make -j3 dev-api dev-web dev-worker

dev-api:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd frontend && pnpm dev

dev-worker:
	cd backend && ../.venv/bin/python -m arq app.workers.menu_ingestion.WorkerSettings

# ---------------------------------------------------------------------------
# Process control helpers
# ---------------------------------------------------------------------------

kill-backend:
	@PIDS="$$(lsof -ti tcp:8000 2>/dev/null)"; \
	if [ -n "$$PIDS" ]; then \
		echo "Killing backend on :8000 ($$PIDS)"; \
		kill $$PIDS; \
	else \
		echo "No backend process found on :8000"; \
	fi

kill-frontend:
	@PIDS="$$(lsof -ti tcp:3000 2>/dev/null)"; \
	if [ -n "$$PIDS" ]; then \
		echo "Killing frontend on :3000 ($$PIDS)"; \
		kill $$PIDS; \
	else \
		echo "No frontend process found on :3000"; \
	fi

kill-worker:
	@if pgrep -f "arq app.workers.menu_ingestion.WorkerSettings" >/dev/null; then \
		echo "Killing ARQ worker(s)..."; \
		pkill -f "arq app.workers.menu_ingestion.WorkerSettings"; \
	else \
		echo "No ARQ worker process found"; \
	fi

kill-all: kill-backend kill-frontend kill-worker
	@echo "All dev processes stopped (if running)."

restart-backend: kill-backend
	@echo "Restarting backend..."
	@$(MAKE) dev-api

restart-frontend: kill-frontend
	@echo "Restarting frontend..."
	@$(MAKE) dev-web

restart-worker: kill-worker
	@echo "Restarting worker..."
	@$(MAKE) dev-worker

restart-all: kill-all
	@echo "Restarting backend, frontend, and worker..."
	@$(MAKE) -j3 dev-api dev-web dev-worker

status:
	@echo "Backend (:8000):" && (lsof -i tcp:8000 -nP 2>/dev/null | cat || true)
	@echo "Frontend (:3000):" && (lsof -i tcp:3000 -nP 2>/dev/null | cat || true)
	@echo "Worker (arq):" && (pgrep -af "arq app.workers.menu_ingestion.WorkerSettings" || true)

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
