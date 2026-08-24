---
phase: 01-contracts-repo-scaffolding
plan: 05
subsystem: api
tags: [openapi, kafka, contracts, idempotency, saga, spectral]

# Dependency graph
requires:
  - phase: 01-contracts-repo-scaffolding/02
    provides: validation gate (scripts/check-contracts.sh), topic-schema validator (scripts/validate-topic-schemas.mjs), spectral ruleset, _shared.yaml (IdempotencyKey parameter + Error envelope + bearerAuth scheme)
  - phase: 01-contracts-repo-scaffolding/03
    provides: interop canon in docs/json-interop.md (string IDs, integer cents, ISO-ms dates, absent-not-null, ignore-unknown) that both documents obey and cite
provides:
  - docs/api-contracts/orders-service.openapi.yaml — final REST contract completing CONTR-01: idempotent POST /orders (no body, cart-sourced snapshot), GET /orders history, GET /orders/{id} polling detail, GET /health internal probe
  - D-01 canonical status enum PENDING_PAYMENT | PAID | PAYMENT_FAILED with terminal-state guards documented as idempotent under redelivery
  - D-05 idempotent-replay semantics frozen at HTTP level (201 create / 200 original-order replay via required Idempotency-Key)
  - docs/kafka-topics.md — full event backbone contract delivering CONTR-02: order.created + payment.completed with partitions/RF/key/cleanup/consumers/delivery/DLQ checklist fields
  - Frozen outcome enum APPROVED|DECLINED with reason present-iff-DECLINED (absent-not-null) on payment.completed
  - D-06 email rendering-input tables (from address, subject templates, body fields per variant) for Phase 6 rendering and Phase 9 Mailpit REST assertion
affects: [Phase 5 saga (order+payment services implement both topics), Phase 6 notification worker (renders email payload tables), Phase 7 gateway (orders access matrix transcription), Phase 8 frontend (polls getOrder for terminal states), Phase 9 smoke test (Mailpit REST assertions)]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 7274        # chars/4 over the realized diff (29096 chars across both files)
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-as-single-drift-surface: kafka-topics.md payload field names mirror orders spec schemas verbatim; gate + review enforce they change together"
    - "Topic contracts carry per-consumer dedup clauses inside the contract itself (at-least-once implies consumers MUST be idempotent)"
    - "Validator-shaped examples: fenced JSON payload blocks are simultaneously prose examples AND machine-checked fixtures"

key-files:
  created:
    - docs/api-contracts/orders-service.openapi.yaml
    - docs/kafka-topics.md
  modified: []

key-decisions:
  - "D-01 implemented: OrderStatus enum exactly [PENDING_PAYMENT, PAID, PAYMENT_FAILED]; bare PENDING spelling superseded repo-wide (negative-grep clean on both files)"
  - "D-05 implemented: first POST /orders answers 201 with Location header; same Idempotency-Key replay answers 200 with the ORIGINAL order — codes distinguish creation from replay"
  - "D-checkout-source encoded: POST /orders deliberately has NO requestBody; description freezes cart-derived snapshotting (items AND prices) plus order.created publication after commit"
  - "D-06 implemented: email content frozen as rendering-input tables (From orders@ecommerce.local; subject templates; APPROVED renders orderId/nameSnapshot x qty/total/status PAID; DECLINED renders orderId/reason verbatim/status PAYMENT_FAILED/retry sentence)"
  - "payment.completed example shows the DECLINED variant so the single fenced JSON fixture carries reason while prose pins absent-not-null for APPROVED — validator REQUIRED key set satisfied without weakening Rule 4"

patterns-established:
  - "Polling contract: GET /orders/{id} is THE terminal-state detection endpoint (FRNT-05); foreign orders answer 404 like missing ones (no existence leak)"
  - "Kafka keying symmetry: both topics keyed by orderId so all events for one order land ordered on one partition"
  - "DLQ stance none in v1: poison messages log-and-skip is written into the topic contract, not left to implementer discretion"

requirements-completed: [CONTR-01, CONTR-02]

coverage:
  - id: D1
    description: "orders-service.openapi.yaml — four operations (createOrder/listOrders/getOrder/health), D-05 201-create/200-replay responses, D-01 enum, snapshot OrderItem schema"
    requirement: CONTR-01
    verification:
      - kind: other
        ref: "npx @stoplight/spectral-cli@6.16.3 lint docs/api-contracts/orders-service.openapi.yaml --ruleset docs/api-contracts/.spectral.yaml --fail-severity=warn (exit 0)"
        status: pass
      - kind: other
        ref: "bash scripts/check-contracts.sh (exit 0, Stage 5 coverage ok)"
        status: pass
      - kind: other
        ref: "acceptance greps: IdempotencyKey present; PENDING_PAYMENT count=11; bare-PENDING grep empty; '200'+'201' present"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/kafka-topics.md — both topic contracts with full Pattern-3 checklist fields, validator-exact payload fixtures, per-consumer dedup subsections, D-06 email payload tables naming Mailpit REST /api/v1/messages"
    requirement: CONTR-02
    verification:
      - kind: other
        ref: "node scripts/validate-topic-schemas.mjs docs/kafka-topics.md (exit 0; both REQUIRED key sets exact; totalCents integer; outcome enum)"
        status: pass
      - kind: other
        ref: "bash scripts/check-contracts.sh (exit 0; Stage 2 now at full strength on real content)"
        status: pass
      - kind: other
        ref: "acceptance greps: ^## Topic: count=2; APPROVED+DECLINED present; mailhog count=0; /api/v1/messages present; bare-PENDING grep empty"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-08-24
