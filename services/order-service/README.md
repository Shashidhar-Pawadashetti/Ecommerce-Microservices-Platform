# Order Service

Spring Boot 3.5.16 service that owns the **orders** system-of-record and
orchestrates the **checkout → payment** saga. It is the *initiator* of the saga:
it writes the order, publishes `order.created`, and consumes `payment.completed`
to drive the order to a terminal state.

> Built as a thin clone of `auth-service` (same package layout, JWT verification,
> Flyway migration pattern) so reviewers can navigate by analogy.

## Endpoints

| Method | Path            | Auth | Purpose                                            |
|--------|-----------------|------|----------------------------------------------------|
| POST   | `/orders`       | JWT  | Checkout: snapshot cart → create order → publish `order.created` → clear cart. Idempotent on `Idempotency-Key`. |
| GET    | `/orders`       | JWT  | List the caller's orders (newest first).           |
| GET    | `/orders/{id}`  | JWT  | Fetch one order. Unknown id **or other-owner** → `404` (no ownership leak). |

OpenAPI contract: `docs/api-contracts/orders-service.openapi.yaml`.

## Saga participation (details in `docs/kafka-topics.md`)

- **Publishes** `order.created` — key = `orderId`, value = JSON (field names match the
  OpenAPI `OrderSnapshot` schema). Published **only after** the order row commits
  (dual-write ordering, ORDR-02) so the consumer never acts on a missing order.
- **Consumes** `payment.completed` (group `order-service`) — applies
  `APPROVED → PAID`, `DECLINED → PAYMENT_FAILED`. A terminal-state guard
  (ORDR-04) makes redeliveries idempotent; unknown `orderId`s are ignored.

## Configuration (env)

| Env                               | Default / source            | Notes |
|-----------------------------------|-----------------------------|-------|
| `SPRING_DATASOURCE_URL`           | `jdbc:postgresql://postgres:5432/orders` | orders DB |
| `JWT_SECRET` / `JWT_ISSUER` / `JWT_AUDIENCE` / `JWT_TTL_SECONDS` | shared with auth-service | JWT **verification** only (see Deviations). |
| `KAFKA_BOOTSTRAP_SERVERS`         | `kafka:9092`                | Kafka broker |
| `CART_SERVICE_URL`                | `http://cart-service:3001`  | cart-service base URL |
| `SERVER_PORT`                     | `8082`                     | transitional (see Deviations) |

## Build & run

```bash
cd services/order-service
./mvnw package                 # builds the image via the multi-stage Dockerfile
```

Local tests (no Docker Compose needed — EmbeddedKafka + Testcontainers PG):

```bash
./mvnw test                    # OrderSagaIntegrationTests
```

## Deviations from plan (recorded in `docs/runbook.md` DOCS-02)

- **A3 — JWT holder:** order-service only *verifies* JWTs; it does not issue them
  (auth-service is the sole issuer). No `sign*` endpoints.
- **A5 — transitional ports:** `8082` is exposed for Phases 5–6 direct access and
  is revoked in Phase 7 hardening.
- **items_json column:** the `orders` table carries a frozen `items_json` snapshot so
  `GET /orders/{id}` returns purchase-time line items without a join table (Rule 2
  correctness addition; the plan's V1 SQL omitted it).
