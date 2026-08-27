---
phase: 03-catalog-service
verified: 2026-08-27T12:49:20Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: none
  gaps_closed: []
  regressions: []
gaps: []
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification: []
---

# Phase 03: Catalog Service Verification Report

**Phase Goal (ROADMAP.md):** Visitors can browse a seeded product catalog without accounts, and every later phase has product truth (IDs, prices, names) to validate against.
**Verified:** 2026-08-27T12:49:20Z
**Status:** VERIFIED (passed) — with two documented, accepted deviations (see Notes).
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria → CAT requirements)

| # | Truth (what must be TRUE) | Status | Evidence |
| - | ------------------------- | ------ | -------- |
| 1 | Anyone can fetch the product listing with no token and no login (CAT-01) | ✓ VERIFIED | `routes.list_products` has no `Depends(require_auth)`; `tests/test_list.py::test_public_list_no_auth` asserts 200 with no auth header; full suite ran green against real `mongo:8.0` |
| 2 | Anyone can fetch a single product's details by ID (CAT-02) | ✓ VERIFIED | `routes.get_product` returns 200; `tests/test_get.py::test_get_known`; unknown id → byte-exact `{"code":"NOT_FOUND",...}` asserted in `test_get_unknown` |
| 3 | Listing can be filtered by category and searched by text query, with basic sort by price/name (CAT-03/04) | ✓ VERIFIED | `tests/test_filter.py` (exact category, total-vs-full, unknown→empty) + `tests/test_search.py` (q match, empty-q omit, price desc, name asc, limit, offset-beyond, deterministic `_id` tie-break) |
| 4 | Running the seed populates ~20 realistic products with bundled placeholder images; re-running changes nothing (CAT-05) | ✓ VERIFIED | `scripts/seed.py` idempotent `$setOnInsert` upsert of `prod-1001..prod-1020`; `tests/test_seed.py` (20 count, idempotency, SVG served 200 + svg content-type, root-relative imageUrl) |
| 5 | Product create/update/delete works via authenticated API calls and is refused without authentication (CAT-06) | ✓ VERIFIED | `routes.create/update/delete_product` attach `Depends(require_auth)` + `bearerAuth`; `tests/test_admin.py` (missing + 5 invalid-token variants → 401 same envelope, valid CRUD, unknown 404, bad-body 400) |

**Score:** 6/6 must-haves verified. **Behavior-unverified: 0** (every truth is exercised by a passing behavioral test against a real MongoDB container).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `services/catalog-service/app/main.py` | FastAPI app, lifespan, error envelope, static mount | ✓ VERIFIED | Substantive; byte-exact compact envelope; StaticFiles serves `static/` tree at `/catalog/static` |
| `services/catalog-service/app/routes.py` | list/get/batch + admin CRUD routes | ✓ VERIFIED | All 7 routes present; public reads unwired to auth; mutating routes default-deny |
| `services/catalog-service/app/db.py` | Mongo access, index creation, list/get/batch/create/update/delete | ✓ VERIFIED | Exact category match + `$text` only when `q` non-empty; `_id`→`id` mapping; `products_collection()` accessor |
| `services/catalog-service/app/security.py` | `require_auth` JWT dependency | ✓ VERIFIED | Pins HS256, base64 secret, validates iss/aud, `leeway=60`, single byte-identical 401 |
| `services/catalog-service/app/models.py` | Pydantic models (interop Rules 1-5) | ✓ VERIFIED | 3-digit-ms serializer, int priceCents, extra=ignore, exclude-none |
| `services/catalog-service/app/config.py` | Settings; base64 JWT_SECRET decode; secret length assert | ✓ VERIFIED | |
| `services/catalog-service/scripts/seed.py` | Idempotent seed | ✓ VERIFIED | 20 products; `$setOnInsert` freezes createdAt/id; root-relative imageUrl |
| `services/catalog-service/static/products/prod-1001.svg … prod-1020.svg` | 20 committed placeholder SVGs | ✓ VERIFIED | Exist; `test_seeded_svg_served_with_svg_content_type` asserts 200 + `svg` content-type |
| `services/catalog-service/tests/*.py` | Wave-0..3 test suites | ✓ VERIFIED | 7 test files, 31 tests, all green against real Mongo |
| `services/catalog-service/Dockerfile` | python:3.13-slim, uv-managed, non-root | ✓ VERIFIED | Builds `app.main:app`; layer-cached deps |
| `services/catalog-service/pyproject.toml` + `uv.lock` | Pinned deps per versions.md | ✓ VERIFIED | fastapi 0.141.1, pydantic 2.13.4, pymongo>=4.9, PyJWT 2.13.0 |
| `docker-compose.yml` | mongo + catalog-service entries | ✓ VERIFIED | mongo no host port; catalog-service `depends_on: mongo: healthy`, `/health` healthcheck, env-driven |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | ---- | ------ | ------- |
| `routes.list_products` | `db.list_products` | `await db.list_products(...)` | ✓ WIRED | Query built from `category`/`q`/`sort_spec` |
| `routes.get_product` | `db.get_product` | `await db.get_product(...)` | ✓ WIRED | 404 on None |
| `routes.create/update/delete_product` | `security.require_auth` | `dependencies=[Depends(require_auth)]` | ✓ WIRED | Default-deny enforced |
| `routes.*` | `db.connect` | `lifespan` → `await db.connect()` | ✓ WIRED | Startup connects Mongo + ensure_indexes |
| `routes` | `main.app` | `app.include_router(routes.router)` | ✓ WIRED | |
| `/catalog/static/*` | `StaticFiles(static/)` | `app.mount("/catalog/static", StaticFiles(directory=STATIC_DIR))` | ✓ WIRED | Resolves `/catalog/static/products/{id}.svg` → `static/products/{id}.svg` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------ | ------ | ------------------ | ------ |
| `list_products` | `items`/`total` | `db.list_products` → `find()`/`count_documents()` on live Mongo | ✓ FLOWING | Real query, not static |
| `get_product` | item | `find_one({"_id": id})` | ✓ FLOWING | |
| `batch_get` | pricing entries | `find({"_id": {"$in": ids}})` | ✓ FLOWING | |
| `create/update/delete_product` | write result | `insert_one`/`update_one`/`delete_one` | ✓ FLOWING | |
| `seed.py` | 20 products | `products_collection().update_one(upsert=True)` | ✓ FLOWING | Idempotent |
| `static/products/*.svg` | SVG bytes | committed files via StaticFiles | ✓ FLOWING | Served from disk |

