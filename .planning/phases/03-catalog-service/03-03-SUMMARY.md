---
phase: 03-catalog-service
plan: 03
subsystem: api
tags: [fastapi, pymongo, mongodb, catalog, seed, idempotent, svg, static, testcontainers, cat-05]

# Dependency graph
requires:
  - phase: 03-01
    provides: db.connect/ensure_indexes/products collection + StaticFiles mount at /catalog/static
  - phase: 03-02
    provides: hardened listProducts (consumed implicitly by later verification)
provides:
  - Deterministic ~20-product catalog (ids prod-1001..prod-1020, integer priceCents, root-relative imageUrl) — the shared product-truth fixture for cart/order/frontend phases
  - 20 committed placeholder SVGs served at /catalog/static/products/{id}.svg
  - Idempotent seed (re-run is a no-op: count + createdAt stable) so `compose down -v && up` reproduces
affects:
  - 03-04 (admin CRUD reuses seed shape / products_collection accessor)
  - 04 (cart validates product IDs/prices against this seeded catalog)
  - 05 (order snapshots prices from these products)
  - 08 (frontend renders these names/prices/images)
  - 07 (gateway proxies /catalog/** including /catalog/static — no new route needed)

# Actuals (#2632) — chars/4 over hand-authored files changed in this plan (generated SVGs counted).
actuals:
  tokens: 6300
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Idempotent upsert keyed on stable _id with $setOnInsert freezing createdAt (re-run is a no-op)
    - Root-relative imageUrl (/catalog/static/products/{id}.svg) so assets ride the gateway proxy with no extra routing
    - products_collection() public accessor reusing Plan 01 connection (no new Mongo connection logic)
    - StaticFiles serves the whole static/ tree so /catalog/static/{subpath} maps to static/{subpath}

key-files:
  created:
    - services/catalog-service/scripts/__init__.py
    - services/catalog-service/scripts/seed.py
    - services/catalog-service/scripts/gen_placeholders.py
    - services/catalog-service/static/products/prod-1001.svg
    - services/catalog-service/static/products/prod-1002.svg
    - services/catalog-service/static/products/prod-1003.svg
    - services/catalog-service/static/products/prod-1004.svg
    - services/catalog-service/static/products/prod-1005.svg
    - services/catalog-service/static/products/prod-1006.svg
    - services/catalog-service/static/products/prod-1007.svg
    - services/catalog-service/static/products/prod-1008.svg
    - services/catalog-service/static/products/prod-1009.svg
    - services/catalog-service/static/products/prod-1010.svg
    - services/catalog-service/static/products/prod-1011.svg
    - services/catalog-service/static/products/prod-1012.svg
    - services/catalog-service/static/products/prod-1013.svg
    - services/catalog-service/static/products/prod-1014.svg
    - services/catalog-service/static/products/prod-1015.svg
    - services/catalog-service/static/products/prod-1016.svg
    - services/catalog-service/static/products/prod-1017.svg
    - services/catalog-service/static/products/prod-1018.svg
    - services/catalog-service/static/products/prod-1019.svg
    - services/catalog-service/static/products/prod-1020.svg
    - services/catalog-service/tests/test_seed.py
  modified:
    - services/catalog-service/app/db.py
    - services/catalog-service/app/main.py

key-decisions:
  - "Seed upserts each product by stable _id (prod-1001..prod-1020) using $setOnInsert for createdAt + id; all other fields ($set) are re-applied each run but never change, so re-seeding is observably a no-op."
  - "imageUrl is derived from the stable id as /catalog/static/products/{id}.svg (root-relative, never absolute external URL) so it works behind the Phase 7 gateway proxy with no new route."
  - "StaticFiles mount root moved up one level to the static/ tree (mount prefix /catalog/static unchanged) so the planned URL /catalog/static/products/{id}.svg resolves to static/products/{id}.svg."

requirements-completed: [CAT-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "CAT-05: seed populates exactly 20 products with stable ids prod-1001..prod-1020, integer priceCents, and root-relative imageUrl; re-running the seed is a no-op (count + createdAt preserved)."
    requirement: CAT-05
    verification:
      - kind: unit
        ref: "tests/test_seed.py::test_seed_creates_twenty_products, test_seed_is_idempotent, test_seeded_image_url_is_root_relative"
        status: pass
    human_judgment: false
  - id: D2
    description: "CAT-05 static serving: GET /catalog/static/products/prod-1001.svg returns 200 with svg content-type (StaticFiles mount)."
    requirement: CAT-05
    verification:
      - kind: unit
        ref: "tests/test_seed.py::test_seeded_svg_served_with_svg_content_type"
        status: pass
    human_judgment: false

# Metrics
duration: 25 min
completed: 2026-08-27
status: complete
---

# Phase 03 Plan 03: Catalog Service Idempotent Seed + Placeholder SVGs Summary

**A deterministic 20-product catalog seeded idempotently (re-run is a no-op) with 20 committed placeholder SVGs served at `/catalog/static/products/{id}.svg` — giving every later phase stable product truth (ids, names, prices, images). CAT-05 satisfied.**

## Performance

- **Duration:** ~25 min (read plan/contracts + write seed/generator/test + generate SVGs + run suite + live idempotency check)
- **Started:** 2026-08-27
- **Completed:** 2026-08-27
- **Tasks:** 2
- **Files modified:** 27 (24 created + 2 source modified + 1 package marker)

## Accomplishments

- Created `scripts/seed.py`: upserts 20 realistic products (`prod-1001`..`prod-1020`) across categories `electronics`/`accessories`/`apparel`/`home`, each with a stable `name`, integer `priceCents`, `stock`, `description`, and a fixed 3-digit-ms ISO `createdAt`. Each product is upserted keyed on its stable `_id` using `$set` for mutable-ish fields and `$setOnInsert` for `createdAt`/`id`, so **re-running the seed changes nothing** — verified live (count stays 20, `createdAt` byte-identical) and in the test suite.
- Created `scripts/gen_placeholders.py`: a one-shot generator that writes 20 standalone valid SVGs (gradient background + product name + category + id, XML-escaped) into `static/products/prod-NNNN.svg`. It imports the canonical product list from `seed.py` so labels never drift. The 20 SVGs are committed (real assets, reproducible across re-runs — no runtime binary generation).
- Aligned `app/main.py` so `StaticFiles` serves the whole `static/` tree under the unchanged `/catalog/static` mount prefix. This makes the planned contract URL `/catalog/static/products/{id}.svg` resolve to `static/products/{id}.svg` (the original mount pointed at `static/products/`, which would have 404'd on the `/products/` path segment). `imageUrl` values are therefore root-relative and ride the Phase 7 gateway proxy with no extra routing.
- Added a `products_collection()` public accessor in `app/db.py` so the seed reuses the Plan 01 connection/collection with no new Mongo connection logic.
- Added `tests/test_seed.py` (CAT-05): proves (1) exactly 20 products seeded, (2) re-seed idempotency (count + `createdAt` stable, all planned ids present), (3) `GET /catalog/static/products/prod-1001.svg` returns 200 with an `svg` content-type, and (4) `imageUrl` is root-relative. Full catalog suite green: **24 passed**.

## Task Commits

Each task was committed atomically:

1. **Task 1 (seed + generator + SVGs):** `016a453` (feat) — scripts/seed.py, scripts/gen_placeholders.py, 20 committed SVGs, db.py accessor, main.py static-root fix
2. **Task 2 (test):** `4972e16` (test) — tests/test_seed.py (CAT-05)

_Plan metadata commit follows this summary._

## Files Created/Modified

- `services/catalog-service/scripts/__init__.py` — package marker
- `services/catalog-service/scripts/seed.py` — idempotent seed (run `python -m scripts.seed`)
- `services/catalog-service/scripts/gen_placeholders.py` — one-shot SVG generator
- `services/catalog-service/static/products/prod-1001.svg` … `prod-1020.svg` — 20 committed placeholder SVGs
- `services/catalog-service/tests/test_seed.py` — CAT-05 idempotency + static-serving test
- `services/catalog-service/app/db.py` — `products_collection()` public accessor
- `services/catalog-service/app/main.py` — StaticFiles serves `static/` tree root

## Decisions Made

- **Idempotent upsert via `$setOnInsert` for `createdAt`:** re-seeding never duplicates documents (stable `_id`) nor mutates `createdAt` — satisfies the CAT-05 no-op contract and keeps `docker compose down -v && up` reproducible.
- **Root-relative `imageUrl`:** `/catalog/static/products/{id}.svg` (never absolute external URL) so assets work behind the gateway proxy with no new route in Phase 7.
- **Static mount root moved to `static/`:** keeps the documented `/catalog/static` mount prefix but serves the parent tree, so the planned `/catalog/static/products/{id}.svg` URL resolves correctly. Minimal, plan-faithful fix (the original `static/products` mount root would have 404'd on the `/products/` segment).
- **`products_collection()` accessor:** seed reuses Plan 01's connection (no new Mongo client), per the plan's "no new connection logic" constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StaticFiles mount root did not match the planned contract URL**
- **Found during:** Task 2 verification (`test_seeded_svg_served_with_svg_content_type` failed — 404)
- **Issue:** `main.py` mounted `StaticFiles(directory=static/products)` at `/catalog/static`, so the planned URL `/catalog/static/products/prod-1001.svg` mapped to `static/products/products/prod-1001.svg` and 404'd.
- **Fix:** Changed `STATIC_DIR` to the `static/` parent so the mount serves the whole tree; the `/catalog/static` prefix is unchanged. The planned URL now resolves to `static/products/prod-1001.svg`.
- **Files modified:** `services/catalog-service/app/main.py`
- **Verification:** `test_seeded_svg_served_with_svg_content_type` passes; live curl-style check via TestClient returns 200 + `image/svg+xml`.
- **Committed in:** `016a453` (Task 1)

**2. [Rule 2 - Missing Critical] No public accessor for the products collection**
- **Found during:** Task 1 implementation
- **Issue:** `db._products` was module-private; the seed needed the Plan 01 collection without creating a new Mongo connection.
- **Fix:** Added `products_collection()` public accessor (asserts `connect()` ran) reusing the existing client — satisfies "no new Mongo connection logic".
- **Files modified:** `services/catalog-service/app/db.py`
- **Committed in:** `016a453` (Task 1)

---

**Total deviations:** 2 auto-fixed (1 bug in static mount root alignment, 1 missing accessor enabling the plan's seed contract). Both are within plan scope and required for CAT-05; no scope creep.

## Issues Encountered

- `uv` is not installed on the host. Ran the suite via the pre-existing `services/catalog-service/.venv` (deps confirmed present: pymongo, fastapi, pytest, testcontainers, httpx) against a `mongo:8.0` testcontainers container (Docker available). No source change required.
- `git add` emitted CRLF→LF normalization warnings for the generated SVGs (Windows host); SVGs are text and normalize cleanly to LF on commit — harmless.

## User Setup Required

None - no external service configuration required. The root `.env` supplies `JWT_SECRET`/`MONGO_URI`; `python -m scripts.seed` runs against the configured Mongo (the Compose `catalog-service` entry can call it at startup or manually via `docker compose exec`).

## Next Phase Readiness

- Catalog is now a deterministic, idempotently-seeded 20-product fixture with stable ids/names/prices and served placeholder images. Ready for **03-04** (JWT self-verify + admin CRUD, which reuses `products_collection()` and the seed shape) and downstream phases: cart (04) validates product IDs/prices against these, order (05) snapshots prices, frontend (08) renders names/prices/images, and the gateway (07) proxies `/catalog/**` (including `/catalog/static`) with no new route.

---
*Phase: 03-catalog-service*
*Completed: 2026-08-27*

## Self-Check: PASSED

- 20 SVGs exist under `static/products/` (verified individually: `prod-1001.svg`..`prod-1020.svg`).
- `scripts/seed.py`, `scripts/gen_placeholders.py`, `scripts/__init__.py` present.
- `tests/test_seed.py` present and green: 4 passed (20-count, idempotency, static 200+svg, root-relative imageUrl).
- Full catalog suite green: 24 passed (no regression from `db.py`/`main.py` changes).
- Live idempotency verified against real `mongo:8.0`: ran seed twice → COUNT=20, `createdAt` preserved (`2026-08-24T12:00:00.000Z`), `imageUrl=/catalog/static/products/prod-1001.svg`.
- Task commits present: `016a453` (feat), `4972e16` (test).
- CAT-05 marked complete in REQUIREMENTS.md; ROADMAP plan 03-03 + Phase 3 progress updated.