status: complete
---

# Phase 1 Plan 5: Orders Contract & Kafka Topic Contracts Summary

**Orders REST contract with idempotent checkout (201 create / 200 original-order replay) plus fully-contracted order.created & payment.completed topics with frozen APPROVED|DECLINED enum and D-06 email rendering-input tables**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-24T18:00:51Z
- **Completed:** 2026-08-24T18:09:11Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- CONTR-01 complete: fifth and final REST contract authored — orders-service.openapi.yaml with exactly four operations (createOrder, listOrders, getOrder, health), all JWT-protected except the network-internal health probe
- D-05 replay semantics frozen at HTTP level: required Idempotency-Key ($ref _shared.yaml), 201 + Location on creation, 200 identical-body replay documented as honest create-vs-replay distinction
- D-01 status machine frozen: PENDING_PAYMENT → PAID | PAYMENT_FAILED driven by payment.completed consumption under terminal-state guards (ORDR-04), idempotent under at-least-once redelivery
- CONTR-02 delivered wholesale: kafka-topics.md contracts both topics with every Pattern-3 checklist field (3 partitions declared up-front, RF 1, orderId keying for per-order ordering, delete ≥7d retention, consumer groups named, at-least-once semantics, no-DLQ log-and-skip stance)
- Per-consumer dedup contracts written INTO the topic contract (T-05-02 mitigation): payment-service skips already-authorized orderIds; notification-service dedupes both topics on eventId; order-service ignores outcomes for already-terminal orders
- D-06 email rendering inputs frozen as tables: From orders@ecommerce.local; subject templates per variant; APPROVED body = orderId + nameSnapshot×quantity lines + currency-formatted total + status word PAID; DECLINED body = orderId + reason verbatim + PAYMENT_FAILED + retry next-step; Phase 9 asserts via Mailpit REST /api/v1/messages
- Topic-schema validator passes on real content — its REQUIRED key maps match authored payload fixtures exactly; full check-contracts.sh gate green across all five stages

## Task Commits

Each task was committed atomically:

1. **Task 1: orders-service.openapi.yaml — idempotent checkout, status machine, polling detail** - `1bba606` (feat)
2. **Task 2: docs/kafka-topics.md — both topic contracts + email payload tables** - `7809f1c` (feat)

## Files Created/Modified
- `docs/api-contracts/orders-service.openapi.yaml` — Orders REST contract: idempotent checkout sourcing contents from the live cart (no request body), purchase-time item/price snapshot schemas, history list, polling detail endpoint, internal health probe
- `docs/kafka-topics.md` — Event backbone: order.created + payment.completed contracts (checklist tables + validator-exact payload fixtures + per-consumer dedup) and the D-06 email rendering-input tables

## Decisions Made
- Showed the DECLINED variant as the payment.completed JSON fixture: the validator requires the exact key set [eventId, orderId, outcome, reason, processedAt], so `reason` must be present in the example; prose pins that APPROVED events omit the key entirely (absent-not-null, interop Rule 4) — validator compliance and null-law preserved simultaneously
- Reused the catalog spec's example dataset (prod-1001 keyboard + prod-1002 cable, 14997 USD total) across orders spec examples and both Kafka payloads — cross-document consistency makes the single-drift-surface claim inspectable by eye
- Documented ownership scoping in getOrder prose (foreign order → 404, indistinguishable from missing) instead of adding a 403 response, keeping the operation surface exactly as planned while closing the IDOR/existence-leak question for Phase 5/7 implementers
- No pagination parameters on GET /orders: plan defines a simple {items, total} list; pagination was made contractual only where research mandated it (catalog)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — precondition held (gate script, validator, and _shared.yaml components all present from Plans 01-02); both tasks verified green on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All five OpenAPI specs + kafka-topics.md now exist; check-contracts.sh runs every stage at full strength (no remaining SKIPs except versions-manifest edge cases already covered)
- Phase 5 (saga) can implement order-service/payment-service directly against these two documents; Phase 6 renders the frozen email tables; Phase 8 polls getOrder for terminal states; Phase 9 asserts emails through Mailpit REST
- Watch-item for reviewers: ARCHITECTURE.md's older bare-PENDING spelling is formally superseded by D-01 anywhere it survives in planning prose

## Self-Check: PASSED

- All 3 authored files exist on disk (2 deliverables + this SUMMARY)
- Both task commits verified in git log (`1bba606`, `7809f1c`)

---
*Phase: 01-contracts-repo-scaffolding*
*Completed: 2026-08-24*
