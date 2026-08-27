# Phase 5 — Order + Payment Saga: Runbook & Decisions (DOCS-02)

This document is the canonical record of **deviations, decisions, and operational
run instructions** for Plan 05-01 (order-service + payment-service Kafka saga pair).

## How to run the full stack

```bash
docker compose up --build        # kafka (KRaft), order-service, payment-service, + existing services
# wait for healthy: order-service :8082, payment-service :8083, kafka-ui :8080
./scripts/phase5-tracer-smoke.sh # end-to-end: signup → cart → checkout → PAID
```

Kafka topics are provisioned by the `kafka-init` container
(`order.created`, `payment.completed`, 3 partitions, RF=1). `AUTO_CREATE_TOPICS`
is disabled — a missing topic is a misconfiguration, not silent auto-creation.

## How to run the tests (no Compose needed)

```bash
# order-service: saga on EmbeddedKafka + Testcontainers PostgreSQL
cd services/order-service && ./mvnw test

# payment-service: SETNX dedup + outcome logic on a real RedisContainer
cd services/payment-service && python -m uv run pytest -q tests/
```

## Deviations from the original plan

| ID  | Area            | Decision / Deviation                                                                 | Why |
|-----|-----------------|-------------------------------------------------------------------------------------|-----|
| A3  | JWT holder      | order-service **verifies** JWTs only; does not issue them (auth-service is sole issuer). No `sign*` endpoints. | Acceptable per PRD; keeps token issuance centralized. |
| A5  | Network exposure| order-service (`:8082`) and payment-service (`:8083`) are exposed directly for Phases 5–6. **Revoked in Phase 7** hardening. | Faster local verification now; reduces blast radius later by routing everything through the gateway. |
| A2  | orders schema  | Added `items_json TEXT` column to `orders` (frozen purchase-time line items). | Rule 2 correctness: `GET /orders/{id}` must return the snapshot without a join table. The plan's V1 SQL omitted it. |

## Saga correctness properties (ORDR-*)

- **ORDR-02 dual-write ordering:** `order.created` is published **after** the order
  row commits, so consumers never act on a missing order.
- **ORDR-03 at-least-once:** payment-service produces `payment.completed` only after
  a Redis `SETNX` dedup key is set, and order-service commits its state change before
  acknowledging the Kafka offset — redeliveries are safe.
- **ORDR-04 terminal guard:** once an order is `PAID`/`PAYMENT_FAILED`, further
  `payment.completed` deliveries are acknowledged and ignored.
- **ORDR-05 idempotency:** `POST /orders` is idempotent on `Idempotency-Key`
  (≥16 chars); replays return the same order snapshot (HTTP 200).
- **ORDR-06 cart clear:** the cart is cleared after a successful publish; a failed
  clear is logged and ignored (best-effort) so it never fails the order.
- **ORDR-07 ownership:** `GET /orders/{id}` returns `404` for unknown ids **and**
  other-owners — no existence/ownership leak.

## Kill test (ORDR-08)

`scripts/phase5-kill-test.sh` (Wave 3) kills `payment-service` mid-saga and asserts
that a redelivered `order.created` does not double-charge (SETNX dedup) and that the
order still reaches `PAID` once a healthy instance consumes `payment.completed`.

## Known follow-ups

- Phase 7: remove `8082`/`8083` host port exposure; route via `api-gateway`; add
  gateway routes + JWT forwarding for both services.
- Production hardening: move `PAYMENT_MODE` to a non-mock authorizer; add DLQ for
  poison `payment.completed` messages; consider outbox pattern for stronger
  dual-write guarantees (current post-commit publish is acceptable for the learning target).
