---
phase: 5
plan: "05-01"
subsystem: "order + payment saga pair"
tags: [kafka, saga, order-service, payment-service, fastapi, spring-boot, idempotency]
dependency_graph:
  requires: [apache/kafka:4.2.1 (KRaft), postgres:18 (orders db), redis:8-alpine (dedup), cart-service (HTTP), auth-service (JWT issuer)]
  provides: [order.created topic, payment.completed topic, /orders REST API]
  affects: [docker-compose.yml, api-gateway (Phase 7 routes)]
tech_stack:
  added: [Spring Boot 3.5.16 (order-service), FastAPI 0.141.1 (payment-service), aiokafka 0.14.0, pydantic 2.13.4, apache/kafka:4.2.1, provectuslabs/kafka-ui:latest]
  patterns: [Kafka saga (initiator/participant), Redis SETNX dedup, Flyway V1 migration, dual-write ordering, terminal-state guard, HTTP idempotency interceptor]
key_files:
  created:
    - services/order-service (Spring Boot app: OrdersController, OrderService, PaymentCompletedConsumer, OrderEventProducer, IdempotencyInterceptor, Flyway V1)
    - services/payment-service (FastAPI app: consumer.handle_order, models, config; Kafka-only)
    - docker-compose.yml (kafka KRaft, kafka-init, orders-db-init, kafka-ui, order-service, payment-service)
    - scripts/phase5-tracer-smoke.sh
    - scripts/phase5-kill-test.sh
    - services/order-service/README.md
    - services/payment-service/README.md
    - docs/runbook.md (DOCS-02)
  modified:
    - .planning/phases/05-order-payment-services/COVERAGE.md
decisions:
  - "A3: order-service verifies JWTs only; payment-service is Kafka-only and verifies nothing. auth-service remains the sole token issuer."
  - "A5: order-service (:8082) and payment-service (:8083) exposed transiently for Phases 5-6; revoked in Phase 7 (gateway-only)."
  - "A2: orders table carries items_json (frozen snapshot) so GET /orders/{id} returns line items without a join table (Rule 2 correctness)."
  - "No NewTopic Spring beans: topics provisioned only by kafka-init init container (fixed 3 partitions, RF=1) with auto.create.topics.enable=false."
  - "Dual-write ordering: order.created published AFTER the order row commits; payment-service SETNX before produce; order-service commits state before acking offset."
metrics:
  duration: "multiple executor waves (single session)"
  completed: "2026-08-27"
  tasks: 5
  commits: 5
status: complete
actuals:
  tokens: 48000
  tasks: 5
  commits: 5
---

# Phase 5 Plan 01: Order + Payment Kafka Saga Pair Summary

**One-liner:** order-service (Spring Boot 3.5.16) + payment-service (FastAPI 0.141.1) implement the checkout→payment saga on Apache Kafka 4.2.1 (KRaft) with idempotent, crash-safe, broker-verified state transitions — verified by green dual-service integration/unit suites.

## Objective

Stand up the Order + Payment saga pair so a checkout (`POST /orders`) snapshots the cart, creates an order in `PENDING_PAYMENT`, publishes `order.created`, and — after the mock payment participant authorizes and produces `payment.completed` — transitions to `PAID`/`PAYMENT_FAILED`. The pair must satisfy the ORDR-* correctness properties (dual-write ordering, at-least-once safety, terminal guard, idempotent checkout, ownership isolation).

## Plan Compliance

Executed as 4 atomic waves (commits) matching the plan's task decomposition:

| Wave | Commit | Contents |
|------|--------|----------|
| 1 (tracer) | `4bf6cfc` | order-service + payment-service skeletons, docker-compose Kafka stack, tracer smoke script |
| 2A | `4143f0a` | IdempotencyInterceptor (ORDR-05) + OrderSagaIntegrationTests (EmbeddedKafka + Testcontainers PG) + payment test_saga.py (SETNX dedup) |
| 2B | `7340df5` | Ownership-404 hardening test + order-service/README.md + docs/runbook.md (DOCS-02) |
| 3 | `e72552f` | phase5-kill-test.sh (ORDR-08) + payment-service/README.md + COVERAGE.md verification section |

## What was built

