.DEFAULT_GOAL := help
.PHONY: help dev down install lint format typecheck test check

help: ## Show available commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

dev: ## Start Postgres, API and web app with hot reload (http://localhost:5173)
	docker compose up --build

down: ## Stop the dev stack
	docker compose down

install: ## Install backend and frontend dependencies locally
	cd backend && uv sync
	cd frontend && npm ci

lint: ## Lint backend (Ruff) and frontend (ESLint, Prettier)
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm run lint && npm run format:check

format: ## Auto-format backend and frontend
	cd backend && uv run ruff check --fix . && uv run ruff format .
	cd frontend && npm run format

typecheck: ## Type-check backend (mypy) and frontend (tsc)
	cd backend && uv run mypy
	cd frontend && npm run typecheck

test: ## Run backend (pytest) and frontend (Vitest) tests
	cd backend && uv run pytest
	cd frontend && npm test

check: lint typecheck test ## Everything CI runs
