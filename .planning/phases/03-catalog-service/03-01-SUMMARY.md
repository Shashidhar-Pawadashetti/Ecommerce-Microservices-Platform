---
phase: 03-catalog-service
plan: 01
subsystem: api
tags: [fastapi, pymongo, mongodb, catalog, json-interop, uv, testcontainers]

# Dependency graph
requires: []
provides:
  - Catalog Service FastAPI app (public read path: list/detail/batch/health) reading MongoDB 8.0
  - docker-compose.yml extended with mongo + catalog-service (healthy)
  - Wave-0 pytest infrastructure (testcontainers mongo) + CAT-01/CAT-02 tests
  - Interop-serialization discipline (3-digit-ms ts, integer cents, null-omission, string ids, extra=ignore)
affects:
  - 03-02 (filter/search/sort hardening)
  - 03-03 (seed + static SVGs)
  - 03-04 (admin CRUD + JWT self-verify enforcement)
  - 07 (api-gateway routing to /catalog)

# Actuals (#2632) — chars/4 over hand-authored files (uv.lock is generated, excluded).
actuals:
  tokens: 7852
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added:
    - fastapi[standard]==0.141.1
    - pydantic==2.13.4
    - pydantic-settings==2.15.0
    - pymongo>=4.9 (AsyncMongoClient, never Motor)
    - PyJWT==2.13.0
    - uv (single dependency manager) + uv.lock
    - pytest==9.1.1
    - pytest-asyncio==1.4.0
    - testcontainers==4.15.0
    - httpx==0.28.1
  patterns:
    - FastAPI lifespan: connect Mongo -> ensure_indexes -> serve -> close
    - Unified {"code","message"} error envelope as byte-exact compact JSON (interop Rule 4 safe)
    - JWT_SECRET decoded from base64 at settings load; startup length assertion (>=32 bytes), length-only log
    - Idempotent index creation (category asc + single text index on name+description)
    - _id -> id mapping on every read (interop Rule 3)
    - response_model_exclude_none=True; extra="ignore" on all models (Rules 4/5)
    - 3-digit-ms createdAt field serializer (interop Rule 1)
    - testcontainers MongoDbContainer(session) + AsyncClient ASGITransport fixture

key-files:
  created:
    - services/catalog-service/app/__init__.py
    - services/catalog-service/app/config.py
    - services/catalog-service/app/models.py
    - services/catalog-service/app/db.py
    - services/catalog-service/app/security.py
    - services/catalog-service/app/routes.py
    - services/catalog-service/app/main.py
    - services/catalog-service/Dockerfile
    - services/catalog-service/pyproject.toml
    - services/catalog-service/uv.lock
    - services/catalog-service/.env.example
    - services/catalog-service/README.md
    - services/catalog-service/.dockerignore
    - services/catalog-service/static/products/.gitkeep
    - services/catalog-service/tests/conftest.py
    - services/catalog-service/tests/test_list.py
    - services/catalog-service/tests/test_get.py
    - services/catalog-service/tests/test_models.py
  modified:
    - docker-compose.yml

key-decisions:
  - "Use pymongo AsyncMongoClient (>=4.9) — Motor is forbidden per STACK.md; native asyncio client only."
  - "uv is the single dependency manager: committed uv.lock, Dockerfile installs via `uv sync --frozen --no-dev`, README documents `uv sync` / `uv run`."
  - "Unified error envelope emitted as compact json.dumps(separators=(',',':')) so byte-exact bodies (e.g. NOT_FOUND) are reproducible and the /health grep for '\"status\":\"ok\"' matches."
  - "require_auth dependency defined now (security.py) so Plan 04 admin routes import it without refactor; not yet wired to public routes per plan."
  - "Catalog is the third JWT_SECRET holder in v1 (with auth-service + gateway) — recorded as deviation DOCS-02; self-verify is defense-in-depth."

patterns-established:
  - "Interop serialization contract (json-interop.md Rules 1-5) enforced at model + route + envelope layers."
  - "Contract-faithful routes: explicit operation_id per route; bearerAuth declared via openapi_extra."

