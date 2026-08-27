---
phase: 04-cart-service
plan: 03
subsystem: database
tags: [redis, ioredis, ttl, jwt, cart, express]

# Dependency graph
requires:
  - phase: 04-01
    provides: tracer cartStore.js (addItem) + config.js + errors.js to consolidate/harden
  - phase: 04-02
    provides: route layer that consumes addItem/updateQty/removeItem/clearCart/readCart signatures
provides:
  - single writeCart() TTL-refresh chokepoint on every mutation (CART-03/04 storage layer)
  - readTtl()/readUpdatedAt() observable-expiry readers (CART-04)
  - validated CART_TTL_SECONDS binding + JWT secret byte-length assertion (fail-fast)
  - documented Phase-4 JWT self-verify deviation (mirrors catalog DOCS-02)
affects: [04-04 (tests assert persistence + TTL), 07 (gateway becomes sole JWT verifier)]

# Actuals (#2632) — pairs with plan estimate tokens: 35000 (chars/4 over realized diff)
actuals:
  tokens: 3066
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single writeCart() chokepoint: every cart mutation routes through it and always passes EX (TTL) — guaranteed per-mutation expiry refresh."
    - "Reads (readCart) never touch TTL so abandoned carts age out; readTtl() surfaces remaining seconds for tests."
    - "Fail-fast env validation at module load: invalid CART_TTL_SECONDS or undersized JWT_SECRET refuses to boot; secret value never logged (length only)."

key-files:
  created:
    - services/cart-service/README.md
  modified:
    - services/cart-service/src/store/cartStore.js
    - services/cart-service/src/config.js

key-decisions:
  - "updateQty on a missing line is no-op-safe (TTL still refreshed); the 04-02 route guards and returns LINE_NOT_IN_CART before calling, so the store never fabricates a line."
  - "removeItem/clearCart are idempotent: removing an absent line or clearing an empty cart still rewrites the blob and resets the TTL."
  - "JWT_SECRET default matches catalog-service so the two transitional self-verifiers agree out-of-the-box; Phase-7 gateway becomes sole verifier (reversible deletion)."

patterns-established:
  - "writeCart is the ONLY writer and always carries EX CART_TTL_SECONDS — no mutation path may use SET without EX (Pitfall 2 mitigation)."

requirements-completed: [CART-03, CART-04]

coverage:
  - id: D1
    description: "Cart persists under cart:{userId} as JSON blob {items:[{productId,quantity}],updatedAt}; every mutation resets TTL via writeCart chokepoint (CART-03)."
    requirement: CART-03
    verification:
      - kind: integration
        ref: "tests/test_persist.js (plan 04-04) — asserts key cart:{userId} exists after mutation"
        status: unknown
    human_judgment: false
  - id: D2
    description: "CART_TTL_SECONDS configurable (default 1209600); readTtl() exposes remaining seconds; key expires after the window (observable CART-04)."
    requirement: CART-04
    verification:
      - kind: integration
        ref: "tests/test_ttl.js (plan 04-04) — asserts positive TTL after mutation and key disappearance after window"
        status: unknown
    human_judgment: false
  - id: D3
    description: "config.js binds/asserts CART_TTL_SECONDS (int >=1) and JWT secret >=32 decoded bytes; README documents Phase-4 JWT deviation + TTL contract."
    requirement: CART-03
    verification:
      - kind: other
        ref: "node --check + startup load assertion; grep for 'Phase 4' in README and 'CART_TTL_SECONDS' in config.js (Task 2 verify)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-27
status: complete
---

# Phase 04 Plan 03: Store/Config Hardening Summary

**Single writeCart() TTL-refresh chokepoint on every cart mutation, observable-expiry readers, validated CART_TTL_SECONDS, and documented Phase-4 JWT self-verify deviation**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-27T12:00:00Z
- **Completed:** 2026-08-27T12:12:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- All cart mutations (addItem/updateQty/removeItem/clearCart) now route through one `writeCart()` that always passes `EX CART_TTL_SECONDS`, guaranteeing the abandoned-cart expiry window resets on every change (CART-04, Pitfall 2 mitigated).
- Added `readTtl(userId)` (returns remaining seconds; -1 no expire, -2 no key) and `readUpdatedAt(userId)` so observable-expiry tests can assert CART-04 deterministically.
- `config.js` binds and validates `CART_TTL_SECONDS` (integer >= 1, default 1209600 = 14 days) and asserts the JWT secret decodes to >= 32 bytes at startup (fail-fast; logs length only, never the secret).
- `services/cart-service/README.md` created documenting the Phase-4 JWT self-verify deviation (mirrors catalog DOCS-02; gateway becomes sole verifier in Phase 7), the `cart:{userId}` key + per-mutation TTL reset, and the interop contract (integer-cents, ISO-8601 ms UTC, string ids, server-side-only pricing).

## Task Commits

Each task was committed atomically:

1. **Task 1: Centralize TTL refresh + persistence contract in cartStore** - `c547bdb` (feat)
2. **Task 2: Bind + assert CART_TTL_SECONDS and document Phase-4 JWT deviation** - `c547bdb` (feat, same commit)

**Plan metadata:** `c547bdb` (feat: complete plan)

## Files Created/Modified
- `services/cart-service/src/store/cartStore.js` - single writeCart() EX-passthrough; addItem/updateQty/removeItem/clearCart; readTtl/readUpdatedAt readers
- `services/cart-service/src/config.js` - CART_TTL_SECONDS bound + asserted; JWT secret byte-length startup assertion
- `services/cart-service/README.md` - TTL contract + Phase-4 JWT deviation note

## Decisions Made
- updateQty on a missing line is no-op-safe; the 04-02 route returns LINE_NOT_IN_CART before calling, so the store never fabricates a line.
- removeItem/clearCart are idempotent (absent-line removal / empty-clear still rewrite the blob and reset TTL).
- JWT_SECRET default mirrors catalog-service so the two transitional self-verifiers agree; Phase-7 makes the gateway the sole verifier (reversible).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Store/config layer is ready for 04-04 (tests/test_persist.js, tests/test_ttl.js) to assert CART-03/CART-04 against.
- 04-02 routes (separate wave) can consume the stabilized addItem/updateQty/removeItem/clearCart/readCart signatures.
- Phase 7 will remove the cart self-verify middleware and make the gateway the sole JWT verifier.

---
*Phase: 04-cart-service*
*Completed: 2026-08-27*
