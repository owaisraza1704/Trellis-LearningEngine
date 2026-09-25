FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /usr/local/bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core fonts-dejavu-extra && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .
ENV PATH="/app/.venv/bin:$PATH"
ENV DATA_DIR=/data
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn trellis.main:app --host 0.0.0.0 --port 8000"]