requirements-completed: [CAT-01, CAT-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Catalog Service tracer: FastAPI app reads MongoDB 8.0, serves listProducts / batchGetProducts / getProduct / health exactly per frozen contract; runs healthy under Docker Compose."
    requirement: CAT-01
    verification:
      - kind: integration
        ref: "docker compose up -d mongo catalog-service + curl /health,/catalog/products,/catalog/products/{id},/batch"
        status: pass
    human_judgment: false
  - id: D2
    description: "Wave-0 pytest suite (testcontainers mongo): CAT-01 public list no-auth + pagination; CAT-02 known 200 + byte-exact NOT_FOUND; model interop (3-digit-ms, null-omission, int priceCents, extra=ignore)."
    requirement: CAT-02
    verification:
      - kind: unit
        ref: "pytest tests/test_list.py tests/test_get.py tests/test_models.py -q (10 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plan-level contract drift gate passes (spectral lint, topic schemas, EOL law, version manifest, spec coverage)."
    verification:
      - kind: other
        ref: "bash scripts/check-contracts.sh (exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 50 min
completed: 2026-08-27
status: complete
---

# Phase 03 Plan 01: Catalog Service Tracer Summary

**FastAPI + PyMongo AsyncMongoClient catalog service reading MongoDB 8.0, serving the frozen public read contract (list / detail / batch / health) under Docker Compose, with a passing testcontainers-backed Wave-0 test suite — de-risking the first Python/Mongo service before feature expansion.**

## Performance

- **Duration:** ~50 min (read contract/research + implement + docker build + tests + contract gate)
- **Started:** 2026-08-27
- **Completed:** 2026-08-27
- **Tasks:** 2 (tracer + test infrastructure)
- **Files modified:** 19 created + 1 modified (docker-compose.yml)

## Accomplishments

- Built the full Catalog Service FastAPI app: `config` (base64 JWT_SECRET decode + startup length assertion), `models` (Pydantic v2 with 3-digit-ms `createdAt` serializer, integer `priceCents`, `extra="ignore"`, null-omission), `db` (`AsyncMongoClient` connect/ensure_indexes/close + read helpers with `_id`→`id` mapping), `security` (`require_auth` dependency defined for Plan 04), `routes` (listProducts / batchGetProducts / getProduct / health with explicit `operation_id`), `main` (lifespan, unified error envelope, static mount).
- Extended root `docker-compose.yml` with `mongo:8.0` (no host port, healthcheck) and `catalog-service` (build, transitional `8000:8000`, `mem_limit: 512m`, `depends_on: mongo: service_healthy`, `python -c` healthcheck).
- Verified end-to-end against real MongoDB via `docker compose up`: `/health` → `{"status":"ok"}`, `GET /catalog/products` → 200 ProductList, unknown id → 404 byte-exact NOT_FOUND envelope, batch with unknown ids → `[]`, and a positive read returns correct `_id`→`id` mapping + `2026-08-24T12:00:00.123Z` timestamps.
- Added Wave-0 test infrastructure: `conftest.py` (session MongoDbContainer + async ASGI client + `auth_token` fixture), `test_list.py` (CAT-01), `test_get.py` (CAT-02, byte-exact NOT_FOUND), `test_models.py` (interop Rules 1/2/4/5). `pytest` green — 10 passed.
- `uv` is the single dependency manager with a committed `uv.lock`; `scripts/check-contracts.sh` passes (exit 0).

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer):** `86b1f45` (feat) — FastAPI + PyMongo + Mongo + Compose read path
2. **Task 2 (tests):** `02af5ff` (test) — Wave-0 test infrastructure + CAT-01/02 + interop tests

_Plan metadata commit follows this summary._

## Files Created/Modified

- `services/catalog-service/app/*.py` — config, models, db, security, routes, main, `__init__`
- `services/catalog-service/Dockerfile` — python:3.13-slim, non-root, uv-managed deps
- `services/catalog-service/pyproject.toml` + `uv.lock` — pinned deps per versions.md
- `services/catalog-service/.env.example`, `README.md`, `.dockerignore`
- `services/catalog-service/static/products/.gitkeep` — placeholder for Plan 03 SVGs
- `services/catalog-service/tests/{conftest,test_list,test_get,test_models}.py`
- `docker-compose.yml` — extended with `mongo` + `catalog-service` (modified)

## Decisions Made

