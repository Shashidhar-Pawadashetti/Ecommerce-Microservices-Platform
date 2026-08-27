# Catalog Service — FastAPI + PyMongo (AsyncMongoClient) + MongoDB 8.0
# Single dependency manager: uv (committed uv.lock, `uv sync` workflow).
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

EXPOSE 8000

# uvicorn is provided by fastapi[standard] (managed by uv).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
