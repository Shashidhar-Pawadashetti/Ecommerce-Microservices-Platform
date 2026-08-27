# Catalog Service

FastAPI product-catalog service for the Ecommerce Microservices Platform. Reads
products from MongoDB 8.0 and serves the public browse / detail / batch-pricing
read paths exactly per `docs/api-contracts/catalog-service.openapi.yaml`.

**Stack:** Python 3.13 + FastAPI 0.141.1 + Pydantic 2.13.4 + pymongo
`AsyncMongoClient` (>=4.9, never Motor) + MongoDB 8.0, containerized via
`python:3.13-slim`.

## Endpoints

| Method | Path                        | Auth        | Purpose                                  |
|--------|-----------------------------|-------------|------------------------------------------|
| GET    | `/catalog/products`         | public      | Paginated product list (filter/search/sort) |
| POST   | `/catalog/products/batch`   | network-int | Current name+priceCents for known IDs (omits unknown) |
| GET    | `/catalog/products/{id}`    | public      | Single product by id (404 NOT_FOUND if unknown) |
| POST   | `/catalog/products`         | admin (JWT) | Create a product (201 Product) — Plan 04 / CAT-06 |
| PUT    | `/catalog/products/{id}`    | admin (JWT) | Replace a product (200 Product) — Plan 04 / CAT-06 |
| DELETE | `/catalog/products/{id}`    | admin (JWT) | Delete a product (204) — Plan 04 / CAT-06 |
| GET    | `/health`                   | network-int | Liveness probe (`{"status":"ok"}`)       |

Admin (mutating) routes are gated by the `require_auth` dependency defined in
`app/security.py` and declared `bearerAuth` in their OpenAPI operation so Swagger
shows the lock. The public read paths above keep `security: []`.

## Environment

Variable names are contractual (shared with root `.env`). See `.env.example`.

| Variable          | Default                   | Description                                  |
|-------------------|---------------------------|----------------------------------------------|
| `JWT_SECRET`      | (base64, ≥32 decoded B)   | HS256 signing secret (base64-encoded)         |
| `JWT_ISSUER`      | `ecommerce-auth`          | Expected JWT issuer claim                    |
| `JWT_AUDIENCE`    | `ecommerce-api`           | Expected JWT audience claim                  |
| `JWT_TTL_SECONDS` | `3600`                    | Token TTL hint                               |
| `MONGO_URI`       | `mongodb://mongo:27017`   | MongoDB connection URI                       |
| `MONGO_DB`        | `catalog`                 | Database name                                |
| `MONGO_COLLECTION`| `products`                | Collection name                              |

## Run with uv (recommended)

```bash
uv sync                      # create .venv and install deps from uv.lock
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Run with Docker Compose (whole platform)

From the repo root:

```bash
docker compose up -d mongo catalog-service
curl -s localhost:8000/health        # {"status":"ok"}
curl -s localhost:8000/catalog/products
```

## Test

```bash
uv sync                          # includes dev dependency-group
uv run pytest tests -q
```

Tests use `testcontainers` to spin a real `mongo:8.0` container (Docker required).

## Notes

- **Interop contract:** timestamps are ISO-8601 with 3-digit ms + `Z`; money is
  integer `priceCents`; ids are strings; optional fields are omitted (never null);
  receivers tolerate unknown fields (`extra="ignore"`).
- **v1 JWT holder deviation:** catalog is the third `JWT_SECRET` holder (with
  auth-service and the gateway). Self-verification is defense-in-depth; the
  deviation is recorded in `docs/runbook.md` (DOCS-02).