- **pymongo AsyncMongoClient (>=4.9), never Motor** — STACK.md forbids Motor; the native asyncio client is used for all reads.
- **uv as single dependency manager** — committed `uv.lock`; Dockerfile installs via `uv sync --frozen --no-dev`, README documents `uv sync` / `uv run`. Parity with payment-service.
- **Byte-exact compact error envelope** — `json.dumps(separators=(",",":"))` guarantees reproducible `{"code":"NOT_FOUND",...}` and lets the Compose `/health` grep match `{"status":"ok"}` exactly.
- **require_auth defined now, wired in Plan 04** — satisfies T-03-01 (default-deny mutating routes) without later refactor.
- **v1 third JWT holder** — catalog self-verifies HS256; deviation recorded for DOCS-02 (runbook).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `testcontainers[python]==4.15.0` extra does not exist**
- **Found during:** Task 2 (pyproject / conftest)
- **Issue:** `versions.md` pins `testcontainers[python]==4.15.0`, but the published `testcontainers==4.15.0` has no `python` extra; `uv lock` warned and the extra was dropped.
- **Fix:** Pinned `testcontainers==4.15.0` (the package *is* the Python library; same functionality). Regenerated `uv.lock` cleanly.
- **Files modified:** `services/catalog-service/pyproject.toml`, `uv.lock`
- **Verification:** `uv lock` clean (no warning); `pytest` 10 passed.
- **Committed in:** `02af5ff` (Task 2)

**2. [Rule 2 - Missing Critical] Deprecated `testcontainers.mongodb` import**
- **Found during:** Task 2 (test run)
- **Issue:** `from testcontainers.mongodb import MongoDbContainer` emits a DeprecationWarning; the module is deprecated.
- **Fix:** Switched to `from testcontainers.community.mongodb import MongoDbContainer`.
- **Files modified:** `services/catalog-service/tests/conftest.py`
- **Verification:** `pytest` runs with zero warnings.
- **Committed in:** `02af5ff` (Task 2)

**3. [Rule 2 - Missing Critical] Added `.dockerignore` (not in plan file list)**
- **Found during:** Task 1 (Docker build)
- **Issue:** Without an ignore file the host `.venv` (from `uv sync`) would be copied into the build context, bloating the image.
- **Fix:** Added `services/catalog-service/.dockerignore` excluding `.venv`, `__pycache__`, `.pytest_cache`, `.git`, `.env`.
- **Files modified:** `services/catalog-service/.dockerignore`
- **Committed in:** `86b1f45` (Task 1)

---
**Total deviations:** 3 auto-fixed (1 blocking package-spec correction, 2 missing-critical hygiene)
**Impact on plan:** All auto-fixes necessary for a correct, warning-free build/test. No scope creep; the contract and interop behaviors are unchanged.

## Issues Encountered

- None beyond the deviations above. `uv` was not preinstalled on the host; installed via `pip install uv` (tooling, not a plan dependency). Docker and testcontainers performed the real-Mongo verification as planned.

## User Setup Required

None - no external service configuration required for this tracer. The root `.env` already supplies `JWT_SECRET`, `MONGO_URI`, etc.; `uv` workflow is documented in `services/catalog-service/README.md`.

## Next Phase Readiness

- Catalog Service tracer is healthy and contract-faithful; ready for **03-02** (category filter / text search / sort hardening), **03-03** (seed + static SVG assets), and **03-04** (admin CRUD + JWT self-verify enforcement, which wires `require_auth` defined here).
- Gateway (Phase 7) can later route `/catalog/**` to this service; the `bearerAuth` security scheme is already declared via `openapi_extra`.

---
*Phase: 03-catalog-service*
*Completed: 2026-08-27*

## Self-Check: PASSED

- All 19 created files exist on disk; docker-compose.yml modified as intended.
- Both task commits present: `86b1f45` (feat), `02af5ff` (test).
- `uv.lock` is tracked.
- Tracer smoke (health/list/404/batch/positive read) passed against real MongoDB via Compose.
- `pytest` green (10 passed); `scripts/check-contracts.sh` exits 0.
- CAT-01 (public list, no token) and CAT-02 (public detail, byte-exact NOT_FOUND) demonstrated and tested.
