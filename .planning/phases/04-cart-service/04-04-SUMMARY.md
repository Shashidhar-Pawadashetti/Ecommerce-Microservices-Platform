---
phase: 04-cart-service
plan: 04
subsystem: testing
tags: [node-test, supertest, ioredis-mock, cart, jwt, express5]

# Dependency graph
requires:
  - phase: 04-cart-service 04-02
    provides: cart routes (POST/GET/PATCH/DELETE /cart*) + internal GET /cart/:userId
  - phase: 04-cart-service 04-03
    provides: cartStore (ioredis) + config + totals + catalogClient + verifyToken
provides:
  - container-free automated test suite proving CART-01..04
  - ioredis→ioredis-mock alias loader (RUN_REDIS_TTL-gated) for node:test
  - conftest harness: HS256 JWT minting + fetch-intercepted fake catalog
affects: [05-order-service, 07-api-gateway]

# Actuals (#2632) — chars/4 over the realized diff (this test commit only).
actuals:
  tokens: 8902
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: [supertest@7.2.2, ioredis-mock@8.13.1, node:test (built-in), ESM resolve loader]
  patterns:
    - container-free logic suite via ioredis→ioredis-mock alias at module resolution
    - fake catalog via global fetch interception (unknown ids omitted, mirrors contract)
    - JWT minting reusing the service's base64-decoded secret bytes + iss/aud
patterns-established:
  - "test(cart,XX): alias ioredis for unit tests, real redis only under RUN_REDIS_TTL=1"
  - "conftest seeds catalog + tokens; never hit a real catalog-service in logic tests"

key-files:
  created:
    - services/cart-service/tests/_env.js
    - services/cart-service/tests/_loader.mjs
    - services/cart-service/tests/loader-register.mjs
    - services/cart-service/tests/conftest.js
    - services/cart-service/tests/test_auth.js
    - services/cart-service/tests/test_add.js
    - services/cart-service/tests/test_update_remove.js
    - services/cart-service/tests/test_totals.js
    - services/cart-service/tests/test_persist.js
    - services/cart-service/tests/test_internal.js
    - services/cart-service/tests/test_ttl.js
  modified:
    - services/cart-service/package.json
    - services/cart-service/README.md

key-decisions:
  - "List test files explicitly in the `test` script and gate ioredis via a resolve loader, because `node --test` does not discover underscore-named files (test_auth.js) and cannot swap ioredis without a loader."
  - "Swap ioredis→ioredis-mock only when RUN_REDIS_TTL is unset; the CART-04 TTL test uses a real Redis because ioredis-mock TTL eviction is unreliable (research Assumption A5)."
  - "Serve the catalog from an in-memory fake via global fetch interception rather than modifying catalogClient, so logic tests never depend on a running catalog-service."

