---
phase: 04-cart-service
plan: 02
subsystem: api
tags: [cart, express, redis, jwt, openapi, routes]

# Dependency graph
requires:
  - phase: 04-cart-service
    provides: 04-01 tracer routes (POST/GET /cart) + cartStore.readCart/addItem + verifyBearer + batchPrice + buildCartView
affects:
  - 04-03 (adds cartStore.updateQty/removeItem/clearCart behind this route layer)
  - 04-04 (adds automated tests for the routes delivered here)
  - 07-gateway (must exclude GET /cart/:userId from the gateway route table)

# Actuals (#2632)
actuals:
  tokens: 2683
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route layer imports cartStore as a NAMESPACE so modules link before 04-03 adds updateQty/removeItem/clearCart (missing named exports defer to call time, keeping tracer routes live in parallel wave)"
    - "Domain errors thrown in routes, mapped centrally in errorHandler to the uniform {code,message} envelope (T-04-04)"
    - "404 discrimination order: catalog batch validity check BEFORE line-presence check (Pitfall 5)"

key-files:
  created:
    - services/cart-service/src/routes/internal.js
  modified:
    - services/cart-service/src/routes/cart.js
    - services/cart-service/src/errors.js
    - services/cart-service/src/app.js

key-decisions:
  - "Store imported as a namespace (not named exports) so the route layer links cleanly while 04-03 adds the mutation functions in parallel; calls by contract."
  - "Routes throw domain errors (UnknownProduct/LineNotInCart/NotFound/ValidationError); the central errorHandler renders the envelope — never scattered literals, never internals."
  - "PATCH is the sole absolute quantity-setter (D-04); quantity < 1 rejected with VALIDATION_FAILED; removal is DELETE-only."

patterns-established:
  - "Centralized error envelope mapping in errorHandler (4-arg Express tail); one byte-identical shape across all failures."
  - "Network-internal edge mounted at '/' so full path is /cart/:userId (D-02 singular spelling); still token-gated."

requirements-completed:
  - CART-02
  - CART-03

coverage:
  - id: D1
    description: "Mutation CRUD — PATCH /cart/items/:productId (absolute qty), DELETE /cart/items/:productId (idempotent), DELETE /cart (clear) with 404 discrimination and server-side totals"
    requirement: CART-02
    verification:
      - kind: integration
        ref: "interim supertest 04-02-tmp (14 assertions): route registration, 401 auth-gating on all new paths, 400 VALIDATION_FAILED for quantity 0/missing/float, and errorHandler mapping for UnknownProduct/LineNotInCart/NotFound/ValidationError/CatalogUnavailable — all pass"
        status: pass
    human_judgment: true
    rationale: "Full success-path behavior (live-priced totals via catalog, UNKNOWN_PRODUCT vs LINE_NOT_IN_CART against a real catalog, idempotent 204 clears) and 404 NOT_FOUND for absent carts require 04-03's store functions (updateQty/removeItem/clearCart) and a running catalog/redis stack. Plan 04-04 owns the automated tests; interim docker-compose verify is described in the plan. Route wiring, auth, validation, and envelope mapping are proven."
  - id: D2
    description: "Network-internal checkout snapshot GET /cart/:userId — priced CartView, 404 NOT_FOUND when no live cart, 401 without token"
    requirement: CART-03
    verification:
      - kind: integration
        ref: "interim supertest 04-02-tmp: GET /cart/:userId unauthenticated -> 401 (proves route registered + auth-gated); errorHandler maps NotFound -> 404 NOT_FOUND (unit-verified)"
        status: pass
    human_judgment: true
    rationale: "200 priced-view and 404 NOT_FOUND-for-absent-cart success paths require a populated cart (needs 04-03 store functions) and a running catalog for batch pricing; plan 04-04 owns the automated tests."

# Metrics
duration: 11min
completed: 2026-08-27
status: complete
---

# Phase 04 Plan 02: Cart Route Expansion (PATCH/DELETE mutation CRUD + internal checkout snapshot) Summary

**Express 5 cart route layer: PATCH/DELETE item + DELETE cart with correct 404 discrimination (UNKNOWN_PRODUCT before LINE_NOT_IN_CART), plus network-internal GET /cart/:userId, all totals server-side from live catalog and rendered through a uniform error envelope.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-27T12:26:54Z
- **Completed:** 2026-08-27T12:38:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended `routes/cart.js` with PATCH /cart/items/:productId (absolute quantity; 400 VALIDATION_FAILED for qty<1; 404 discrimination: UNKNOWN_PRODUCT when absent from catalog, LINE_NOT_IN_CART when not in cart), DELETE /cart/items/:productId (idempotent 204), and DELETE /cart (idempotent 204, resets TTL).
- Created `routes/internal.js` with GET /cart/:userId (mounted at '/' → full path /cart/:userId, singular per D-02), token-gated, returning the priced CartView or 404 NOT_FOUND for an absent cart.
- Added `LineNotInCart` and `NotFound` error classes; the central `errorHandler` now maps UnknownProduct / LineNotInCart / NotFound / ValidationError / CatalogUnavailable to the uniform {code,message} envelope (else 500 INTERNAL_ERROR), logging raw errors server-side only (T-04-04, never leaks internals).
- Registered `internalRouter` in `app.js` without changing the error-handler tail.

## Task Commits

Each task was committed atomically:

1. **Task 1: Full cart mutation CRUD with 404 discrimination** — `47da732` (feat)
2. **Task 2: Network-internal checkout snapshot GET /cart/:userId** — included in `47da732` (feat)

**Plan metadata:** `47da732` (feat: route expansion)

## Files Created/Modified
- `services/cart-service/src/routes/cart.js` - PATCH/DELETE item + DELETE cart mutations added; tracer POST/GET preserved; store imported as namespace.
- `services/cart-service/src/routes/internal.js` - New: GET /cart/:userId internal checkout snapshot.
- `services/cart-service/src/errors.js` - Added `LineNotInCart` and `NotFound` classes; `errorHandler` maps all five domain classes.
- `services/cart-service/src/app.js` - Registered `internalRouter`; 404 fallback and error-handler tail unchanged.

## Decisions Made
- Imported cartStore as a NAMESPACE (not named exports) so this route layer links even before 04-03 adds `updateQty`/`removeItem`/`clearCart` — missing exports resolve at call time, keeping the tracer routes live while both wave-2 plans run in parallel. The route layer still calls those functions strictly by contract.
- Routes THROW domain errors; the central `errorHandler` renders the envelope. This centralizes the shared {code,message} shape and guarantees no internal leakage (T-04-04), rather than scattering `sendError` literals.
- PATCH is the sole absolute quantity-setter (decision D-04); quantity < 1 is rejected with VALIDATION_FAILED, so removal stays DELETE-only.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `updateQty`/`removeItem`/`clearCart` are not yet present in `cartStore.js` (owned by parallel plan 04-03). Handled by design: the store is imported as a namespace so the module links and the tracer routes remain functional; the mutation routes call those functions by contract and will resolve once 04-03 lands. Feasibility verification therefore covers route registration, auth-gating, quantity validation, and error-handler mapping (all of which execute before any store/catalog call); the success-path/totals/404-discrimination behaviors against a real catalog require 04-03 + running dependencies and are owned by 04-04's automated tests.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Route surface for CART-02/CART-03 is complete and contract-aligned; ready for 04-03 to harden the store (TTL/persistence) behind these exact function signatures, and for 04-04 to add automated tests.
- Reminder for Phase 7: GET /cart/:userId must be excluded from the api-gateway route table (network-internal only).

---
*Phase: 04-cart-service*
*Completed: 2026-08-27*
