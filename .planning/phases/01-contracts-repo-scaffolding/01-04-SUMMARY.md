---
phase: 01-contracts-repo-scaffolding
plan: 04
subsystem: api
tags: [openapi, spectral, contract-first, catalog, cart, jwt, redis-ttl]

requires:
  - phase: 01-contracts-repo-scaffolding plan 02
    provides: docs/api-contracts/_shared.yaml shared components (bearerAuth, Error envelope, reusable 4xx responses, LimitParam/OffsetParam), Spectral ruleset, and scripts/check-contracts.sh gate with existence-guarded stages that assert at full strength once specs land
  - phase: 01-contracts-repo-scaffolding plan 03
    provides: docs/json-interop.md interop law (string IDs, integer-cents money, ISO-8601 ms UTC timestamps, optional-absent nullability) cited and encoded in both specs
provides:
  - "docs/api-contracts/catalog-service.openapi.yaml - complete OpenAPI 3.0.3 contract: exactly seven operations (listProducts, getProduct, batchGetProducts, createProduct, updateProduct, deleteProduct, health); public-read/protected-write GTWY-03 matrix declared per-operation; contractual limit/offset pagination; network-internal batch-pricing edge for cart validation"
  - "docs/api-contracts/cart-service.openapi.yaml - complete OpenAPI 3.0.3 contract: exactly seven operations (getCart, addItem, updateItem, removeItem, clearCart, getCartForUser, health); sub-derived identity (zero userId in request bodies), server-side totals from live catalog prices, quantity floor 1 + DELETE-only removal (D-04), TTL-on-every-mutation semantics, internal checkout read GET /cart/{userId} per D-02"
  - "Frozen trust-boundary classification for Phase 7 gateway transcription: every operation carries an explicit security declaration or inherits the documented public default"
affects: [01-05-orders-kafka-topics, phase-3-catalog-service, cart-phase, phase-6-order-payment, phase-7-gateway]

actuals:
  tokens: 8250          # chars/4 over realized diff (33,001 chars across the two specs); plan estimated 44,000
  tasks: 2
  commits: 2            # task commits 08598a3, 6ab999a (+ this metadata commit)

tech-stack:
  added: []
  patterns:
    - "security declared immediately after operationId/summary on protected operations so mutation-class greps and human readers see bearerAuth without wading through folded descriptions"
    - "Explicit security: [] on public/network-internal operations - zero inference needed when Phase 7 transcribes the route table verbatim"
    - "Service-specific error codes (UNKNOWN_PRODUCT, LINE_NOT_IN_CART) wrapped around the shared _shared.yaml Error schema via local component responses - code vocabulary is service-owned, envelope shape stays single-homed"
    - "Multi-code status responses use named examples under one response object instead of parallel $refs (OpenAPI allows one response per status)"
    - "Interop law encoded mechanically in schemas, never just prose: type integer minimum 0 on all *Cents fields, type string on all IDs, format date-time everywhere"

key-files:
  created:
    - docs/api-contracts/catalog-service.openapi.yaml
    - docs/api-contracts/cart-service.openapi.yaml
    - .planning/phases/01-contracts-repo-scaffolding/01-04-SUMMARY.md
  modified: []

key-decisions:
  - "Batch pricing edge frozen as a pure READ despite the POST verb (ID list travels in the body); unknown IDs silently omitted - absence IS the invalidity signal cart-service consumes in place of a code; upper batch-size bound explicitly deferred to Phase 4 implementation while minItems 1 stays contractual (T-04-04)."
  - "PATCH line-not-found ambiguity resolved per Pitfall 1 (contracts phase resolves, implementers do not): two stable codes discriminate the 404 cause - UNKNOWN_PRODUCT (product absent from catalog) vs LINE_NOT_IN_CART (product real, no such line) - documented with named examples on one response object."
  - "clearCart identity mechanics made coherent with D-identity: order-service invokes DELETE /cart network-internally after checkout by forwarding the SAME user bearer token presented at checkout, so ownership still derives from that sub rather than inventing a body-carried userId."
  - "removeItem idempotence frozen: deleting an absent line returns 204 (end state already holds); 404 UNKNOWN_PRODUCT reserved strictly for catalog-absent identifiers."
  - "getCartForUser documented as the single sanctioned userId-off-token exception: caller is order-service presenting its own credentials; path spelling locked singular (D-02) with the plural /carts variant declared superseded."
  - "imageUrl carries type string with the URI format deliberately undeclared until seed assets land in Phase 3, keeping examples valid without inventing URL constraints."