requirements-completed: [CART-01, CART-02, CART-03, CART-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Auth enforcement (T-04-01): every protected route returns 401 UNAUTHORIZED without a token and with expired/foreign-signature tokens, single envelope."
    requirement: CART-01
    verification:
      - kind: unit
        ref: "services/cart-service/tests/test_auth.js#T-04-01 GET /cart -> 401 UNAUTHORIZED (missing token)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Add validation (CART-01): known product adds with correct grand total; unknown product -> UNKNOWN_PRODUCT 404; quantity 0 / missing productId -> VALIDATION_FAILED 400."
    requirement: CART-01
    verification:
      - kind: unit
        ref: "services/cart-service/tests/test_add.js#CART-01 POST /cart/items adds known product and returns priced cart"
        status: pass
    human_judgment: false
  - id: D3
    description: "Update/remove semantics (CART-02): PATCH absolute qty; DELETE idempotent 204; 404 discrimination LINE_NOT_IN_CART vs UNKNOWN_PRODUCT."
    requirement: CART-02
    verification:
      - kind: unit
        ref: "services/cart-service/tests/test_update_remove.js#CART-02 PATCH a catalog-known product not in cart -> 404 LINE_NOT_IN_CART"
        status: pass
    human_judgment: false
  - id: D4
    description: "Server-side totals (T-04-02): returned unit/line/grand equal live catalog priceCents; client-injected price fields ignored; integer-cents math; empty cart grandTotal 0."
    requirement: CART-02
    verification:
      - kind: unit
        ref: "services/cart-service/tests/test_totals.js#T-04-02 totals equal quantity * live catalog priceCents across multiple lines"
        status: pass
    human_judgment: false
  - id: D5
    description: "Persistence (CART-03): cart key cart:{userId} exists in Redis after add, readCart returns the line, clear empties the blob."
    requirement: CART-03
    verification:
      - kind: unit
        ref: "services/cart-service/tests/test_persist.js#CART-03 Redis key cart:{sub} exists after add (ioredis-mock)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Internal checkout read GET /cart/:userId (CART-03): 200 priced CartView when populated, 404 NOT_FOUND when no live cart, 401 without token."
    requirement: CART-03
    verification:
      - kind: unit
        ref: "services/cart-service/tests/test_internal.js#CART-03 internal GET /cart/{userId} with populated cart -> 200 priced CartView"
        status: pass
    human_judgment: false
  - id: D7
    description: "Observable TTL expiry (CART-04): with RUN_REDIS_TTL=1 against real Redis, key present after add with positive TTL, mutation resets TTL, after the window the key is gone and GET /cart returns empty items."
    requirement: CART-04
    verification:
      - kind: integration
        ref: "RUN_REDIS_TTL=1 CART_TTL_SECONDS=2 REDIS_URL=redis://localhost:6379/1 node --import ./tests/loader-register.mjs --test tests/test_ttl.js"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-27
status: complete
---

# Phase 04 Plan 04: Cart Service Test Suite Summary

**Container-free `node:test` + supertest suite (42 logic tests) proving CART-01..04, with a real-Redis-gated TTL test (CART-04), via an ioredis→ioredis-mock alias loader and a fetch-intercepted fake catalog.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-27T12:00:00Z
- **Completed:** 2026-08-27T12:35:00Z
- **Tasks:** 2
- **Files modified:** 13 (11 new test files + package.json + README)

## Accomplishments
- 42 container-free logic tests covering auth (T-04-01), add/validation (CART-01), update/remove + 404 discrimination (CART-02), server-side totals (T-04-02), persistence (CART-03), and internal checkout read.
- Real-Redis TTL test (CART-04) validated live (key present → TTL reset on mutation → gone after window, GET /cart empty), gated behind RUN_REDIS_TTL=1 so the default run stays green and container-free.
- Test harness (conftest) mints HS256 JWTs with the service's base64-decoded secret and intercepts fetch to serve an in-memory catalog (unknown ids omitted), so no catalog-service or Redis container is needed for the logic suite.

## Task Commits

1. **Task 1: Logic harness + auth/add/update/totals/persist/internal tests** - `10c536b` (test)
2. **Task 2: Observable TTL test (real Redis) + README Testing section** - included in `10c536b` (test)

**Plan metadata:** `10c536b` (test: complete plan)

## Files Created/Modified
- `services/cart-service/tests/_env.js` - fixes JWT_SECRET before config loads so minted tokens verify
- `services/cart-service/tests/_loader.mjs` - ESM resolve hook aliasing `ioredis`→`ioredis-mock` unless RUN_REDIS_TTL=1
- `services/cart-service/tests/loader-register.mjs` - registers the loader via `--import`
- `services/cart-service/tests/conftest.js` - supertest agent, JWT helpers, fake-catalog fetch interception, store helpers
- `services/cart-service/tests/test_auth.js` - T-04-01 401 on every protected route
- `services/cart-service/tests/test_add.js` - CART-01 add + UNKNOWN_PRODUCT + VALIDATION_FAILED
- `services/cart-service/tests/test_update_remove.js` - CART-02 PATCH/DELETE, LINE_NOT_IN_CART vs UNKNOWN_PRODUCT
- `services/cart-service/tests/test_totals.js` - T-04-02 server-side totals, ignored injected prices, integer cents, empty cart 0
- `services/cart-service/tests/test_persist.js` - CART-03 cart:{userId} key persists
- `services/cart-service/tests/test_internal.js` - CART-03 internal GET /cart/:userId 200/404/401
- `services/cart-service/tests/test_ttl.js` - CART-04 observable expiry (real Redis, skipped by default)
- `services/cart-service/package.json` - `test` script wires `--import ./tests/loader-register.mjs --test <files>`
- `services/cart-service/README.md` - Testing section (container-free default + real-Redis TTL run)

## Decisions Made
- Explicitly listed the underscore-named test files in the `test` script (and used an ESM resolve loader for ioredis) because `node --test` only auto-discovers hyphenated `test-*.js`/`*-test.js` names — `test_auth.js` would otherwise be silently skipped.
- Used a module-resolution loader to swap ioredis for ioredis-mock rather than modifying `cartStore.js`; the alias is disabled under RUN_REDIS_TTL=1 so the TTL test exercises a real Redis (per research Assumption A5).
- Seeded the catalog by intercepting `globalThis.fetch` (unknown ids omitted) instead of editing `catalogClient.js`, keeping logic tests independent of a running catalog-service.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two test assertions were wrong, not source bugs**
- **Found during:** Task 1 (running the logic suite)
- **Issue:** (a) `test_persist` asserted the cart key is *deleted* after `DELETE /cart`, but `clearCart` rewrites the blob as `[]` (key persists, empty) — so `exists` returned 1. (b) `test_totals` integer-cents check probed `res.body.unitPriceCents`/`lineTotalCents` at the CartView top level where only `grandTotalCents` exists.
- **Fix:** Rewrote the persist assertion to expect an empty `[]` blob with the key still present; narrowed the integer-cents loop to line-level fields plus a single `grandTotalCents` top-level check.
- **Files modified:** services/cart-service/tests/test_persist.js, services/cart-service/tests/test_totals.js
- **Verification:** Full suite green (42 pass, exit 0).
- **Committed in:** `10c536b`

**2. [Rule 2 - Missing Critical] Test script needed to actually discover the test files**
- **Found during:** Task 1 (probe before writing)
- **Issue:** `node --test` (the plan's literal `test` script) does not discover `test_auth.js`-style underscore names, so `npm test` would have reported 0 tests and silently looked green.
- **Fix:** Set `test` to `node --import ./tests/loader-register.mjs --test tests/test_auth.js tests/test_add.js tests/test_update_remove.js tests/test_totals.js tests/test_persist.js tests/test_internal.js tests/test_ttl.js`.
- **Files modified:** services/cart-service/package.json
- **Verification:** `npm test` runs and reports 42 passing tests, exit 0.
- **Committed in:** `10c536b`

---

**Total deviations:** 2 (1 bug auto-fix, 1 missing-critical auto-fix)
**Impact on plan:** Both deviations are in the test code itself (not the service source, which was untouched per the rule). They were required for a genuinely green, non-empty suite. No scope creep.

## Issues Encountered
- `node --test` discovery gap for underscore filenames — resolved by explicit file listing in the `test` script.
- Both original test assertions failed on first run; root-caused to incorrect expectations (source behavior was correct) and fixed.

## User Setup Required
None - no external service configuration required. Logic suite is container-free; the TTL test only needs an opt-in `RUN_REDIS_TTL=1` with a reachable Redis.

## Next Phase Readiness
- Cart Service now has automated coverage for all four CART requirements, serving as the phase-exit gate.
- `test_internal.js` (GET /cart/:userId) is verified and ready for order-service (Phase 5) to consume the checkout snapshot.

## Self-Check: PASSED

- All 11 test files + `_env.js`/`_loader.mjs`/`loader-register.mjs` exist.
- All 4 CART requirements have passing coverage (42 logic tests, exit 0; CART-04 TTL test validated live against real Redis under RUN_REDIS_TTL=1).
- Commits `10c536b` (test) and `d0a8d00` (docs summary) both present.

---
*Phase: 04-cart-service*
*Completed: 2026-08-27*
