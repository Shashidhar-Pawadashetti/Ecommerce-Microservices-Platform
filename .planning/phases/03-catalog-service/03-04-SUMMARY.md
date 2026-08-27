---
phase: 03-catalog-service
plan: 04
subsystem: api
tags: [fastapi, pymongo, mongodb, catalog, jwt, hs256, admin-crud, cat-06, tdd]

# Dependency graph
requires:
  - phase: 03-01
    provides: require_auth dependency in app/security.py + db.connect/get_product + StaticFiles mount
  - phase: 03-02
    provides: hardened listProducts read path (no regression to public reads)
  - phase: 03-03
    provides: products_collection() accessor + seeded 20-product fixture + static SVG serving
provides:
  - JWT-self-verifying admin CRUD (createProduct/updateProduct/deleteProduct) on the catalog, default-deny
  - Proof that mutating routes refuse requests without a valid HS256 bearer token, pre-gateway
  - The catalog as the third JWT_SECRET holder (defense-in-depth, documented deviation)
affects:
  - 07 (gateway proxies /catalog/**; catalog's self-verify remains as defense-in-depth behind the gateway)
  - 04/05/08 (later phases consume the catalog; admin mutation surface now exists for seeding/scripting)

# Actuals (#2632) — chars/4 over the realized diff (git diff 85894b7..HEAD on services/catalog-service)
actuals:
  tokens: 3209
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Mutating routes attach dependencies=[Depends(require_auth)] + openapi_extra security bearerAuth (default-deny; T-03-01)
    - require_auth pins algorithms=["HS256"], base64-decodes JWT_SECRET, validates iss=ecommerce-auth/aud=ecommerce-api/exp(±60s leeway), one byte-identical 401 envelope (T-03-02/04)
    - ProductWrite mass-assignment guard: server generates string id + createdAt; body cannot set them (T-03-05)
    - db.py create_product/update_product/delete_product helpers (last-writer-wins update; distinct generated ids avoid collisions)

key-files:
  created:
    - services/catalog-service/tests/test_admin.py
  modified:
    - services/catalog-service/app/security.py
    - services/catalog-service/app/routes.py
    - services/catalog-service/app/db.py
    - services/catalog-service/README.md

key-decisions:
  - "Accepted the catalog as the THIRD JWT_SECRET holder (with auth-service and the gateway): the api-gateway does not exist until Phase 7 but the CAT-06 contract mandates 401 on invalid tokens in Phase 3, so the catalog self-verifies HS256 in-process. This is a one-way architectural deviation, retained as defense-in-depth even after the gateway exists, and is documented in README now + slated for docs/runbook.md (DOCS-02, Phase 10)."
  - "leeway=60 on jwt.decode honors the contracted ±60s exp clock skew (docs/json-interop.md § JWT Claims); verification still pins alg HS256 and rejects none/RS-HS swaps before signature checks."

requirements-completed: [CAT-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "CAT-06 auth refusal: POST/PUT/DELETE /catalog/products require a valid HS256 bearer token; missing/expired/foreign-signed/alg-swapped/alg-none/tampered tokens all return 401 with the byte-identical UNAUTHORIZED envelope."
    requirement: CAT-06
    verification:
      - kind: unit
        ref: "tests/test_admin.py::test_create_requires_auth, test_invalid_token_401"
        status: pass
    human_judgment: false
  - id: D2
    description: "CAT-06 admin CRUD success + envelopes: valid token -> 201 (create)/200 (update)/204 (delete); unknown id -> 404 NOT_FOUND; malformed body (negative priceCents) -> 400 VALIDATION_FAILED."
    requirement: CAT-06
    verification:
      - kind: unit
        ref: "tests/test_admin.py::test_create_valid, test_update_valid_then_delete, test_update_unknown_404, test_delete_unknown_404, test_bad_body_400"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-27
status: complete
---

# Phase 03 Plan 04: Catalog Service JWT-Protected Admin CRUD Summary

**Catalog self-verifies HS256 bearer tokens and exposes create/update/delete product admin routes (default-deny), proving refused-without-auth in Phase 3 before the api-gateway exists. CAT-06 satisfied.**

## Performance

- **Duration:** ~35 min (read plan/contracts + finalize require_auth + admin routes + tests + run suite)
- **Started:** 2026-08-27
- **Completed:** 2026-08-27
- **Tasks:** 3 (1 decision gate auto-approved per autonomous objective + 2 auto tasks)
- **Files modified:** 5

## Accomplishments

- **Finalized JWT self-verification in `require_auth`** (defined Plan 01): `jwt.decode` already base64-decoded `JWT_SECRET` and pinned `algorithms=["HS256"]` with `iss=ecommerce-auth`/`aud=ecommerce-api`; added `leeway=60` so the contracted ±60s exp skew is accepted, and documented that every `PyJWTError` (missing/expired/wrong-claims/alg-swap/foreign-signature) raises one byte-identical `401` UNAUTHORIZED envelope (anti-enumeration, T-03-04).
- **Implemented admin CRUD** (`createProduct`/`updateProduct`/`deleteProduct`) in `routes.py`: each route attaches `dependencies=[Depends(require_auth)]` and declares `openapi_extra={"security": [{"bearerAuth": []}]}` so Swagger shows the lock and `check-contracts.sh` sees the scheme (T-03-01 default-deny). Responses: 201 Product on create, 200 Product on update, 204 on delete; 404 NOT_FOUND for unknown id; Pydantic returns 400 VALIDATION_FAILED on a malformed body.
- **Mass-assignment guard** (`T-03-05`): `ProductWrite` excludes `id`/`createdAt`; the server generates a string id (`prod-<12 hex chars>`) and `createdAt` (3-digit-ms ISO per Rule 1). Body can never set them.
- **DB helpers** in `db.py`: `create_product`/`update_product`/`delete_product` (last-writer-wins on update; distinct generated ids so concurrent creates never collide — the CAT-06 concurrency edge case from the plan's flagged assumptions is acceptable for v1).
- **Tests** `tests/test_admin.py` (CAT-06): covers auth refusal (missing + 5 invalid-token variants), successful CRUD, unknown-id 404, and bad-body 400, with byte-exact envelope assertions. Full catalog suite green: **31 passed**.
- **Documented the 3rd-JWT-holder deviation** in `README.md` (the auto-approved decision gate): why catalog self-verifies pre-gateway, that it stays defense-in-depth post-Phase-7, that the secret is gitignored and never logged, and that the canonical deviation note is slated for `docs/runbook.md` (DOCS-02, Phase 10).

## Task Commits

Each task was committed atomically:

1. **Decision gate (auto-approved) + Task 1: finalize require_auth + document 3rd-JWT-holder deviation** - `563e8c9` (feat)
2. **Task 2 (feat): admin CRUD routes + DB helpers** - `213ff77` (feat)
3. **Task 2 (test): CAT-06 admin tests** - `e2d7500` (test)

_Plan metadata commit follows this summary._

## Files Created/Modified

- `services/catalog-service/app/security.py` — `require_auth` adds `leeway=60` for exp; one byte-identical 401 envelope for all auth failures.
- `services/catalog-service/app/routes.py` — `createProduct`/`updateProduct`/`deleteProduct` with `Depends(require_auth)` + `bearerAuth` security.
- `services/catalog-service/app/db.py` — `create_product`/`update_product`/`delete_product` helpers.
- `services/catalog-service/tests/test_admin.py` — CAT-06 auth-refusal + CRUD + envelope tests.
- `services/catalog-service/README.md` — documents the 3rd-JWT-holder deviation; adds admin routes to the endpoint table.

## Decisions Made

- **Catalog is the third JWT_SECRET holder** (accepted per the autonomous objective overriding the plan's blocking checkpoint): the api-gateway is built in Phase 7 but CAT-06 mandates 401-on-invalid in Phase 3, so the catalog self-verifies HS256 in-process. One-way, documented, retained as defense-in-depth post-Phase-7.
- **`leeway=60`** on `jwt.decode` honors the ±60s exp skew from `docs/json-interop.md`; verification still pins `alg=HS256` and rejects `none`/RS-HS swaps before signature checks.
- **No new Mongo connection logic**: admin CRUD reuses Plan 01's `db` connection via `products_collection()`/`_products`.

## Deviations from Plan

None that contradict the plan. The single architectural decision in the plan (catalog as 3rd JWT holder) was the plan's own `checkpoint:decision` gate; per the runtime objective ("complete it fully, autonomous, no checkpoints") it was auto-approved and documented in `README.md`, not hidden. No unplanned auto-fixes were required — `require_auth` was already present and correct from Plan 01; the only change was the additive `leeway=60`.

## Issues Encountered

- `uv` was not on PATH; invoked via its user-install location (`$APPDATA/Python/Python314/Scripts/uv.exe`) and `uv sync` resolved the exact-pinned deps into `services/catalog-service/.venv` (gitignored). Tests ran against a `mongo:8.0` testcontainers container (Docker available, 29.4.0).
- The `InsecureKeyLengthWarning` surfaced in `test_invalid_token_401` is the HS384 forged-token case (key length for SHA384) — it is the *rejected* token, so it confirms the alg pin works; harmless.

## User Setup Required

None - no external service configuration required. The root `.env` supplies `JWT_SECRET`/`MONGO_URI`; admin calls need a valid `auth-service`-issued HS256 token (sub/email/roles, iss=ecommerce-auth, aud=ecommerce-api).

## Next Phase Readiness

- Catalog now has a complete, JWT-protected admin mutation surface (CAT-06) with public reads untouched and `/catalog/static` SVGs still serving (Plan 03-03 preserved). Ready for 03-verify and downstream phases: the gateway (07) proxies `/catalog/**` and catalog self-verify remains defense-in-depth; cart (04)/order (05)/frontend (08) consume the seeded product truth.

---
*Phase: 03-catalog-service*
*Completed: 2026-08-27*

## Self-Check: PASSED

- `services/catalog-service/app/security.py` present; `require_auth` pins HS256, base64-decodes secret, validates iss/aud, `leeway=60` added.
- `services/catalog-service/app/routes.py` has createProduct/updateProduct/deleteProduct, each `Depends(require_auth)` + `bearerAuth` security.
- `services/catalog-service/tests/test_admin.py` present and green (8 admin tests; full suite 31 passed).
- `services/catalog-service/README.md` documents the 3rd-JWT-holder deviation.
- Task commits present: `563e8c9` (feat), `213ff77` (feat), `e2d7500` (test).
- CAT-06 marked complete in REQUIREMENTS.md; ROADMAP plan 03-04 + Phase 3 progress updated.
- Public read paths (listProducts/getProduct/batchGetProducts) verified unchanged: full suite green, no regression.