patterns-established:
  - "Per-operation security matrix as gateway truth: PUBLIC ops declare security: [] explicitly, protected ops declare bearerAuth, NETWORK-INTERNAL edges say so in description plus tags - Phase 7 transcribes this table verbatim"
  - "Response-side-only money: unitPriceCents/lineTotalCents/grandTotalCents appear exclusively in CartView/CartLine/BatchPricingEntry schemas; request schemas structurally cannot carry prices (T-04-02 mitigation by shape, not by prose)"

requirements-completed: [CONTR-01]

coverage:
  - id: D1
    description: "catalog-service.openapi.yaml - seven operations contracted (public browse/search/sort/paginate + detail, admin CRUD secured, network-internal batch pricing edge, health probe) with pagination contractual from birth"
    requirement: CONTR-01
    verification:
      - kind: other
        ref: "command: npx @stoplight/spectral-cli@6.16.3 lint docs/api-contracts/catalog-service.openapi.yaml --ruleset docs/api-contracts/.spectral.yaml --fail-severity=warn -> exit 0, zero findings"
        status: pass
      - kind: other
        ref: "command: bash scripts/check-contracts.sh -> exit 0 with catalog spec in the lint glob at full strength"
        status: pass
      - kind: other
        ref: "command: AC greps - operationId x7, products/batch present, priceCents present, 'type: number|float' x0, bearerAuth within -B2/-A6 of createProduct/updateProduct/deleteProduct x3, hedge words x0"
        status: pass
    human_judgment: false
  - id: D2
    description: "cart-service.openapi.yaml - seven operations contracted encoding D-02/D-04/D-identity/D-totals: sub-derived identity (awk-proven zero userId inside any requestBody block), server-side live-price totals, quantity minimum 1 x3, DELETE-only removal, TTL-on-every-mutation, internal GET /cart/{userId} read"
    requirement: CONTR-01
    verification:
      - kind: other
        ref: "command: npx @stoplight/spectral-cli@6.16.3 lint docs/api-contracts/cart-service.openapi.yaml --ruleset docs/api-contracts/.spectral.yaml --fail-severity=warn -> exit 0, zero findings"
        status: pass
      - kind: other
        ref: "command: bash scripts/check-contracts.sh -> exit 0, Stage 5 now asserts cart spec declares operations"
        status: pass
      - kind: other
        ref: "command: AC greps - operationId x7, 'minimum: 1' x3, TTL present, awk requestBody userId count == 0, 'type: number|float' x0, hedge words x0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Contract sufficiency: Phase 3 (catalog implementation) and the cart phase can build directly against these two specs without follow-up questions"
    requirement: CONTR-01
    verification: []
    human_judgment: true
    rationale: "Lint proves structure and internal consistency; whether the contract text answers every fresh-context implementer question is a reader judgment reserved for phase verify (same split as Plan 02's auth-tracer coverage entry)."

# Metrics
duration: 10min
completed: 2026-08-24
status: complete
---

# Phase 1 Plan 04: Catalog & Cart OpenAPI Contracts Summary

**Two complete OpenAPI 3.0.3 contracts - catalog (public reads / protected writes / internal batch-pricing edge) and cart (sub-derived identity, server-computed live-price totals, DELETE-only removal) - both lint-clean through the warn-fatal Spectral gate on first authoring pass.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-24T17:46:28Z
- **Completed:** 2026-08-24T17:55:50Z
- **Tasks:** 2
- **Files modified:** 2 created (+ this SUMMARY)

