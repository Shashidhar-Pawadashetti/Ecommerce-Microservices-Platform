# Phase 03: Catalog Service - Research

**Researched:** 2026-08-27
**Domain:** Python / FastAPI product catalog (MongoDB 8.0, JWT-protected admin CRUD, idempotent seed, static placeholder images)
**Confidence:** HIGH (stack versions verified against PyPI; contract is hand-authored and authoritative)

## Summary

The Catalog Service is the first Python/FastAPI service and the first MongoDB consumer in the platform. It is a **contracted** service: `docs/api-contracts/catalog-service.openapi.yaml` is the source of truth and already exists (authored in Phase 1). Planning must build *to that contract*, not from assumptions. The contract defines seven operations (`listProducts`, `createProduct`, `batchGetProducts`, `getProduct`, `updateProduct`, `deleteProduct`, `health`) across three surfaces: **public read** (`GET /catalog/**`), **JWT-protected admin write** (`POST/PUT/DELETE /catalog/products`), and **network-internal** (`POST /catalog/products/batch`, `GET /health`).

The dominant architectural decision is that **the catalog service must self-verify the HS256 JWT** on its mutating routes. The contract explicitly says those routes "respond 401 when the token is missing, expired, or invalid," and the gateway (Phase 7) does not yet exist in Phase 3 — so the catalog cannot rely on the gateway to enforce CAT-06. This makes catalog a *third* holder of `JWT_SECRET` in v1 (the json-interop doc restricts it to auth-service + api-gateway), a deviation that must be recorded. The service verifies locally with PyJWT using the shared secret, issuer `ecommerce-auth`, audience `ecommerce-api`, and a pinned `HS256` algorithm.

Data lives in MongoDB 8.0 (image `mongo:8.0`, added to Compose in this phase). Products use a **stable string `_id`** (e.g. `prod-1001`) so the seed script can upsert idempotently. Free-text search uses a MongoDB **text index** (not regex) for safety and correctness; images are **committed static SVG assets** served by the service under `/catalog/static/...` so they ride the existing gateway `/catalog/**` proxy with no extra routing. The PyMongo **AsyncMongoClient** (>=4.9) is mandatory — Motor is deprecated (confirmed on PyPI at 3.7.1 but EOL per STACK.md).

