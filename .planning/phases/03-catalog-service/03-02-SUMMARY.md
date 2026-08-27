---
phase: 03-catalog-service
plan: 02
subsystem: api
tags: [fastapi, pymongo, mongodb, catalog, filter, search, sort, pagination, testcontainers]

# Dependency graph
requires:
  - phase: 03-01
    provides: listProducts tracer + db.list_products + Wave-0 testcontainers infra (conftest, test_list, test_get)
provides:
  - Contract-correct category filter (exact match) + $text search + sort/order + pagination hardening on listProducts
  - Deterministic _id tie-break so paginated listings are repeatable (CAT-04 adjacency)
  - Dedicated CAT-03 (test_filter.py) and CAT-04 (test_search.py) automated coverage
affects:
  - 03-03 (seed + SVG assets — will reuse the hardened listProducts for verification)
  - 03-04 (admin CRUD — listProducts contract unchanged, still public)
  - 08 (frontend browse/filter/search views consume this endpoint)

# Actuals (#2632) — chars/4 over hand-authored files changed in this plan.
actuals:
  tokens: 3619
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - db.list_products accepts an explicit sort_spec list; callers append a deterministic ("_id", 1) tie-break
    - Exact-match category filter + $text search (only when q is non-empty) — no raw request JSON interpolated into find() (T-03-03 guard)
    - total = count_documents(filter) reflects the whole filtered set, independent of paging

key-files:
  created:
    - services/catalog-service/tests/test_filter.py
    - services/catalog-service/tests/test_search.py
  modified:
    - services/catalog-service/app/routes.py
    - services/catalog-service/app/db.py

key-decisions:
  - "db.list_products now takes an explicit sort_spec (list of (field, dir) tuples) instead of (sort_field, direction); routes always append a deterministic _id ascending tie-break so equal-primary-key rows are ordered repeatably."
  - "Category filter is EXACT string equality only; empty/unknown category resolves to an empty result with total 0 — no substring or operator logic (NoSQL-injection guard T-03-03)."
  - "q is added as a $text clause ONLY when non-empty; empty/absent q omits the clause so all products match (no $regex interpolation on raw input)."
  - "Pydantic Query constraints (limit ge=1 le=100, offset ge=0) already reject out-of-range input with 400 VALIDATION_FAILED via the plan-01 validation handler — no clamping."

patterns-established:
  - "Defense-in-depth tie-break: db.list_products appends ("_id", 1) if the caller's sort_spec lacks a trailing _id element, guaranteeing stable pagination even if a future caller forgets."