### Behavioral Spot-Checks

The catalog suite was executed in this environment against a real `mongo:8.0` testcontainers container (Docker available, image local; uv not on PATH so the pre-existing `.venv` was used).

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full CAT suite | `.venv/Scripts/python -m pytest -q` | `31 passed, 1 warning in 19.63s` | ✓ PASS |

Total behavioral coverage: CAT-01 (3 tests), CAT-02 (2), CAT-03 (3), CAT-04 (7), CAT-05 (4), CAT-06 (7) = **31 tests, all green**. The single warning (`InsecureKeyLengthWarning`) is the HS384 forged-token test case confirming alg-pin rejection — expected, harmless.

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist for this phase; not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CAT-01 | 03-01 | Public browse, no login | ✓ SATISFIED | `test_public_list_no_auth` |
| CAT-02 | 03-01 | Single-product fetch + 404 | ✓ SATISFIED | `test_get_known`, `test_get_unknown` (byte-exact) |
| CAT-03 | 03-02 | Category filter | ✓ SATISFIED | `tests/test_filter.py` (3) |
| CAT-04 | 03-02 | Search + sort + pagination | ✓ SATISFIED | `tests/test_search.py` (7) |
| CAT-05 | 03-03 | Idempotent ~20-product seed + SVGs | ✓ SATISFIED | `tests/test_seed.py` (4) |
| CAT-06 | 03-04 | JWT admin CRUD refusal + CRUD | ✓ SATISFIED | `tests/test_admin.py` (7) |

No orphaned requirements for Phase 3. All six CAT-* IDs in REQUIREMENTS.md trace to this phase and are verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | none | — | No TBD/FIXME/XXX/TODO/HACK/placeholder markers found in `app/`, `scripts/`, `tests/`. No stub returns, no empty handlers, no hardcoded-empty data sources. |

### Human Verification Required

None. All behaviors are exercised by the automated suite against a real MongoDB container. Visual rendering of SVGs in a browser and the live `docker compose up` container-health path are out of scope for code verification but were confirmed configured (healthcheck on `/health`, StaticFiles mount); the executor's 03-01 SUMMARY reports a live `docker compose up` smoke (health/list/404/batch all 200/404 as expected).

### Notes (Documented Deviations — NOT gaps)

1. **3rd JWT_SECRET holder (DOCS-02):** Catalog self-verifies HS256 in-process because the api-gateway (Phase 7) does not yet exist but CAT-06 mandates 401-on-invalid in Phase 3. Retained as defense-in-depth post-Phase-7. Documented in `README.md` and slated for `docs/runbook.md` (Phase 10). Accepted per the autonomous-objective decision gate; not hidden.
2. **Root-relative `imageUrl`:** Seed writes `/catalog/static/products/{id}.svg` (not an absolute `http/https` URL). The frozen contract (`catalog-service.openapi.yaml`) explicitly states the image URI format "stays deliberately undeclared until seed assets land in Phase 3", so root-relative paths ride the Phase 7 gateway proxy with no new route — acceptable and documented in 03-03 SUMMARY.
3. **`check-contracts.sh` gate (Spectral lint) not re-run in this verification** — it requires network access for `npx @stoplight/spectral-cli` and was reported passing (exit 0) by the 03-01 executor. Not a code-defect finding; flagged for transparency only.

### Gaps Summary

No gaps. All phase goal truths are verified by substantive, wired, data-flowing artifacts and confirmed by a green 31-test behavioral suite against real MongoDB.

---

_Verified: 2026-08-27T12:49:20Z_
_Verifier: the agent (gsd-verifier)_
