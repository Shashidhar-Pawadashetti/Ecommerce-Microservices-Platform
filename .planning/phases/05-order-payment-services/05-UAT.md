---
status: testing
phase: 05-order-payment-services
source: 05-01-SUMMARY.md
started: 2026-08-27T21:00:00Z
updated: 2026-08-27T21:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  From a clean state (no running containers), run `docker compose up -d --build`.
  All new Phase 5 containers come up healthy: `kafka` (KRaft, no ZooKeeper),
  `kafka-init` (provisions order.created + payment.completed with 3 partitions, RF=1),
  `orders-db-init` (creates the orders DB), `order-service` (:8082) and
  `payment-service` (:8083). `docker compose ps` shows them healthy/complete and
  `kafka-ui` is reachable on :8080 listing both topics. No startup errors.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: From a clean state, `docker compose up -d --build` brings up kafka (KRaft), kafka-init, orders-db-init, order-service, payment-service healthy; kafka-ui lists order.created + payment.completed (3 partitions, RF=1).
result: [pending]

### 2. Checkout reaches PAID (happy-path saga)
expected: Sign up + login, add prod-1001 qty 1 to cart, POST /orders with a random Idempotency-Key. The order transitions PENDING_PAYMENT -> PAID. kafka-ui (or a console consumer) shows 1+ message on order.created and 1+ on payment.completed.
result: [pending]

### 3. Idempotency replay (ORDR-05)
expected: Replaying POST /orders with the SAME Idempotency-Key returns HTTP 200 with the original order and creates no duplicate order row (exactly one order for that key).
result: [pending]

### 4. Crash recovery (ORDR-08)
expected: After checkout, while the order is PENDING_PAYMENT, `docker compose kill payment-service`; then `docker compose start payment-service`. The order still converges to PAID (or PAYMENT_FAILED) via broker redelivery — exactly one terminal outcome.
result: [pending]

### 5. Cart cleared after checkout (ORDR-06)
expected: After a successful checkout, GET /cart/{userId} returns an empty items list (the cart was cleared post-publish).
result: [pending]

### 6. Order history + ownership 404 (ORDR-07)
expected: GET /orders lists only the caller's orders; GET /orders/{id} for an order owned by a different user returns 404 (no existence leak).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
