.PHONY: setup dev test build up down

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