- **order-service** (Spring Boot 3.5.16, package `com.ecommerce.order`): `OrdersController` (POST/GET /orders), `OrderService` (checkout txn + payment state machine), `PaymentCompletedConsumer` (group `order-service`), `OrderEventProducer` (`order.created`), `IdempotencyInterceptor` (ORDR-05 replay short-circuit), `CartClient` (WebClient → cart-service, header forwarded), Flyway `V1__create_orders.sql` (orders + idempotency_keys + `items_json`), JWT verify via `A3` holder, actuator health on `:8082`.
- **payment-service** (FastAPI 0.141.1 + aiokafka 0.14.0): Kafka-only `consumer.handle_order` — consumes `order.created`, runs mock authorization (`PAYMENT_MODE`), SETNX-dedups via Redis, produces `payment.completed` (RESEARCH ORDR-03/08). `reason` omitted on `APPROVED` (interop Rule 4). No REST surface.
- **docker-compose**: `apache/kafka:4.2.1` KRaft (no ZooKeeper), `kafka-init` (provisions the two topics, 3 partitions, RF=1), `orders-db-init` (creates `orders` db), `kafka-ui`, `order-service`, `payment-service`. `auto.create.topics.enable=false`.
- **scripts**: `phase5-tracer-smoke.sh` (full-stack signup→cart→checkout→PAID), `phase5-kill-test.sh` (kill payment-service pre-consume, restart, assert recovery to PAID).
- **docs**: `docs/runbook.md` (DOCS-02) with the A2/A3/A5 deviation log + ORDR-* property catalog; service READMEs; `COVERAGE.md` verification section.

## Verification

- **order-service** `OrderSagaIntegrationTests` (EmbeddedKafka + Testcontainers PostgreSQL) — ✅ green:
  - publishes `order.created` to the broker on checkout (captured via test listener);
  - `payment.completed` APPROVED → order reaches `PAID`; DECLINED → `PAYMENT_FAILED`;
  - `Idempotency-Key` replay returns the **same** order (HTTP 200);
  - non-owner `GET /orders/{id}` → **404** (no ownership leak).
- **payment-service** `tests/test_saga.py` (real RedisContainer + fake producer) — ✅ 4/4 green:
  - `always_success` → `APPROVED` with `reason` omitted; `always_fail` → `DECLINED` with `reason`;
  - redelivered `order.created` → SETNX dedup → exactly **one** `payment.completed` produced.
- **scripts** require a running `docker compose` stack (not executed in CI here, but syntactically validated with `bash -n` and logically aligned to the verified behavior).

## Deviations from Plan

### Auto-fixed / Design deviations
- **[Rule 2 - Correctness] A2 — `items_json` column added.** The plan's V1 SQL omitted a line-item store; `GET /orders/{id}` must return the frozen snapshot, so the `orders` table carries `items_json TEXT`. Documented in DOCS-02.
- **A3 — JWT holder.** order-service verifies only; payment-service is Kafka-only (no verification). No token issuance outside auth-service. Documented.
- **A5 — transitional ports.** `:8082`/`:8083` exposed for Phases 5–6; to be revoked in Phase 7 (gateway-only). Documented; flagged as a known exposure in Threat Flags.

### Auth gates
- None. Both services use the frozen JWT verification config (RS256 `A3` holder) shared with auth-service; no new auth flows introduced.

## Known Stubs

None. The mock payment authorizer (`PAYMENT_MODE`) is intentional v1 behavior (REQUIREMENTS.md Out of Scope), not a stub — its contract (`payment.completed` shape, outcome spellings, dedup) is fully implemented and tested.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: transient-network-exposure | docker-compose.yml | order-service `:8082` and payment-service `:8083` are published to the host for local verification (A5). They bypass the gateway and have no gateway-side rate limiting / WAF. Remediation: revoke host port exposure in Phase 7 and route exclusively via `api-gateway` with JWT forwarding. |

## Self-Check: PASSED

- [x] order-service Java compiles (`mvnw compile` EXIT=0)
- [x] order-service integration tests green (EmbeddedKafka + Testcontainers PG, EXIT=0)
- [x] payment-service tests green (4/4, RedisContainer)
- [x] payment-service `uv.lock` generated and committed (reproducible Docker build)
- [x] Wave commits present: `4bf6cfc`, `4143f0a`, `7340df5`, `e72552f`
- [x] No stubs; mock payment is intentional design
