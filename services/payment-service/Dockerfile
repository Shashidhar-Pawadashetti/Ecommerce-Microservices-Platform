# Payment Service — FastAPI + aiokafka (Kafka saga participant) + Redis (SETNX dedup)
# Single dependency manager: uv (uv.lock committed, `uv sync` workflow).
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

# Install uv (tooling) — the sole dependency manager for this service.
RUN pip install --no-cache-dir uv

# Non-root runtime user (mirrors auth-service Dockerfile conventions).
RUN groupadd -r app && useradd -r -g app app

WORKDIR /app

# Install dependencies first for layer caching (uv.lock is committed).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy application source.
COPY . .

USER app

# Make the uv-managed venv's binaries available on PATH.
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8083

# Payment-service is Kafka-only (no REST router). The lifespan starts the
# AIOKafka consumer + producer; uvicorn keeps the process alive.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8083"]