## Accomplishments

- Catalog contract authored with EXACTLY seven operations (`listProducts`, `getProduct`, `batchGetProducts`, `createProduct`, `updateProduct`, `deleteProduct`, `health`): browse/search/sort/filter plus contractual `limit`/`offset` pagination (shared `_shared.yaml` params), admin CRUD behind per-operation `bearerAuth`, and the network-internal `POST /catalog/products/batch` pricing edge whose omitted-ID response semantics feed cart validation (CART-01/02)
- Cart contract authored with EXACTLY seven operations (`getCart`, `addItem`, `updateItem`, `removeItem`, `clearCart`, `getCartForUser`, `health`) freezing the platform's first synchronous trust boundary: identity exclusively from JWT sub (zero identity fields in any request body), totals recomputed server-side from LIVE catalog prices, quantity floor of 1, removal DELETE-only with idempotent 204, Redis `cart:{userId}` storage with TTL touched on every mutation (CART-03/04)
- Both internal edges spelled and classified per D-02: cart→catalog batch pricing and order→cart `GET /cart/{userId}` checkout read - singular spelling locked, plural `/carts` variant declared dead, both marked network-internal and excluded from the Phase 7 gateway route table
- Interop law encoded structurally: string IDs everywhere, integer-cents money (`priceCents`/`unitPriceCents`/`lineTotalCents`/`grandTotalCents`, all `minimum: 0`), ISO 8601 ms UTC `date-time` stamps, optional-as-absent nullability, `additionalProperties: true`
- Full gate green with both specs in the lint glob: `bash scripts/check-contracts.sh` exit 0, three specs linting clean, Stage 5 asserting catalog+cart coverage

## Task Commits

Each task was committed atomically:

1. **Task 1: catalog-service.openapi.yaml - public reads, protected writes, batch edge** - `08598a3` (feat)
2. **Task 2: cart-service.openapi.yaml - sub-derived identity, server totals, DELETE-only removal** - `6ab999a` (feat)

**Plan metadata:** committed as the final `docs(01-04)` commit immediately following the task commits.

## Files Created/Modified

- `docs/api-contracts/catalog-service.openapi.yaml` - Catalog contract: Product/ProductList/ProductWrite/BatchPricingRequest/BatchPricingEntry schemas, GTWY-03 access matrix per-operation, stock display-only stance
- `docs/api-contracts/cart-service.openapi.yaml` - Cart contract: AddItem/UpdateQuantity/CartLine/CartView schemas, UNKNOWN_PRODUCT/LINE_NOT_IN_CART local responses wrapping the shared Error schema, frozen-semantics info.description

## Decisions Made

