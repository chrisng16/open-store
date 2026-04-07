.PHONY: dev dev-api dev-web dev-worker dev-worker-ai dev-worker-maintenance dev-worker-email dev-all \
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
	@echo "Starting backend, frontend, and workers..."
	@make -j7 dev-api dev-web dev-worker-ai-1 dev-worker-ai-2 dev-worker-ai-3 dev-worker-maintenance dev-worker-email

dev-api:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd frontend && pnpm dev

# Convenience alias — spins up all workers (3x AI + 1x maintenance)
dev-worker:
	@$(MAKE) -j5 dev-worker-ai-1 dev-worker-ai-2 dev-worker-ai-3 dev-worker-maintenance dev-worker-email

dev-worker-ai-1:
	cd backend && ./.venv/bin/python -m arq app.workers.menu_ingestion.AIWorkerSettings

dev-worker-ai-2:
	cd backend && ./.venv/bin/python -m arq app.workers.menu_ingestion.AIWorkerSettings

dev-worker-ai-3:
	cd backend && ./.venv/bin/python -m arq app.workers.menu_ingestion.AIWorkerSettings

dev-worker-maintenance:
	cd backend && ./.venv/bin/python -m arq app.workers.menu_ingestion.MaintenanceWorkerSettings

dev-worker-email:
	cd backend && ./.venv/bin/python -m arq app.workers.menu_ingestion.EmailWorkerSettings

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
	@if pgrep -f "arq app.workers.menu_ingestion.(AIWorkerSettings|MaintenanceWorkerSettings|EmailWorkerSettings)" >/dev/null 2>&1; then \
		echo "Killing ARQ worker(s)..."; \
		pkill -f "arq app.workers.menu_ingestion.AIWorkerSettings"; \
		pkill -f "arq app.workers.menu_ingestion.MaintenanceWorkerSettings"; \
		pkill -f "arq app.workers.menu_ingestion.EmailWorkerSettings"; \
	else \
		echo "No ARQ worker processes found"; \
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
	@echo "Restarting workers..."
	@$(MAKE) -j5 dev-worker-ai-1 dev-worker-ai-2 dev-worker-ai-3 dev-worker-maintenance dev-worker-email

restart-all: kill-all
	@echo "Restarting everything..."
	@$(MAKE) -j7 dev-api dev-web dev-worker-ai-1 dev-worker-ai-2 dev-worker-ai-3 dev-worker-maintenance dev-worker-email

status:
	@echo "==> Backend (:8000):" && (lsof -i tcp:8000 -nP 2>/dev/null | cat || true)
	@echo "==> Frontend (:3000):" && (lsof -i tcp:3000 -nP 2>/dev/null | cat || true)
	@echo "==> AI workers:" && (pgrep -af "arq app.workers.menu_ingestion.AIWorkerSettings" || echo "  none running")
	@echo "==> Maintenance worker:" && (pgrep -af "arq app.workers.menu_ingestion.MaintenanceWorkerSettings" || echo "  none running")
	@echo "==> Email worker:" && (pgrep -af "arq app.workers.menu_ingestion.EmailWorkerSettings" || echo "  none running")

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