**Primary recommendation:** Build a single FastAPI app with (1) a `require_auth` dependency returning the shared `UNAUTHORIZED` envelope on any missing/invalid token, (2) Pydantic v2 models with a `createdAt` millisecond serializer and `response_model_exclude_none=True` to honor JSON-interop Rules 1 & 4, (3) an idempotent upsert seed keyed on stable string IDs, (4) a `/catalog/static` mount for committed placeholder SVGs, and (5) a startup routine that ensures the `category` and text indexes. Verify with `pytest` against a `testcontainers`-spun `mongo:8.0`, mirroring the auth-service Testcontainers pattern.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Visitor can browse listing without login | `GET /catalog/products` declared `security: []` (public); list route has no `require_auth` dependency |
| CAT-02 | Visitor can view single product by ID | `GET /catalog/products/{id}` public; 404 envelope (`NOT_FOUND`) for unknown id |
| CAT-03 | Filter by category | `category` query param → exact-match `{"category": cat}` filter; `total` reflects filtered set |
| CAT-04 | Text search + sort by price/name | `q` param → Mongo `$text` index search; `sort`∈{price,name}, `order`∈{asc,desc} |
| CAT-05 | Seed ~20 products + bundled images, idempotent | Upsert on stable string `_id`; `imageUrl` → `/catalog/static/products/{id}.svg`; re-run is a no-op |
| CAT-06 | Create/update/delete via authenticated API (Swagger, no UI); refused without auth | `POST/PUT/DELETE` carry `security: [bearerAuth]`; `require_auth` dependency + `bearerAuth` scheme in openapi |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Public browse/list/get (CAT-01/02/03/04) | API/Backend (FastAPI) | Database (MongoDB) | Read endpoints query Mongo and return JSON; no auth needed per contract |
| Admin CRUD (CAT-06) | API/Backend (FastAPI) | — | JWT verified *in-process* via PyJWT + shared secret; no separate auth call (defense-in-depth + pre-gateway testability) |
| Product truth / pricing source | Database (MongoDB) | API/Backend | `POST /catalog/products/batch` is the system-of-record read consumed by cart-service (CART-01/02) |
| Placeholder image delivery | API/Backend (FastAPI StaticFiles) | CDN/Static (logical) | Committed SVGs served at `/catalog/static/...`; routed through gateway `/catalog/**` proxy |
| Seed population (CAT-05) | API/Backend (script) | Database (MongoDB) | One-shot idempotent writer; not a runtime request path |
| JWT verification | API/Backend (FastAPI) | — | Local HS256 verify with `JWT_SECRET`; required because gateway is built later (Phase 7) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | **0.141.1** | Web framework / REST surface | [VERIFIED: PyPI `pip index versions fastapi` → 0.141.1] current latest; matches STACK.md pin; native `/docs` Swagger = the contracted "admin UI" |
| Pydantic (v2) | **2.13.4** | Request/response models, validation | [VERIFIED: PyPI → 2.13.4] current; enforces interop Rules (integer money, ms timestamps, null-omission via `exclude_none`) |
| pydantic-settings | **2.15.0** | Typed env var binding (`.env`) | [VERIFIED: PyPI → 2.15.0] current; matches env-var convention used by auth-service |
| PyMongo (AsyncMongoClient) | **>=4.9** (current **4.17.0**) | MongoDB 8.0 access | [VERIFIED: PyPI → 4.17.0] native asyncio `AsyncMongoClient` since 4.9; Motor is deprecated (see Don't Hand-Roll) |
| PyJWT | **2.13.0** | HS256 JWT verification | [VERIFIED: PyPI → 2.13.0] standard, minimal lib; `jwt.decode(..., algorithms=["HS256"], audience=, issuer=)` enforces alg-pin + claims |
| uvicorn[standard] | bundled via fastapi[standard] (current 0.52.4) | ASGI server | [VERIFIED: PyPI → uvicorn 0.52.4] do not pin separately; let `fastapi[standard]` manage |
| Python | **3.13** (base `python:3.13-slim`) | Runtime | [VERIFIED: STACK.md] pinned; matches project's other Python service (payment) for consistency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest + pytest-asyncio | **9.1.1** / **1.4.0** | Python test harness | [VERIFIED: PyPI] all API + serialization tests |
| testcontainers[python] | **4.15.0** | Spin `mongo:8.0` for integration tests | [VERIFIED: PyPI → 4.15.0] mirrors auth-service Testcontainers pattern; avoids mocking async Mongo |
| httpx | **0.28.1** | Async HTTP client + TestClient transport | [VERIFIED: PyPI] FastAPI `TestClient` uses it; `batchGetProducts` caller pattern reference |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyMongo AsyncMongoClient | Motor | Motor deprecated 2025-05-14, EOL 2026-05-14 (STACK.md); do NOT use |
| PyJWT | python-jose | python-jose is heavier and adds JOSE deps; PyJWT suffices for HS256 verify-only |
| MongoDB `$text` index | Regex `$regex` search | Regex risk: operator/ReDoS injection if not escaped; `$text` is safer and scales; recommended |
| pip + requirements.txt | uv (preferred per STACK.md) | Either is fine; pick ONE and use for both Python services. uv gives lockfile reproducibility |

**Installation (per service `pyproject.toml` or `requirements.txt`):**
```text
fastapi[standard]==0.141.1
pydantic==2.13.4
pydantic-settings==2.15.0
pymongo>=4.9
PyJWT==2.13.0
# dev / test only:
pytest==9.1.1
pytest-asyncio==1.4.0
testcontainers[python]==4.15.0
httpx==0.28.1
```

**Version verification:** All core versions confirmed via `pip index versions <pkg>` against PyPI on 2026-08-27 (see Package Legitimacy Audit). Do **not** verify these on npm — `npm view fastapi version` returns a bogus `0.0.8` (an unrelated squatting package), the documented cross-ecosystem confusion vector.

## Package Legitimacy Audit

> Gate run manually (gsd-tools seam unavailable in this environment) against PyPI via `pip index versions`. All packages below are long-established, high-adoption libraries — none flagged SLOP/SUS.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| fastapi | PyPI | ~7 yrs | very high | github.com/fastapi/fastapi | OK | Approved |
| pydantic | PyPI | ~8 yrs | very high | github.com/pydantic/pydantic | OK | Approved |
| pydantic-settings | PyPI | ~3 yrs | high | github.com/pydantic/pydantic-settings | OK | Approved |
| pymongo | PyPI | ~15 yrs | very high | github.com/mongodb/mongo-python-driver | OK | Approved (use AsyncMongoClient) |
| PyJWT | PyPI | ~10 yrs | very high | github.com/jpadilla/pyjwt | OK | Approved |
| uvicorn | PyPI | ~8 yrs | very high | github.com/encode/uvicorn | OK | Approved (via fastapi[standard]) |
| pytest | PyPI | ~18 yrs | very high | github.com/pytest-dev/pytest | OK | Approved |
| pytest-asyncio | PyPI | ~7 yrs | high | github.com/pytest-dev/pytest-asyncio | OK | Approved |
| testcontainers | PyPI | ~7 yrs | high | github.com/testcontainers/testcontainers-python | OK | Approved |
| httpx | PyPI | ~7 yrs | very high | github.com/encode/httpx | OK | Approved |
| motor | PyPI | (3.7.1) | — | github.com/mongodb/motor | OK* | **REMOVED — deprecated** (do not install) |

**Packages removed due to [SLOP]/deprecation:** `motor` — not SLOP but deprecated by MongoDB; superseded by `pymongo>=4.9` AsyncMongoClient. Listed to prevent scope creep.
**Packages flagged as suspicious [SUS]:** none.
**Cross-ecosystem warning:** `npm view fastapi` → `0.0.8` is a *different, unrelated* npm package, NOT the Python framework. Planner must install from PyPI only.

## Architecture Patterns

### System Architecture Diagram

```
                ┌─────────────────────────────────────────────┐
                │  Browser / Next.js storefront (Phase 8)      │
                └───────────────────┬─────────────────────────┘
                                    │ GET /catalog/**  (public)
                                    ▼
                ┌─────────────────────────────────────────────┐
                │  api-gateway :8080  (Phase 7; JWT verify)    │
                │  proxies /catalog/**  →  catalog-service     │
                └───────────────────┬─────────────────────────┘
                                    │ (in v1 catalog ALSO self-verifies)
                                    ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  catalog-service :8000  (FastAPI)                                  │
   │                                                                    │
   │  GET  /catalog/products        → list/filter/search/sort (public)  │
   │  GET  /catalog/products/{id}   → single product      (public)      │
   │  POST /catalog/products        → create  [require_auth]            │
   │  PUT  /catalog/products/{id}   → update  [require_auth]            │
   │  DEL  /catalog/products/{id}   → delete  [require_auth]            │
   │  POST /catalog/products/batch  → pricing read (network-internal)   │
   │  GET  /catalog/static/*        → committed placeholder SVGs        │
   │  GET  /health                  → liveness probe                   │
   │                                                                    │
   │  require_auth ──PyJWT.verify──▶ JWT_SECRET (HS256, iss/aud/exp)     │
   └───────────────────────────┬────────────────────────────────────────┘
                                │ AsyncMongoClient
                                ▼
                    ┌──────────────────────────┐
                    │  MongoDB 8.0 (mongo:27017)│
                    │  db=catalog, coll=products│
                    │  indexes: category, text │
                    └──────────────────────────┘
                                ▲
                                │ idempotent upsert (stable _id)
                    ┌──────────────────────────┐
                    │  seed script (one-shot)   │
                    └──────────────────────────┘
```

### Recommended Project Structure
```text
services/catalog-service/
├── Dockerfile                 # python:3.13-slim, non-root, uvicorn
├── pyproject.toml             # OR requirements.txt (+ uv.lock if using uv)
├── .env.example              # mirrors root .env vars used by catalog
├── README.md                 # endpoints + env + run/test instructions
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI app, lifespan (indexes), exception handlers, static mount
│   ├── config.py             # pydantic-settings Settings
│   ├── security.py           # require_auth dependency (PyJWT)
│   ├── models.py             # Pydantic Product / ProductWrite / ProductList / Batch*
│   ├── db.py                 # AsyncMongoClient + collection + ensure_indexes
│   └── routes.py             # all endpoints (operation_id set to match contract)
├── scripts/
│   ├── seed.py               # idempotent seed (~20 products + imageUrl refs)
│   └── gen_placeholders.py   # (optional) regenerate committed SVGs
├── static/
│   └── products/             # committed placeholder SVGs (prod-1001.svg … prod-1020.svg)
└── tests/
    ├── conftest.py           # testcontainers mongo fixture + token-minting fixture
    ├── test_list.py          # CAT-01/03/04
    ├── test_get.py           # CAT-02
    ├── test_admin.py         # CAT-06 (auth + CRUD)
    ├── test_seed.py          # CAT-05 (idempotency)
    └── test_models.py        # interop Rule serialization
```

### Pattern 1: JWT self-verification dependency (CAT-06)
**What:** A FastAPI dependency decodes the bearer token with PyJWT, pinned to HS256, validating `aud`/`iss`/`exp`; on any failure it raises 401 with the shared `UNAUTHORIZED` envelope.
**When to use:** Every `POST/PUT/DELETE /catalog/products` route.
**Why:** Contract declares `bearerAuth` on these ops and says they return 401 on missing/expired/invalid tokens; gateway (Phase 7) does not exist yet in Phase 3, so the service must enforce it itself. Also defense-in-depth once the gateway exists.
**Example:**
```python
# Source: PyJWT 2.13 docs (jpadilla/pyjwt) + catalog openapi contract
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False)

def require_auth(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED",
                    "message": "Authentication required or credentials invalid."},
        )
    try:
        return jwt.decode(
            creds.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],            # pin alg; reject "none"/RS confusion
            audience=settings.jwt_audience,   # ecommerce-api
            issuer=settings.jwt_issuer,       # ecommerce-auth
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED",
                    "message": "Authentication required or credentials invalid."},
        )
```

### Pattern 2: Contract-faithful error envelope (Rules 4 & shared envelope)
**What:** Override FastAPI's default exception handlers so 400/401/404 emit `{"code","message"}` (matching `_shared.yaml`), not FastAPI's `{"detail": ...}` wrapper.
**When to use:** App-wide, in `main.py`.
**Why:** The contract's `Unauthorized`/`NotFound`/`ValidationError` responses are the shared `Error` envelope. FastAPI's default 401/400 shapes would fail any envelope assertion.
**Example:**
```python
from fastapi import Request
from fastapi.exceptions import HTTPException as FastAPIHTTPException, RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(FastAPIHTTPException)
async def http_exc_handler(request: Request, exc: FastAPIHTTPException):
    body = exc.detail if isinstance(exc.detail, dict) and "code" in exc.detail else {
        "code": "VALIDATION_FAILED" if exc.status_code < 500 else "INTERNAL_ERROR",
        "message": str(exc.detail),
    }
    return JSONResponse(status_code=exc.status_code, content=body)

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={
        "code": "VALIDATION_FAILED",
        "message": "Request validation failed. Check field formats and limits.",
    })
```

### Pattern 3: Pydantic models with ms-precision `createdAt` + null omission (Rules 1 & 4)
**What:** `createdAt: datetime` with a `field_serializer` emitting exactly 3-digit ms + `Z`; all responses use `response_model_exclude_none=True` so optional `description`/`imageUrl` are omitted, never `null`.
**When to use:** All response models.
**Why:** Interop Rule 1 (ISO 8601 ms UTC, no microseconds) and Rule 4 (optional = absent, not null). Pydantic happily parses 6-digit microsecond input and would re-emit it — the serializer forces 3-digit ms.
**Example:**
```python
from pydantic import BaseModel, ConfigDict, Field, field_serializer
from datetime import datetime, timezone

def _iso_ms(v: datetime) -> str:
    v = v.astimezone(timezone.utc)
    return v.strftime("%Y-%m-%dT%H:%M:%S.") + f"{v.microsecond // 1000:03d}Z"

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")   # Rule 5: tolerate unknown
    id: str
    name: str
    description: str | None = None              # omitted on output (exclude_none)
    category: str
    priceCents: int = Field(ge=0)               # Rule 2: integer money
    stock: int = Field(ge=0)
    imageUrl: str | None = None
    createdAt: datetime                          # Rule 1: date-time

    @field_serializer("createdAt")
    def _ser(self, v: datetime) -> str:
        return _iso_ms(v)
```

### Pattern 4: Idempotent seed via stable string `_id` (CAT-05)
**What:** Seed inserts products with a fixed string id (`prod-1001`…`prod-1020`); uses `update_one({_id:id}, {$set: mutable, $setOnInsert: {createdAt}}, upsert=True)` so re-running changes nothing (createdAt preserved, other fields refreshed if edited).
**When to use:** The seed script (one-shot, runnable repeatedly).
**Why:** "re-running it changes nothing" requires deterministic ids and `$setOnInsert` for the creation timestamp. String `_id` also satisfies interop Rule 3 (string IDs on wire) and makes upsert trivial.
**Example:**
```python
async def seed(products_coll, rows):
    for p in rows:                       # each row: id, name, category, priceCents, stock, imageUrl?, createdAt(iso)
        await products_coll.update_one(
            {"_id": p["id"]},
            {"$set": {k: v for k, v in p.items() if k not in ("id", "createdAt")},
             "$setOnInsert": {"createdAt": p["createdAt"], "id": p["id"]}},
            upsert=True,
        )
```

### Pattern 5: Text-index search + exact category filter (CAT-03/04)
**What:** A Mongo text index on `{name, description}`; query combines exact `category` match with `{"$text": {"$search": q}}`; sort by `priceCents` or `name` asc/desc; `total = count_documents(filter)`, page via `skip/limit`.
**When to use:** `listProducts`.
**Why:** `$text` is the safe, standard free-text search (no regex injection). Exact-match category avoids NoSQL operator injection.
**Caveat:** Exactly one text index per collection; create it idempotently at startup (see db.ensure_indexes). If `q` is absent, omit the `$text` clause.

### Pattern 6: Serving committed placeholder images under `/catalog/static` (CAT-05)
**What:** Commit ~20 SVG files to `static/products/prod-XXXX.svg`; seed sets `imageUrl = "/catalog/static/products/{id}.svg"`; mount `StaticFiles` at `/catalog/static`.
**Why:** "bundled placeholder images served by the service, avoid external network deps." Placing them under `/catalog/static` means they automatically flow through the gateway's existing `/catalog/**` proxy (GTWY-01) — no new gateway route needed in Phase 7. The browser resolves the (root-relative) path against the gateway origin.
**Note (decision, see Assumptions A1):** The exact `imageUrl` format is deliberately undeclared by the contract until Phase 3; root-relative `/catalog/static/...` is recommended so Phase 8 + Phase 7 need no extra wiring.

### Anti-Patterns to Avoid
- **Returning FastAPI's default `{"detail": ...}` envelope** — breaks the shared `Error` contract; always use the custom handlers (Pattern 2).
- **Letting Pydantic emit 6-digit microsecond timestamps** — violates Rule 1; always use the `field_serializer` (Pattern 3).
- **Emitting `"field": null` for optional fields** — violates Rule 4; use `response_model_exclude_none=True`.
- **Minting product IDs with Mongo `ObjectId` but forgetting string mapping** — `_id` should be the string product id; map `_id → id` on read.
- **Using Motor** — deprecated; use `pymongo.AsyncMongoClient`.
- **Regex search on raw `q` without escaping** — NoSQL/ReDoS injection risk; prefer `$text` index.
- **Relying on the gateway for CAT-06 in Phase 3** — gateway doesn't exist yet; the catalog must self-verify (Pattern 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signature verification | Manual HMAC/Base64 split | `PyJWT` (`jwt.decode`) | Correct alg-pinning, claims, exp handling; hand-rolling invites alg-confusion bugs |
| MongoDB driver | Raw socket / HTTP to Mongo | `pymongo.AsyncMongoClient` | Wire protocol, pooling, BSON handled by the driver |
| Input validation | Manual `if` checks per field | `pydantic` v2 models | Declarative, generates OpenAPI, enforces interop Rules |
| Free-text search | Custom regex/scoring | Mongo `$text` index | Standard, injection-safe, ranked; don't reinvent search |
| Pagination/count | Manual slicing | `count_documents` + `skip/limit` | Correct `total` semantics for the contract's `ProductList` |
| ASGI server | `python -m http.server` | `uvicorn` | Standard ASGI runner for FastAPI |

**Key insight:** Every "don't hand-roll" item here is also a contract/interop requirement — hand-rolling would drift from the frozen API contract and the JSON-interop law.

## Common Pitfalls

### Pitfall 1: OpenAPI operationId / scheme mismatch vs contract
**What goes wrong:** FastAPI auto-generates `operationId` from the function name (e.g. `list_products`) and names the security scheme differently than `bearerAuth`.
**Why it happens:** FastAPI defaults; the committed YAML uses `listProducts` and `bearerAuth`.
**How to avoid:** Set `operation_id="listProducts"` (etc.) on every route decorator; declare `bearerAuth` via `app = FastAPI(openapi_extra={"components": {"securitySchemes": {"bearerAuth": {...}}}})` and mark protected routes with `openapi_extra={"security": [{"bearerAuth": []}]}`.
**Warning signs:** `check-contracts.sh` Stage 5 fails (no `operationId:` found) — though current script only checks presence, not exact names; still match exactly for later drift diffs.

### Pitfall 2: Microsecond timestamps leak onto the wire
**What goes wrong:** `createdAt` serializes as `...123456Z` (6-digit) instead of 3-digit ms.
**Why it happens:** Pydantic v2 parses and re-emits datetimes at source precision.
**How to avoid:** `field_serializer` forcing 3-digit ms (Pattern 3). Assert on emitted examples in tests.
**Warning signs:** Contract interop Rule 1 assertion fails; gateway/other services parse but drift from canonical form.

### Pitfall 3: `null` in optional fields
**What goes wrong:** `description: null` or `imageUrl: null` appears in JSON.
**Why it happens:** Pydantic includes `None` by default unless told not to.
**How to avoid:** `response_model_exclude_none=True` on every GET/POST/PUT response.
**Warning signs:** Frontend/other services hit Rule 4 violations; contract "omitted, never null" broken.

### Pitfall 4: `$text` query fails because the text index wasn't created
**What goes wrong:** `listProducts` with `q` raises `OperationFailure: text index required`.
**Why it happens:** The text index is created only on first run; if startup index creation is skipped or errors, search breaks at runtime.
**How to avoid:** `ensure_indexes()` in the FastAPI lifespan startup; make it idempotent (catch `OperationFailure` on identical-spec re-create). Run a smoke test that exercises `?q=`.
**Warning signs:** List works without `q` but 500s with `q`.

### Pitfall 5: `batchGetProducts` registered after `{id}` route
**What goes wrong:** `GET /catalog/products/batch` is never matched, or path param swallows it.
**Why it happens:** Route ordering / method confusion (`batch` is POST, `{id}` GET — different methods, but be safe).
**How to avoid:** Register `POST /catalog/products/batch` before `GET /catalog/products/{id}`; double-check methods.

### Pitfall 6: NoSQL injection via filter fields
**What goes wrong:** A crafted `category` or `q` manipulates the Mongo query (e.g. operator objects).
**Why it happens:** Concatenating user input into filters.
**How to avoid:** Exact-match `{"category": cat}` (string equality, no operators); `$text` for search (not string-interpolated `$regex`). Never pass raw request JSON into `find()`.
**Warning signs:** Unexpected rows returned for odd inputs.

### Pitfall 7: Catalog can't be tested pre-gateway (CAT-06 unprovable)
**What goes wrong:** If catalog trusts the (not-yet-built) gateway, it cannot demonstrate "refused without authentication" in Phase 3.
**Why it happens:** Assuming gateway enforcement timeline.
**How to avoid:** Self-verify JWT in `require_auth` (Pattern 1) — works with or without the gateway.
**Warning signs:** No way to get a 401 from the catalog directly.

### Pitfall 8: Seed not idempotent → duplicate/unstable data
**What goes wrong:** Re-running seed doubles products or changes `createdAt`.
**Why it happens:** Using `insert_one` (duplicate key) or always overwriting `createdAt`.
**How to avoid:** Upsert on stable `_id` + `$setOnInsert` for `createdAt` (Pattern 4). Test: seed twice, assert count and `createdAt` unchanged.
**Warning signs:** `total` grows on re-seed; smoke test sees different products each run.

## Code Examples

### App skeleton (contract-faithful)
```python
# app/main.py  — Source: FastAPI 0.141 docs + catalog-service.openapi.yaml
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from . import db, routes
from .config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()        # AsyncMongoClient
    await db.ensure_indexes() # category + text (idempotent)
    yield
    await db.close()

app = FastAPI(
    title="Catalog Service API",
    version="1.0.0",
    lifespan=lifespan,
    openapi_extra={"components": {"securitySchemes": {
        "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    }}},
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "products")
app.mount("/catalog/static", StaticFiles(directory=STATIC_DIR), name="catalog-static")

# register exception handlers (Pattern 2) here, then:
app.include_router(routes.router)
```

### List route (CAT-01/03/04)
```python
# app/routes.py
from fastapi import APIRouter, Query
from .models import ProductList
from .db import products
from pymongo import ASCENDING, TEXT

router = APIRouter()

@router.get("/catalog/products", operation_id="listProducts",
            response_model=ProductList, response_model_exclude_none=True)
async def list_products(
    category: str | None = None,
    q: str | None = None,
    sort: str = Query("name", pattern="^(price|name)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    filt: dict = {}
    if category:
        filt["category"] = category
    if q:
        filt["$text"] = {"$search": q}
    sort_field = "priceCents" if sort == "price" else "name"
    direction = -1 if order == "desc" else 1
    total = await products.count_documents(filt)
    cursor = products.find(filt).sort(sort_field, direction).skip(offset).limit(limit)
    docs = await cursor.to_list(length=limit)
    items = [_to_product(d) for d in docs]
    return ProductList(items=items, total=total, limit=limit, offset=offset)
```

### Admin create (CAT-06)
```python
@router.post("/catalog/products", operation_id="createProduct",
             dependencies=[Depends(require_auth)],
             response_model=Product, response_model_exclude_none=True,
             openapi_extra={"security": [{"bearerAuth": []}]})
async def create_product(p: ProductWrite):
    new_id = f"prod-{__import__('bson').ObjectId()}"   # stable-ish unique id
    doc = p.model_dump(exclude_none=True)
    doc["_id"] = new_id
    doc["createdAt"] = _now_iso()                       # ms-precision ISO
    await products.insert_one(doc)
    return _to_product(doc)

# Missing/invalid token → require_auth raises 401 UNAUTHORIZED envelope.
# Invalid body (negative priceCents, empty name) → 400 VALIDATION_FAILED (handler).
```

### Idempotent seed (CAT-05)
```python
# scripts/seed.py  (run: `python -m scripts.seed`)
async def run_seed():
    await db.connect()
    rows = load_seed_rows()   # 20 entries: prod-1001..prod-1020, fixed createdAt ISO
    for p in rows:
        await products.update_one(
            {"_id": p["id"]},
            {"$set": {k: v for k, v in p.items() if k not in ("id", "createdAt")},
             "$setOnInsert": {"createdAt": p["createdAt"]}},
            upsert=True,
        )
    print(f"seeded {len(rows)} products (idempotent)")
```

### Testcontainers fixture (mirrors auth-service)
```python
# tests/conftest.py
import pytest, pytest_asyncio
from testcontainers.mongodb import MongoDbContainer
from .app import db, config

@pytest.fixture(scope="session")
def mongo_container():
    with MongoDbContainer("mongo:8.0") as c:
        yield c

@pytest_asyncio.fixture
async def client(mongo_container):
    config.settings.mongo_uri = mongo_container.get_connection_url()
    await db.connect(); await db.ensure_indexes()
    from app.main import app
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await db.close()

@pytest.fixture
def auth_token():
    import jwt
    return jwt.encode(
        {"sub": "admin", "email": "a@b.c", "roles": ["customer"],
         "iss": "ecommerce-auth", "aud": "ecommerce-api"},
        "test-secret-32-bytes-minimum-length!!",   # matches settings in tests
        algorithm="HS256",
    )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Motor (async Mongo) | `pymongo>=4.9` `AsyncMongoClient` | 2025-05-14 (Motor deprecated) | Catalog (and payment) must use native asyncio PyMongo |
| `null` for absent optional fields | Omit key (`exclude_none`) | project interop Rule 4 | All responses must drop `None` fields |
| Microsecond timestamps | 3-digit ms ISO `Z` | interop Rule 1 | Serializer enforces precision |
| Gateway-only JWT enforcement | Service self-verifies (v1) | Phase 3 pre-gateway | catalog holds `JWT_SECRET` (3rd holder) |

**Deprecated/outdated:** Motor (EOL 2026-05-14) — never install. MailHog — not used by catalog. `npm view fastapi` bogus package — ignore.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Image assets served under `/catalog/static/...` (rides gateway `/catalog/**` proxy) | Pattern 6 / Architecture | If Phase 7 gateway proxy excludes `/static`, images break in Phase 8; mitigation: gateway already proxies `/catalog/**` and static is under that prefix |
| A2 | Committed SVG placeholders (vs PNG / runtime-generated) are acceptable "bundled placeholder images" | Pattern 6 / CAT-05 | If raster PNGs are strongly preferred, swap file type; seed `imageUrl` stays the same path shape |
| A3 | Catalog self-verifying JWT (3rd `JWT_SECRET` holder) is acceptable v1 deviation from json-interop's "exactly two services" | Pattern 1 / Security | json-interop restricts holders; must be recorded in runbook/DOCS-02; revisit if a hardened posture is wanted |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (A1–A3 are design recommendations surfaced for planner confirmation, not factual uncertainties.)

## Open Questions

1. **JWT holder scope**
   - What we know: Contract requires catalog to return 401 on invalid tokens; gateway is Phase 7.
   - What's unclear: Whether to keep self-verify after Phase 7 or trust the gateway (reverting to 2 holders).
   - Recommendation: Keep self-verify (defense-in-depth + unchanged testability); document the 3-holder reality in DOCS-02.

2. **`imageUrl` absoluteness for the frontend**
   - What we know: Root-relative `/catalog/static/...` flows through the gateway.
   - What's unclear: How Phase 8 storefront resolves the URL (prefix gateway origin vs. proxy route).
   - Recommendation: Store root-relative; Phase 8 prefixes the gateway base URL when rendering `<img>`.

3. **Transitional host port**
   - What we know: auth-service publishes `8081:8081` in Phases 2–6, revoked in Phase 7 (D-09).
   - What's unclear: Whether catalog should publish `8000:8000` in Phase 3 for direct Swagger/admin use.
   - Recommendation: Yes — mirror auth-service; revoke in Phase 7 as part of GTWY-04 isolation.

4. **Dependency manager (uv vs pip)**
   - What we know: STACK.md prefers `uv`; build plan mentions poetry/pip.
   - What's unclear: Which to standardize.
   - Recommendation: Pick `uv` (lockfile reproducibility) and use identically for payment-service; a `requirements.txt` export is fine if simpler.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.13 (docker image) | Runtime | Host has 3.14.2; image pins 3.13 | 3.13-slim | Use host 3.13 if image unavailable |
| Docker | Compose + testcontainers | ✓ (assumed — project is docker-compose based) | — | None — blocks containerized run/tests |
| MongoDB 8.0 | Datastore | Added in this phase (compose) | mongo:8.0 | testcontainers spins `mongo:8.0` for tests |
| pip / uv | Dep install | ✓ | pip 26.1.2 | — |
| Spectral CLI (npx) | check-contracts verify | network fetch | @stoplight/spectral-cli 6.16.3 | verify gate may need network |
| `JWT_SECRET` / `MONGO_URI` / `JWT_*` | service config | ✓ in `.env` | — | — |

**Missing dependencies with no fallback:** None identified (Docker assumed present per project nature).
**Missing dependencies with fallback:** None.

## Validation Architecture

> nyquist_validation enabled (config.json). Each success criterion and CAT requirement mapped to an executable check.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest **9.1.1** + pytest-asyncio **1.4.0** |
| Config file | `services/catalog-service/pytest.ini` or `pyproject [tool.pytest.ini_options]` (Wave 0 creates it) |
| Quick run command | `pytest tests/test_list.py tests/test_get.py -x -q` |
| Full suite command | `pytest -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | `GET /catalog/products` returns 200 with no token | integration | `pytest tests/test_list.py::test_public_list_no_auth -x` | ❌ Wave 0 |
| CAT-02 | `GET /catalog/products/{id}` 200; unknown → 404 envelope | integration | `pytest tests/test_get.py -x` | ❌ Wave 0 |
| CAT-03 | `?category=electronics` filters; `total` reflects filtered set | integration | `pytest tests/test_list.py::test_category_filter -x` | ❌ Wave 0 |
| CAT-04 | `?q=` search matches; `?sort=price&order=desc` orders | integration | `pytest tests/test_list.py::test_search_and_sort -x` | ❌ Wave 0 |
| CAT-05 | Seed populates ~20; re-run changes nothing (count + createdAt stable); image served | integration | `pytest tests/test_seed.py -x` | ❌ Wave 0 |
| CAT-06 | Create/update/delete require valid token (401 without; 401 invalid/expired; 201/200/204 with); 400 on bad body | integration | `pytest tests/test_admin.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/test_<module>.py::test_<name> -x`
- **Per wave merge:** `pytest -q`
- **Phase gate:** Full suite green **and** `bash scripts/check-contracts.sh` passes (Spectral lint + operationId coverage) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/conftest.py` — testcontainers `mongo:8.0` fixture + `auth_token` minting fixture
- [ ] `tests/test_list.py` — CAT-01/03/04
- [ ] `tests/test_get.py` — CAT-02 (incl. 404 envelope shape)
- [ ] `tests/test_admin.py` — CAT-06 (auth refusal + CRUD + 400 envelope)
- [ ] `tests/test_seed.py` — CAT-05 idempotency + static image 200
- [ ] `tests/test_models.py` — interop Rule serialization (ms timestamp, null omission, integer money)
- [ ] `pytest.ini` / pyproject pytest config with `asyncio_mode=auto`
- [ ] Framework install command: `pip install -e ".[test]"` or `uv sync` recorded in README

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

### Manual / curl assertions (smoke, complements pytest)
```bash
# CAT-01 public list (no token)
curl -s localhost:8000/catalog/products | jq '.total, (.items|length)'
# CAT-02 single (known + unknown)
curl -s localhost:8000/catalog/products/prod-1001 | jq '.name'
curl -s -o /dev/null -w '%{http_code}' localhost:8000/catalog/products/nope   # 404
# CAT-03/04 filter + search + sort
curl -s "localhost:8000/catalog/products?category=electronics" | jq '.total'
curl -s "localhost:8000/catalog/products?q=keyboard&sort=price&order=desc" | jq '.items[0].priceCents'
# CAT-05 idempotency: run seed twice, count stable
python -m scripts.seed && python -m scripts.seed
curl -s localhost:8000/catalog/products | jq '.total'   # == 20
curl -s -o /dev/null -w '%{http_code}' localhost:8000/catalog/static/products/prod-1001.svg   # 200
# CAT-06 auth refusal
curl -s -o /dev/null -w '%{http_code}' -X POST localhost:8000/catalog/products \
  -H 'content-type: application/json' -d '{"name":"x","category":"c","priceCents":1}'   # 401
# with valid token -> 201
TOKEN=$(python -c "import jwt;print(jwt.encode({'sub':'a','email':'a@b.c','roles':['customer'],'iss':'ecommerce-auth','aud':'ecommerce-api'},'SECRET','HS256'))")
curl -s -o /dev/null -w '%{http_code}' -X POST localhost:8000/catalog/products \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"x","category":"c","priceCents":1}'   # 201
```

## Security Domain

> security_enforcement enabled (ASVS Level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Catalog verifies a token; it does not authenticate users (no login endpoint) |
| V3 Session Management | no | Stateless JWT; no server sessions |
| V4 Access Control | **yes** | `require_auth` dependency on all `POST/PUT/DELETE /catalog/products`; 401 on missing/invalid token (V4.1.x verify access) |
| V5 Input Validation | **yes** | Pydantic v2: `name`/`category` `min_length=1`, `priceCents`/`stock` `ge=0`, `limit` 1–100, `offset` >=0; 400 `VALIDATION_FAILED` envelope |
| V6 Cryptography | **yes** | JWT HS256 verify via PyJWT (library, not hand-rolled); `JWT_SECRET` length ≥32 bytes asserted at startup |

### Known Threat Patterns for FastAPI + Mongo

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Broken access control (unauth write) | Elevation | `require_auth` on every mutating route; default-deny (no dependency = public, explicit dependency = protected) |
| JWT algorithm confusion / `alg=none` | Tampering/Spoofing | PyJWT `algorithms=["HS256"]` only; rejects any other `alg` before signature check |
| NoSQL injection via filter fields | Tampering | Exact-match `category` (`{"category": x}`) + `$text` search; never interpolate raw JSON into `find()` |
| Sensitive data exposure | Info Disclosure | `response_model_exclude_none=True`; generic error messages (no stack/driver internals); `JWT_SECRET` never logged |
| Mass assignment | Tampering | `ProductWrite` excludes `id`/`createdAt`; server generates them; `extra="ignore"` tolerates unknown input safely |

### Secret handling note (deviation to record)
json-interop.md restricts `JWT_SECRET` to auth-service + api-gateway ("exactly two services"). Because the catalog must self-verify in Phase 3 (pre-gateway) and the contract mandates 401 on invalid tokens, **catalog becomes a third holder in v1**. This is a deliberate, documented deviation — record it in `docs/runbook.md` (DOCS-02) and revisit if a hardened posture is desired. The secret still must: be ≥32 bytes (asserted at startup), never logged, live only in `.env` (gitignored).

## Sources

### Primary (HIGH confidence)
- `docs/api-contracts/catalog-service.openapi.yaml` — authoritative API contract (paths, schemas, status codes, security)
- `docs/api-contracts/_shared.yaml` — shared `Error` envelope, `bearerAuth` scheme, pagination params
- `docs/json-interop.md` — Rules 1–5 + JWT claims table (canonical)
- `AGENTS.md` / STACK.md — pinned stack (FastAPI 0.141.1, Pydantic 2.13.4, PyMongo >=4.9, Python 3.13, mongo:8.0, Mailpit)
- `ecommerce-microservices-build-plan.md` — Phase 3 scope (PyMongo + MongoDB, seed ~20, Pydantic models)
- `docs/versions.md` — verified pins (referenced by check-contracts.sh)

### Secondary (MEDIUM confidence)
- PyPI `pip index versions` output (2026-08-27): fastapi 0.141.1, pydantic 2.13.4, pymongo 4.17.0, pyjwt 2.13.0, pytest 9.1.1, pytest-asyncio 1.4.0, testcontainers 4.15.0, httpx 0.28.1, pydantic-settings 2.15.0
- `scripts/check-contracts.sh` — confirms verification is Spectral lint + operationId coverage (not live-vs-committed diff)

### Tertiary (LOW confidence)
- Training knowledge of FastAPI exception-handler / StaticFiles / PyJWT patterns (used in Code Examples; verify against official FastAPI 0.141 docs during plan execution)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified against PyPI; contract + STACK.md authoritative
- Architecture: HIGH - derived directly from the frozen OpenAPI contract and interop law
- Pitfalls: HIGH - each maps to a concrete contract/interop rule or known FastAPI/Mongo behavior

**Research date:** 2026-08-27
**Valid until:** 2026-09-26 (30 days; fast-moving only if FastAPI/PyMongo ship breaking releases — re-check at Phase 8 frontend work)