- **Batch edge = pure read despite POST verb:** description states nothing mutates; POST exists so the ID list travels in the body. Unknown IDs are omitted from the 200 array - absence is the invalidity signal (cart treats it exactly like UNKNOWN_PRODUCT). Upper batch-size bound deferred to Phase 4 as an implementation concern; `minItems: 1` is contractual (T-04-04).
- **PATCH 404 ambiguity resolved now (Pitfall 1):** plan said "UNKNOWN_PRODUCT or line-not-in-cart" without naming the second code. Froze `LINE_NOT_IN_CART`; both codes taught via named examples on one response object (OpenAPI permits a single response object per status, so parallel $refs were not an option).
- **clearCart × D-identity coherence:** order-service clears the shopper's cart after checkout by forwarding the SAME user bearer token presented at checkout - ownership still derives from sub, no body-carried userId invented.
- **Idempotent removeItem:** deleting an absent line returns 204; 404 is reserved for catalog-absent identifiers.
- **getCartForUser exception scoped narrowly:** the one place userId travels off-token, justified by its service-caller nature, restricted to the compose network, and excluded from gateway routing.
- **Security declarations placed immediately after summary** on every operation (explicit `bearerAuth` or explicit `security: []`) so the matrix is transcribable verbatim and survives mechanical greps despite multi-line folded descriptions.
- **Unused-component pre-fix:** a draft `LineNotInCart` component response would have been orphaned once PATCH documented both 404 codes inline; removed before linting since `oas3-unused-component` warns at gate-fatal severity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Declared 401 Unauthorized on every protected operation**
- **Found during:** Tasks 1-2 (contract authoring)
- **Issue:** Plan listed success/error codes per operation but omitted 401 on bearerAuth-protected mutations and cart reads, even though `_shared.yaml` ships the reusable `Unauthorized` response and missing/expired credentials are the most common failure class on those endpoints (happy-path-only specs are this phase's own Pitfall 3).
- **Fix:** Added `'401': $ref Unauthorized` to createProduct, updateProduct, deleteProduct, getCart, addItem, updateItem, removeItem, clearCart, and getCartForUser; added the missing `'400' ValidationError` to updateProduct (it accepts the same validatable ProductWrite body as createProduct).
- **Files modified:** docs/api-contracts/catalog-service.openapi.yaml, docs/api-contracts/cart-service.openapi.yaml
- **Verification:** Spectral lint exit 0 both files; full gate exit 0
- **Committed in:** 08598a3 (Task 1), 6ab999a (Task 2)

---

**Total deviations:** 1 auto-fixed (missing error-handling documentation)
**Impact on plan:** No scope creep - additive response declarations only; every plan-listed status code and semantic landed exactly as specified.

## Issues Encountered

- None blocking. First Spectral run on each file reported zero findings at `--fail-severity=warn`; the one pre-lint self-review catch (orphaned component response) was fixed before invoking the linter.

## Verification Evidence

| Check | Result |
|-------|--------|
| Spectral lint catalog spec (--fail-severity=warn) | exit 0, zero findings |
| Spectral lint cart spec (--fail-severity=warn) | exit 0, zero findings |
| `bash scripts/check-contracts.sh` post-Task-2 (3 specs) | exit 0 |
| Catalog: operationId count / products/batch / priceCents / `type: number\|float` | 7 / present / present / 0 |
| Catalog: bearerAuth within `-B2 -A6` of create/update/deleteProduct | 1 / 1 / 1 |
| Cart: operationId count / `minimum: 1` count / TTL grep | 7 / 3 / present |
| Cart: `awk '/requestBody/,/^      (get\|post\|patch\|delete\|responses)/' \| grep -c userId` | 0 |
| Prohibitions: float money types / hedge words TBD-probably-maybe | 0 / none |

## Known Stubs

None. Both contracts are complete specifications; no placeholder operations, no unwired references.

## User Setup Required

None - documentation artifacts only; no external service configuration.

## Next Phase Readiness

- Ready for Plan 05 (orders spec + kafka-topics.md): drops into the existing lint glob and gate with zero config changes; the orders snapshot shape can now reference CartView/CartLine field names frozen here.
- Phase 3 (catalog-service) implements directly against `catalog-service.openapi.yaml`: schemas, error codes, pagination bounds, and the public/protected matrix are all frozen contractually.
- The cart phase implements against `cart-service.openapi.yaml`: trust-boundary semantics (sub identity, server totals, TTL refresh, DELETE-only removal) require no interpretation.
- Phase 7 (gateway) has a fully explicit per-operation security matrix to transcribe into its route table, including the two network-internal exclusions.

---
*Phase: 01-contracts-repo-scaffolding*
*Completed: 2026-08-24*

## Self-Check: PASSED

- All created files verified on disk (`[ -f ]` checks): both specs + this SUMMARY.
- Commits `08598a3` and `6ab999a` verified in `git log`.
- Full gate re-run post-Task-2: exit 0 with both new specs in the lint glob.
