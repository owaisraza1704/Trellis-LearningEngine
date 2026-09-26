.PHONY: setup dev test build up down eval-validate eval-test eval

EVAL_ARGS ?= --split test

setup:
	cd backend && uv sync --frozen --python 3.12
	cd trellis-ui && pnpm install --frozen-lockfile
	docker compose up -d --wait db
	cd backend && .venv/bin/alembic upgrade head

dev:
	./scripts/dev.sh

test:
	cd backend && .venv/bin/pytest -q
	cd backend && .venv/bin/ruff check trellis tests
	cd trellis-ui && pnpm typecheck

build:
	cd trellis-ui && pnpm build

up:
	docker compose --profile app up --build -d --wait

down:
	docker compose --profile app down

eval-validate:
	cd backend && uv run --frozen --group evaluation python -m trellis_eval validate

eval-test:
	cd backend && uv run --frozen --group evaluation pytest -q tests/test_benchmark_dataset.py tests/test_benchmark_metrics.py tests/test_benchmark_report.py tests/test_benchmark_runner.py tests/test_usage_collection.py

eval:
	cd backend && uv run --frozen --group evaluation python -m trellis_eval run $(EVAL_ARGS)