requirements-completed: [CAT-03, CAT-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "CAT-03 exact category filter: ?category=X returns only exact-match products and total reflects the filtered set size; unknown category returns items=[] with total 0."
    requirement: CAT-03
    verification:
      - kind: unit
        ref: "tests/test_filter.py::test_category_filter_exact_match, test_category_filter_total_vs_full, test_unknown_category_empty"
        status: pass
    human_judgment: false
  - id: D2
    description: "CAT-04 text search + sort + pagination: ?q matches via $text index; ?sort=price|name with ?order=asc|desc orders correctly; limit=1 returns <=1 with unchanged total; offset=99999 returns empty items with unchanged total; tie-break ordering is stable across calls."
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "tests/test_search.py::test_search_q_matches_and_total, test_empty_q_omits_filter, test_sort_price_desc, test_sort_name_asc, test_pagination_limit, test_offset_beyond_collection, test_tie_break_stable"
        status: pass
    human_judgment: false

# Metrics
duration: 18 min
completed: 2026-08-27
status: complete
---

# Phase 03 Plan 02: Catalog Service Filter / Search / Sort Hardening Summary

**Contract-correct listProducts: exact category filter (CAT-03), `$text` search + price/name sort with deterministic `_id` tie-break and boundary-safe pagination (CAT-04), backed by dedicated testcontainers tests — 15 tests green.**

## Performance

- **Duration:** ~18 min (read plan/contracts + harden query + write tests + run suite)
- **Started:** 2026-08-27
- **Completed:** 2026-08-27
- **Tasks:** 2
- **Files modified:** 4 (2 source + 2 test)

## Accomplishments

- Hardened `listProducts` in `routes.py` + `db.list_products` so the category filter is exact-match only and `q` adds a `$text` clause strictly when non-empty (empty/absent `q` matches everything). Raw request JSON is never interpolated into `find()` (T-03-03 NoSQL-injection guard).
- Introduced an explicit `sort_spec` list API on `db.list_products`; routes always append a deterministic `("_id", 1)` tie-break so equal-primary-key rows are ordered repeatably — making paginated listings stable (CAT-04 adjacency assumption resolved).
- Kept `total = count_documents(filter)` so `total` reflects the whole filtered collection independent of paging, and preserved Pydantic `Query` bounds (`limit` ge=1 le=100, `offset` ge=0) which reject out-of-range input with `400 VALIDATION_FAILED` (not clamped).
- Added `tests/test_filter.py` (CAT-03: exact category filter + unknown-category empty) and `tests/test_search.py` (CAT-04: `$text` search, price desc, name asc, `limit=1`, `offset=99999`, deterministic tie-break stability, empty-q edge).
- Full Catalog Service suite green: **15 passed** (11 new + 4 existing Plan 01 tests).

## Task Commits

Each task was committed atomically:

1. **Task 1 (harden query):** `51aab86` (feat) — category filter + $text search + sort_spec/_id tie-break
2. **Task 2 (dedicated tests):** `c6055d4` (test) — CAT-03 test_filter.py + CAT-04 test_search.py

_Plan metadata commit follows this summary._

## Files Created/Modified

- `services/catalog-service/app/routes.py` — `list_products` builds `sort_spec = [(sort_key, direction), ("_id", 1)]` and passes `category`/`q`/explicit sort to db
- `services/catalog-service/app/db.py` — `list_products` now takes `sort_spec: list[tuple[str, int]]`; exact category match + non-empty `$text` only; appends `_id` tie-break defensively; `total = count_documents(filter)`
- `services/catalog-service/tests/test_filter.py` — CAT-03 coverage (3 tests)
- `services/catalog-service/tests/test_search.py` — CAT-04 coverage (8 tests)

## Decisions Made

- **Explicit `sort_spec` over `sort_field`+`direction`:** callers compose the sort tuple list including the deterministic `_id` tie-break; `db.list_products` also guards by appending `_id` if missing. This makes pagination repeatable regardless of equal sort keys.
- **Exact category equality, no substring/operator logic:** an unknown category yields `items=[]` and `total=0`. This is the T-03-03 mitigation (no operator injection surface).
- **`$text` only when `q` is non-empty:** empty/absent `q` omits the clause entirely (all products match); never builds `$regex` from raw input (ReDoS/NoSQL guard).
- **Boundary rejection is already correct:** the plan-01 `RequestValidationError` handler returns `400 VALIDATION_FAILED`; with `ge`/`le` constraints, out-of-range `limit`/`offset` are rejected rather than clamped.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `uv` is not installed on the host. Per the plan's guidance, ran the suite via a throwaway venv in `%TEMP%` (`pip install -e .` + `pytest==9.1.1 pytest-asyncio==1.4.0 testcontainers==4.15.0 httpx==0.28.1`) against testcontainers `mongo:8.0` (Docker available). No source change required.

## User Setup Required

None - no external service configuration required. The root `.env` supplies `JWT_SECRET`/`MONGO_URI`; tests use a session-scoped testcontainers MongoDB.

## Next Phase Readiness

- `listProducts` is now contract-correct for category filter (CAT-03) and text search + sort/pagination (CAT-04), tested green.
- Ready for **03-03** (idempotent ~20-product seed + committed placeholder SVGs + static serving) and **03-04** (JWT self-verify + admin CRUD, which keeps `listProducts` public). The frontend (Phase 8) can rely on the category/sort/search/pagination contract as finalized here.

---
*Phase: 03-catalog-service*
*Completed: 2026-08-27*

## Self-Check: PASSED

- Created files exist: `tests/test_filter.py`, `tests/test_search.py` present.
- Modified files present: `app/routes.py`, `app/db.py` updated.
- Task commits present: `51aab86` (feat), `c6055d4` (test).
- `pytest` green: 15 passed (test_filter.py + test_search.py + test_list.py + test_get.py).
- Plan 01 tests (test_list.py, test_get.py) still pass — no regression.
- CAT-03 and CAT-04 behaviors covered by automated assertions; no stubs, no skipped tests.
