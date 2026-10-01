.PHONY: help dev-backend dev-frontend install-backend install-frontend test docker-up docker-down lint format

# Default target
help:
	@echo ""
	@echo "PRism — AI Pull Request Risk Analyzer"
	@echo ""
	@echo "Usage:"
	@echo "  make install         Install all dependencies"
	@echo "  make dev             Start backend + frontend in dev mode"
	@echo "  make dev-backend     Start FastAPI backend only"
	@echo "  make dev-frontend    Start Next.js frontend only"
	@echo "  make test            Run all backend tests"
	@echo "  make docker-up       Start full stack with Docker Compose"
	@echo "  make docker-down     Stop Docker Compose stack"
	@echo "  make lint            Lint Python code with Ruff"
	@echo "  make format          Format Python code with Ruff"
	@echo ""

install: install-backend install-frontend

install-backend:
	cd apps/backend && if [ -d ".venv" ]; then .venv/bin/pip install -r requirements.txt; else pip install -r requirements.txt; fi

install-frontend:
	cd apps/frontend && npm install

dev-backend:
	cd apps/backend && if [ -f ".venv/bin/uvicorn" ]; then PYTHONPATH=$$PWD:../../packages/code-analysis .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; else PYTHONPATH=$$PWD:../../packages/code-analysis uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; fi

dev-frontend:
	cd apps/frontend && npm run dev

dev:
	@echo "Starting PRism in development mode..."
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	$(MAKE) dev-backend &
	$(MAKE) dev-frontend

test:
	cd apps/backend && if [ -f ".venv/bin/pytest" ]; then PYTHONPATH=$$PWD:../../packages/code-analysis .venv/bin/pytest tests/ -v; else PYTHONPATH=$$PWD:../../packages/code-analysis pytest tests/ -v; fi

test-coverage:
	cd apps/backend && if [ -f ".venv/bin/pytest" ]; then PYTHONPATH=$$PWD:../../packages/code-analysis .venv/bin/pytest tests/ -v --cov=app --cov-report=html; else PYTHONPATH=$$PWD:../../packages/code-analysis pytest tests/ -v --cov=app --cov-report=html; fi

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f backend

lint:
	cd apps/backend && if [ -f ".venv/bin/ruff" ]; then .venv/bin/ruff check app/ tests/; else ruff check app/ tests/; fi

format:
	cd apps/backend && if [ -f ".venv/bin/ruff" ]; then .venv/bin/ruff format app/ tests/; else ruff format app/ tests/; fi

type-check:
	cd apps/backend && if [ -f ".venv/bin/mypy" ]; then .venv/bin/mypy app/; else mypy app/; fi

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find . -type f -name "*.pyc" -delete 2>/dev/null; true
