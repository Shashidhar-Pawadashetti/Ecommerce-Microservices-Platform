# Phase 5: Order + Payment Services - Research

**Researched:** 2026-08-27
**Domain:** Polyglot Kafka saga (Java/Spring Boot order-service ⇄ Python/FastAPI payment-service) over apache/kafka 4.2.1 KRaft
**Confidence:** MEDIUM

## Summary

Phase 5 is the highest-complexity phase and the first to introduce Apache Kafka into the Compose
stack. It ships **two services as an inseparable pair**:

- **order-service** (Java / Spring Boot 3.5.16, JDK 21, Maven, PostgreSQL `orders` DB, `spring-kafka`
  3.3.x → kafka-clients 3.9) — the saga *orchestrator-side*: it exposes `POST /orders` (idempotent
  checkout), persists the order, produces `order.created`, consumes `payment.completed`, and drives
  the `PENDING_PAYMENT → PAID | PAYMENT_FAILED` state machine under terminal-state guards.
- **payment-service** (Python 3.13 / FastAPI 0.141.1, Pydantic 2.13.4, `aiokafka` 0.14.0) — the saga
  *participant*: it consumes `order.created`, runs the mock authorization controlled by `PAYMENT_MODE`,
  and produces `payment.completed`.

The correctness story is **at-least-once delivery with idempotent consumers**, not exactly-once. Both
consumers must be safe under redelivery: order-service uses a terminal-state guard (once PAID or
PAYMENT_FAILED, further `payment.completed` deliveries are acknowledged-and-ignored); payment-service
uses a dedup record (Redis `SETNX` reusing the existing Redis datastore) so a redelivered
`order.created` never re-authorizes the mock. The crash/restart acceptance test (ORDR-08) is
demonstrated by `docker kill`-ing the payment-service container mid-flow and observing the order still
reach a terminal state via redelivery, made observable through `provectuslabs/kafka-ui`.

Reuse is the dominant theme: order-service copies the auth-service Maven/Dockerfile/Flyway/JWT-verify
shape almost verbatim; payment-service copies the catalog-service FastAPI/pydantic-settings/Dockerfile
shape. The cart internal edge (`GET /cart/{userId}` for snapshot, `DELETE /cart` for clear) already
exists from Phase 4 and is the exact contract boundary order-service calls.

**Primary recommendation:** Build order-service as a Spring Boot clone of auth-service (add
`spring-kafka` + `spring-kafka-test`, a Flyway `orders` schema, a `NewTopic`-free topic bootstrap done
by a `kafka-init` init container, and an idempotency table in Postgres). Build payment-service as a
FastAPI clone of catalog-service (add `aiokafka` + `redis` for dedup, an `AIOKafkaConsumer`/`Producer`
lifecycle in a lifespan, manual offset commit). Wire Kafka via `apache/kafka:4.2.1` KRaft combined mode
with 3-partition single-broker topics keyed by `orderId`. Treat every consumer as idempotent by
construction; never rely on exactly-once.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Checkout HTTP API + idempotency | API / Backend (order-service, Spring) | api-gateway (Phase 7 route + JWT enforcement) | Order creation logic, idempotency store, and state machine live in order-service; gateway only routes/authenticates |
| Cart snapshot read | order-service (caller) → cart-service (Redis) | — | order-service reads the priced cart view over HTTP; cart-service owns Redis |
| Order persistence + state machine | API / Backend (order-service, PostgreSQL) | — | Orders are the system of record; Postgres is authoritative for terminal state |
| `order.created` production | order-service → Kafka | — | Produced after the order row commits (outbox-style ordering, no dual-write) |
| Payment authorization (mock) | payment-service (FastAPI) | — | Pure domain logic driven by `PAYMENT_MODE`; no datastore of its own |
| `payment.completed` production | payment-service → Kafka | Redis (dedup store) | Dedup record in Redis prevents double-authorization on redelivery |
| `payment.completed` consumption + transition | order-service (Spring consumer) | — | Terminal-state guard enforces idempotency |
| Observability of redelivery | Kafka + kafka-ui | — | Read-only UI to show lag/redelivery during the ORDR-08 kill test |
| Cart clearing | order-service (caller) → cart-service | — | order-service forwards the bearer token to `DELETE /cart` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Spring Boot | 3.5.16 | order-service app framework | Pinned in `docs/versions.md`; copy auth-service parent POM exactly |
| JDK | 21 (LTS) | order-service runtime | Pinned; `<maven.compiler.release>21</maven.compiler.release>` |
| spring-kafka | 3.3.x (managed by Boot 3.5 → kafka-clients 3.9) | order-service Kafka producer/consumer | Boot-managed; brokers are backward-compatible with 4.2.1. Do NOT bump `kafka.version` to 4.x while on Boot 3.5 [VERIFIED: docs.spring.io/spring-boot/reference/messaging/kafka.html] |
| spring-kafka-test | 3.3.x | order-service saga integration tests | Provides `EmbeddedKafka` for unit/integration saga tests without an external broker |
| FastAPI | 0.141.1 (`fastapi[standard]`) | payment-service framework | Pinned in `docs/versions.md`; copy catalog-service pyproject exactly |
| Pydantic / pydantic-settings | 2.13.4 / 2.15.0 | payment-service models + env binding | Pinned; `extra="ignore"` stance matches interop Rule 5 |
| aiokafka | 0.14.0 | payment-service Kafka consumer + producer | asyncio-native; tested against Kafka 4.x fetch APIs [VERIFIED: aiokafka.readthedocs.io/en/stable/consumer.html] |
| redis (redis-py) | >=5 (asyncio) | payment-service dedup store (reuses existing Redis) | SETNX gives atomic "already processed?" check surviving container restart; avoids a new datastore |
| PyJWT | 2.13.0 | payment-service not needed for JWT (no REST auth); kept only if cross-cutting reuse | payment-service consumes Kafka only — it does NOT need the JWT secret |
| apache/kafka | 4.2.1 (KRaft combined) | Event bus | Single broker, KRaft-only (no ZooKeeper) [VERIFIED: hub.docker.com/r/apache/kafka] |
| PostgreSQL | 18 | orders database | Same image as users DB; Flyway owns the `orders` schema |
| provectuslabs/kafka-ui | latest (floating) | Dev-only topic/consumer-group observability | Read-only inspection for ORDR-08; not runtime-critical [VERIFIED: github.com/provectus/kafka-ui] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| spring-boot-starter-data-jpa + flyway (postgresql module) | managed by Boot 3.5 | order + idempotency tables | Every Java DB service; Flyway append-only migrations |
| spring-boot-starter-actuator | managed by Boot 3.5 | `/actuator/health` for Compose healthcheck | Every Java service |
| spring-boot-starter-oauth2-resource-server | managed by Boot 3.5 | JWT verify in order-service (extract `sub`) | order-service must verify the token to derive ownership (deviation noted below) |
| pytest + pytest-asyncio + httpx | latest | payment-service tests | Both Python services |
| AIOKafkaConsumer/Producer (aiokafka) | 0.14.0 | payment-service event loop | Only Kafka client in payment-service |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Redis `SETNX` for payment dedup | SQLite (aiosqlite) in payment-service | Redis already runs (cart); SETNX avoids a new datastore and a new dependency bundle. SQLite would add a file volume + aiosqlite dep. |
| Spring `EmbeddedKafka` for tests | Testcontainers `KafkaContainer` (KRaft) | EmbeddedKafka is zero-infra for state-machine/idempotency unit tests; Testcontainers is heavier but closer to prod for the crash test. Use EmbeddedKafka for Wave-0 unit tests, Compose kill-test for ORDR-08. |
| `NewTopic` beans in order-service to auto-create topics | `kafka-init` init container | Contract says "auto-create is OFF" and topics are "provisioned by the Phase 5 compose layer." An init container is the explicit, contract-faithful provisioning; `NewTopic` beans would silently auto-create (violates contract). Use the init container. |

**Installation:**
```bash
# order-service (Maven — add to pom.xml, managed by Boot parent 3.5.16):
#   spring-boot-starter-web, spring-boot-starter-data-jpa,
#   spring-boot-starter-security, spring-boot-starter-oauth2-resource-server,
#   spring-boot-starter-validation, spring-boot-starter-actuator,
#   spring-kafka, flyway-core, flyway-database-postgresql, postgresql (runtime),
#   spring-boot-starter-test, spring-kafka-test, testcontainers:postgresql

# payment-service (uv / pyproject.toml — copy catalog-service, then add):
#   aiokafka==0.14.0
#   redis>=5
#   (keep fastapi[standard]==0.141.1, pydantic==2.13.4, pydantic-settings==2.15.0, PyJWT==2.13.0)
# dev: pytest, pytest-asyncio, httpx, testcontainers
```

**Version verification:** All versions above are copied verbatim from `docs/versions.md` (the single
source of truth), which was verified 2026-08-24 against registry dist-tags / npm view / PyPI pages.
Re-verify at build time per the manifest's standing instruction. The package-legitimacy gate (below)
returned `SUS` for the Python packages purely on an `unknown-downloads` / `too-new` telemetry signal —
these are the exact authoritative pins from `docs/versions.md`, not supply-chain risks.

## Package Legitimacy Audit

> Required because this phase installs external packages (Python deps for payment-service; Maven deps
> for order-service are Boot-managed and well-known).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| aiokafka | PyPI | current (2026-04-29) | n/a to checker | github.com/aio-libs/aiokafka | SUS | Approved — exact pin from `docs/versions.md`; SUS is `unknown-downloads` telemetry only |
| redis (redis-py) | PyPI | current | n/a to checker | github.com/redis/redis-py | SUS | Approved — established, well-known; SUS is telemetry only |
| fastapi | PyPI | current | n/a to checker | github.com/fastapi/fastapi | SUS | Approved — exact pin from `docs/versions.md`; SUS is telemetry only |
| pydantic | PyPI | current | n/a to checker | github.com/pydantic/pydantic | SUS | Approved — exact pin from `docs/versions.md`; SUS is telemetry only |
| pydantic-settings | PyPI | current | n/a to checker | github.com/pydantic/pydantic-settings | SUS | Approved — exact pin from `docs/versions.md`; SUS is telemetry only |
| PyJWT | PyPI | current | n/a to checker | github.com/jpadilla/pyjwt | SUS | Approved — already used by catalog-service |
| spring-kafka / spring-kafka-test | Maven Central | Boot 3.5 line | n/a to checker | spring-projects/spring-kafka | OK (managed) | Approved — Boot-parent managed, not independently slopsquattable |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all Python packages above — but the SUS verdict is a
telemetry artifact (`unknown-downloads` / `too-new`); no supply-chain risk was detected and every
version is the authoritative pin from `docs/versions.md`. The planner does **not** need a
`checkpoint:human-verify` task beyond the existing `docs/versions.md` governance. (If the planner
prefers belt-and-suspenders, a single human-verify gate on the payment-service `pyproject.toml` is
sufficient.)

## Architecture Patterns

### System Architecture Diagram

```
                                   ┌─────────────────────────────┐
   Browser ── JWT ─▶  (Phase 7)    │  api-gateway  /orders/**    │
   poll /orders/{id}               └──────────────┬──────────────┘
                                                  │ HTTP + Bearer
                                                  ▼
                                         ┌────────────────────┐
   POST /orders (Idempotency-Key)        │   order-service     │  Spring Boot, :8082
   ├─ verify JWT (sub)                   │  (Java, Postgres)   │
   ├─ GET  cart-service /cart/{sub} ───▶│                     │
   │   ◀── priced snapshot ─────────────│                     │
   ├─ INSERT order (PENDING_PAYMENT)    │                     │
   ├─ INSERT idempotency(key→orderId)  │                     │
   ├─ commit tx                         │                     │
   ├─ produce order.created(key=orderId)│                     │
   └─ DELETE cart-service /cart ───────▶│                     │
                                         └─────────┬───────────┘
                                                   │ order.created
                                                   ▼
                                         ┌────────────────────┐
                                         │   payment-service   │  FastAPI, aiokafka
                                         │  (Python, Redis)    │
                                         │  consume order.created
                                         │  ├─ SETNX dedup? → skip if present
                                         │  ├─ run PAYMENT_MODE mock
                                         │  └─ produce payment.completed(key=orderId)
                                         └─────────┬───────────┘
                                                   │ payment.completed
                                                   ▼
                                         ┌────────────────────┐
                                         │   order-service     │  @KafkaListener
                                         │  consume payment.completed
                                         │  ├─ terminal? → ack+ignore
                                         │  └─ PENDING → PAID | PAYMENT_FAILED
                                         └────────────────────┘

   observability: provectuslabs/kafka-ui reads the same broker (topics, consumer groups, lag)
```

Data flow under crash: if payment-service is `docker kill`-ed after consuming `order.created` but
before producing `payment.completed`, the broker still holds that record uncommitted → on restart the
consumer re-delivers `order.created` → mock runs once → `payment.completed` produced → order converges.
If it crashed *after* producing but *before* committing its offset, redelivery re-runs the mock, but
the Redis `SETNX` finds the order already processed → skips re-produce, and order-service's
terminal guard ignores the duplicate `payment.completed`. Final state is always correct.

### Recommended Project Structure

```
services/order-service/                 # Java/Spring Boot (clone of auth-service)
├── pom.xml                             # + spring-kafka, spring-kafka-test, testcontainers
├── Dockerfile                          # eclipse-temurin:21-jdk→jre-alpine (copy auth-service)
├── .mvn/wrapper/                       # Maven wrapper (committed)
└── src/main/java/com/ecommerce/order/
    ├── OrderServiceApplication.java
    ├── config/  JwtConfig.java  SecurityConfig.java  KafkaConfig.java  IdempotencyConfig.java
    ├── web/     OrdersController.java  IdempotencyInterceptor.java  GlobalExceptionHandler.java
    ├── domain/  Order.java  OrderRepository.java  IdempotencyKey.java  IdempotencyRepository.java
    ├── kafka/   OrderEventProducer.java  PaymentCompletedConsumer.java  OrderCreatedPayload.java
    └── resources/  application.yml  db/migration/V1__create_orders.sql
services/payment-service/               # Python/FastAPI (clone of catalog-service)
├── pyproject.toml                      # + aiokafka, redis
├── Dockerfile                          # python:3.13-slim + uv (copy catalog-service)
├── app/
│   ├── main.py                         # lifespan: start AIOKafkaConsumer + Producer
│   ├── config.py                       # pydantic-settings (+ KAFKA_BOOTSTRAP_SERVERS, REDIS_URL, PAYMENT_MODE)
│   ├── consumer.py                     # AIOKafkaConsumer loop, manual commit, Redis SETNX dedup
│   ├── producer.py                     # AIOKafkaProducer wrapper
│   └── models.py                       # OrderCreated / PaymentCompleted pydantic models (mirror kafka-topics.md)
└── tests/
```

### Pattern 1: Spring Kafka — producer and at-least-once consumer

**What:** `KafkaTemplate<String,String>` for `order.created` (key = orderId, value = JSON string
matching `docs/kafka-topics.md` verbatim); `@KafkaListener` for `payment.completed`. Spring Boot's
default container `ackMode` is `RECORD` with `enable-auto-commit=false`, which commits the offset
**after** the listener returns successfully → this is at-least-once. A thrown exception → no commit →
redelivery. [VERIFIED: docs.spring.io/spring-kafka/reference/3.3/tips.html (ackMode, transaction
examples); docs.spring.io/spring-boot/reference/messaging/kafka.html (`spring.kafka.*` mapping)]

**When to use:** Every Kafka touch in order-service.

```java
// application.yml (order-service) — property names map 1:1 to Kafka client config
spring:
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer   // [ASSUMED] standard class name
      value-serializer: org.apache.kafka.common.serialization.StringSerializer // [ASSUMED]
    consumer:
      group-id: order-service
      enable-auto-commit: false          // default; RECORD ackMode => at-least-once
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer   // [ASSUMED]
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer // [ASSUMED]

// OrderEventProducer.java
@Component
public class OrderEventProducer {
    private final KafkaTemplate<String, String> template;
    public void publishOrderCreated(OrderCreatedPayload p) {
        // record key = orderId so per-order ordering holds within a partition
        template.send("order.created", p.orderId(), p.toJson()); // [ASSUMED] toJson via Jackson
    }
}

// PaymentCompletedConsumer.java
@KafkaListener(id = "order-service", topics = "payment.completed")
public void onPaymentCompleted(ConsumerRecord<String, String> rec) {
    var p = PaymentCompletedPayload.fromJson(rec.value());
    orderService.applyPaymentResult(p);   // terminal guard inside
}
```

### Pattern 2: Idempotency-Key in Spring (interceptor + Postgres store)

**What:** A `HandlerInterceptor` reads the required `Idempotency-Key` header *before* the controller.
It looks up a Postgres `idempotency_keys(key PK, order_id, created_at)` row:
- **Found** → short-circuit with `200` + the stored `OrderSnapshot` (no order created, no event, no
  cart clear). This is D-05 replay semantics.
- **Not found** → bind the key to the request, let the controller run, and *after* a successful 201
  persist `(key → orderId)` in the same DB transaction as the order insert (unique constraint on `key`
  is the race-safe duplicate guard, mirroring auth-service's two-layer duplicate pattern).

**When to use:** `POST /orders` only.

```java
// IdempotencyInterceptor.java (preHandle)
public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object h) throws Exception {
    String key = req.getHeader("Idempotency-Key");
    if (key == null || key.length() < 16 || key.length() > 255) {        // mirror _shared.yaml min/max
        writeError(res, 400, "VALIDATION_FAILED", "Idempotency-Key required (16-255 chars).");
        return false;
    }
    var existing = idemRepo.findByKey(key);
    if (existing != null) {
        res.setStatus(200);                                            // D-05 replay => 200
        res.getWriter().write(objectMapper.writeValueAsString(existing.toSnapshot()));
        return false;                                                  // short-circuit, no controller
    }
    req.setAttribute("idemKey", key);
    return true;
}
```
[Pattern ASSUMED from standard Spring interceptor mechanics + contract D-05 + `_shared.yaml` IdempotencyKey (minLength 16, maxLength 255) [VERIFIED: docs/api-contracts/_shared.yaml:36-47]]

### Pattern 3: Cart snapshot + clear (calling Phase 4 edges)

**What:** order-service reads `GET /cart/{userId}` (internal, token-gated) and `DELETE /cart`
(token-gated) on cart-service. The snapshot response shape is fixed by `services/cart-service/src/totals.js`:

```json
{ "userId": "usr-42",
  "items": [ { "productId":"prod-1001", "name":"Mechanical Keyboard",
               "quantity":1, "unitPriceCents":12999, "lineTotalCents":12999 } ],
  "grandTotalCents": 14997, "currency":"USD",
  "updatedAt":"2026-08-24T12:15:00.000Z" }
```
[VERIFIED: services/cart-service/src/totals.js:22-39 — verbatim field names `name`, `unitPriceCents`,
`lineTotalCents`, `grandTotalCents`, `currency`]

Order-service maps → `OrderSnapshot`: `name → nameSnapshot`, `unitPriceCents → unitPriceCents`,
`grandTotalCents → totalCents`, plus `currency`. Empty cart (`items:[]`) → `404 NOT_FOUND` from the
internal route [VERIFIED: services/cart-service/src/routes/internal.js:31-33]. Clear is `DELETE /cart`
which returns `204` and reads `userId` from the **forwarded bearer token's `sub`**
[VERIFIED: services/cart-service/src/routes/cart.js:149-153]. order-service forwards the caller's
`Authorization` header; it must NOT synthesize a userId.

### Pattern 4: Order state machine + terminal-state guard

**What:** Status enum `PENDING_PAYMENT | PAID | PAYMENT_FAILED` (D-01 spellings)
[VERIFIED: docs/api-contracts/orders-service.openapi.yaml:291-303]. `applyPaymentResult`:
```java
if (order.getStatus().isTerminal()) { return; }            // idempotent under redelivery
if (outcome == APPROVED) order.setStatus(PAID);
else order.setStatus(PAYMENT_FAILED);
orderRepo.save(order);
```
Guards: no transition out of a terminal state; `payment.completed` for a terminal order is
acknowledged and ignored [VERIFIED: docs/kafka-topics.md:131-137]. The order row is the system of
record; the event is only a trigger.

### Pattern 5: Crash/restart recovery & observability

**What:** aiokafka consumer uses `enable_auto_commit=False` + **manual** `await consumer.commit()`
*after* producing `payment.completed`, so a crash before commit redelivers the message on restart
[VERIFIED: aiokafka.readthedocs.io/en/stable/examples/manual_commit.html]. The Redis `SETNX` dedup
(`SET payment:authorized:{orderId} {outcome} NX`) is the second guard so a redelivery that slips past
the commit window never re-authorizes the mock. kafka-ui (`provectuslabs/kafka-ui:latest`, port 8080
or 9000) is added to Compose **read-only** to watch `order.created` / `payment.completed` and the
`payment-service` / `order-service` consumer-group lags during the kill test
[VERIFIED: github.com/provectus/kafka-ui — supports topics, consumer groups, browse messages].

### Anti-Patterns to Avoid
- **Relying on exactly-once.** Kafka gives at-least-once here; only idempotent consumers make it safe.
  Never assume a message arrives once.
- **Producing `order.created` before the DB commit.** If the insert rolls back but the event is sent,
  consumers act on a non-existent order. Send the event only after the transaction commits (the
  interceptor/controller flow above does this; for stronger guarantees see deferred EXPR-03 outbox).
- **Letting payment-service double-authorize on redelivery.** The Redis `SETNX` guard is mandatory,
  not optional — ORDR-03's dedup contract requires it.
- **Auto-creating Kafka topics.** The contract forbids `auto.create.topics.enable`; provision via the
  `kafka-init` init container with exact 3 partitions / RF=1 so consumer-parallelism and replay are
  deterministic.
- **Hand-rolling JSON (de)serialization drift.** Both services must emit/consume the *exact* field
  names from `docs/kafka-topics.md` (which mirror `orders-service.openapi.yaml`). Validate with a
  shared model on each side; receivers ignore unknown fields (interop Rule 5).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Kafka producer/consumer plumbing | raw `kafka-python`/`kafka-clients` boilerplate | `spring-kafka` (order-service) / `aiokafka` (payment-service) | Framework clients handle reconnection, partitioning, offset management, and backpressure correctly |
| Idempotency store | in-memory map / ad-hoc file | Postgres `idempotency_keys` table (order) + Redis `SETNX` (payment) | Must survive restart; a crash must not lose dedup state or the saga breaks |
| JWT verification | manual `split('.').decode` parsing | Spring `oauth2ResourceServer` (order) / `PyJWT` (if needed) | Algorithm pinning, issuer/audience validation, skew handling are easy to get wrong by hand |
| Order schema migration | raw `schema.sql` + manual DDL | Flyway (Boot-managed) | Append-only, versioned, reproducible across fresh contexts — matches auth-service |
| Topic provisioning | `auto.create.topics.enable=true` | `kafka-init` init container with explicit `--create` | Contract mandates fixed partitions/RF and no auto-create |

**Key insight:** In a saga, the hardest bugs are *non-idempotent consumers* and *dual-write races*. The
frameworks and stores listed above exist precisely to make "acknowledge-then-ignore" and
"commit-then-publish" the path of least resistance — hand-rolling them invites exactly-once-fantasy
bugs that only surface under the ORDR-08 crash test.

## Common Pitfalls

### Pitfall 1: Exactly-once assumption
**What goes wrong:** A developer treats one delivery as guaranteed; a redelivery creates a duplicate
payment transition or a second mock authorization.
**Why it happens:** Kafka's at-least-once + default auto-commit looks "reliable."
**How to avoid:** Make every consumer idempotent by construction (terminal guard + Redis SETNX). The
ORDR-08 kill test is the proof — if it isn't demonstrated, the design is incomplete.
**Warning signs:** No dedup store; transitions that re-run side effects unconditionally.

### Pitfall 2: Produce-before-commit (dual write)
**What goes wrong:** `order.created` is produced, then the DB insert fails → payment-service
authorizes an order that doesn't exist; `GET /orders/{id}` 404s.
**Why it happens:** Easy to call `template.send(...)` in the same method as `repo.save(...)` without
transactional ordering.
**How to avoid:** Persist + commit the order and idempotency row first; send the event only after the
commit returns. (EXPR-03 transactional outbox is the deferred "perfect" answer.)
**Warning signs:** Event production inside the same try as the insert with no ordering guarantee.

### Pitfall 3: PG18 volume layout regression
**What goes wrong:** Mounting the orders/Postgres volume at the old `/var/lib/postgresql/data` silently
misplaces data; `down -v` loses state.
**Why it happens:** PG18 changed `PGDATA` to a version-nested path.
**How to avoid:** The compose file already mounts `pgdata:/var/lib/postgresql` (root). Keep it; do not
add a `/data` suffix [VERIFIED: services/../docker-compose.yml:31-34, and AGENTS.md STACK notes].
**Warning signs:** Postgres healthcheck passes but data disappears across restarts.

### Pitfall 4: orders database not created
**What goes wrong:** order-service fails to boot — `jdbc:postgresql://postgres:5432/orders` doesn't
exist; Flyway can't connect.
**Why it happens:** Compose only `POSTGRES_DB=users` today; the `orders` DB must be added in Phase 5
[VERIFIED: docker-compose.yml:23-30 comment "Phase 5 OBLIGATION"].
**How to avoid:** Ship BOTH an `initdb.d` backfill script AND a one-time `CREATE DATABASE orders`
(so long-lived volumes also get it). Wire order-service `SPRING_DATASOURCE_URL` to the `orders`
database, not `users`.
**Warning signs:** Flyway "database not found" / connection refused to `orders`.

### Pitfall 5: KRaft env-var mistakes on apache/kafka
**What goes wrong:** Broker won't start — "process.roles required" or listeners misconfigured.
**Why it happens:** The official image requires *all* KRaft props via `KAFKA_*` when any are set; a
partial set fails.
**How to avoid:** Provide the full combined-mode set (verified below). Do NOT use `bitnami/kafka`
(supply-chain restructuring, banned in STACK). [VERIFIED: hub.docker.com/r/apache/kafka + github.com/apache/kafka docker/examples/README.md]
**Warning signs:** Container exits immediately; logs mention missing `process.roles` or controller quorum voters.

### Pitfall 6: aiokafka auto-commit mask redelivery gaps
**What goes wrong:** With `enable_auto_commit=True` (default) and batch processing, a crash loses
in-flight work or double-processes.
**Why it happens:** Autocommit commits on a timer, not after processing.
**How to avoid:** `enable_auto_commit=False` + manual `commit()` only after `payment.completed` is
produced. [VERIFIED: aiokafka.readthedocs.io/en/stable/consumer.html]

## Code Examples

### Spring order-service: produce `order.created` (key = orderId)
```java
// OrderEventProducer.java  [pattern ASSUMED for Jackson usage; config VERIFIED spring-kafka docs]
@Service
public class OrderEventProducer {
    private final KafkaTemplate<String, String> template;
    public OrderEventProducer(KafkaTemplate<String, String> template) { this.template = template; }
    public void publishCreated(Order order) {
        var payload = new OrderCreatedPayload(
            UUID.randomUUID().toString(),          // eventId
            order.getOrderId(),                     // orderId (also the record key)
            order.getUserId(), order.getUserEmail(),
            order.getItems(), order.getTotalCents(), order.getCurrency(), order.getCreatedAt());
        template.send("order.created", order.getOrderId(), payload.toJson());
    }
}
```

### Spring order-service: consume `payment.completed` with terminal guard
```java
// PaymentCompletedConsumer.java  [ackMode=RECORD => at-least-once, VERIFIED spring-kafka docs]
@Component
public class PaymentCompletedConsumer {
    private final OrderService svc;
    public PaymentCompletedConsumer(OrderService svc) { this.svc = svc; }
    @KafkaListener(id = "order-service", topics = "payment.completed", groupId = "order-service")
    public void onPayment(ConsumerRecord<String, String> rec) {
        var p = PaymentCompletedPayload.fromJson(rec.value());   // orderId in rec.key()
        svc.applyPaymentResult(p.orderId(), p.outcome(), p.reason());
    }
}
// OrderService.applyPaymentResult: if status is PAID/PAYMENT_FAILED -> return (idempotent); else set terminal.
```

### FastAPI payment-service: aiokafka consume + produce + Redis dedup
```python
# app/consumer.py  [VERIFIED: aiokafka.readthedocs.io/en/stable/consumer.html + manual_commit.html]
import json
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
import redis.asyncio as redis

async def run(bootstrap: str, redis_url: str, payment_mode: str):
    r = redis.from_url(redis_url)
    consumer = AIOKafkaConsumer(
        "order.created", group_id="payment-service",
        bootstrap_servers=bootstrap, auto_offset_reset="earliest",
        enable_auto_commit=False,                          # manual commit => at-least-once
        value_deserializer=lambda v: json.loads(v.decode()))
    producer = AIOKafkaProducer(
        bootstrap_servers=bootstrap,
        value_serializer=lambda v: json.dumps(v).encode())
    await consumer.start(); await producer.start()
    try:
        async for msg in consumer:
            order = msg.value
            key = f"payment:authorized:{order['orderId']}"
            # SETNX: if already processed, skip (no second mock authorization)
            if await r.set(key, order.get("outcome", "PENDING"), nx=True):
                outcome = authorize(payment_mode)          # always_success|always_fail|random
                event = {"eventId": str(uuid4()), "orderId": order["orderId"],
                         "outcome": outcome,               # APPROVED | DECLINED
                         "reason": None if outcome == "APPROVED" else "Mock decline",
                         "processedAt": now_iso()}
                # reason OMITTED entirely on APPROVED (interop Rule 4) [VERIFIED: kafka-topics.md:123-129]
                await producer.send_and_wait("payment.completed", key=order["orderId"], value=event)
            await consumer.commit()                        # commit AFTER produce
    finally:
        await consumer.stop(); await producer.stop()
```
Note: if a crash occurs between `producer.send_and_wait` and `consumer.commit()`, redelivery re-runs
this loop; `set(..., nx=True)` now returns False (already set) → skips re-produce, and order-service's
terminal guard ignores the duplicate. Final state converges.

### Idempotency-Key interceptor (order-service)
See Pattern 2 above. The unique `idempotency_keys.key` constraint is the race-safe duplicate guard
(analogous to auth-service's `users_email_uniq` index) [VERIFIED pattern: services/auth-service/src/main/resources/db/migration/V1__create_users.sql + GlobalExceptionHandler].

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ZooKeeper-backed Kafka | KRaft-only (ZK removed in Kafka 4.x) | Kafka 4.0 (2025) | No ZK container; combined broker+controller via `KAFKA_PROCESS_ROLES=broker,controller` |
| `spring-cloud-starter-gateway` (old) | `spring-cloud-starter-gateway-server-webflux` | Spring Cloud 2025.0 | order-service doesn't use the gateway starter, but note for Phase 7 |
| Motor (async Mongo) | PyMongo `AsyncMongoClient` | MongoDB 2025-05 | payment-service uses no Mongo; catalog already migrated |
| MailHog | Mailpit | 2026 deviation | notification phase; payment-service unaffected |

**Deprecated/outdated:**
- `auto.create.topics.enable=true` — forbidden by this platform's topic contract.
- Exactly-once streaming semantics — not used; at-least-once + idempotent consumers instead.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Spring `KafkaTemplate`/`@KafkaListener` default `ackMode=RECORD` with `enable-auto-commit=false` yields at-least-once | Pattern 1 / Pitfall 1 | Low — standard Boot behavior; verifiable in Wave-0 test |
| A2 | Exact serializer/deserializer class names (`StringSerializer`/`StringDeserializer`) | Pattern 1 | Low — canonical; easy to correct |
| A3 | order-service should verify JWT itself (not just trust gateway) to extract `sub` during Phase 5 standalone testing | Architecture / Summary | Medium — makes order-service a JWT holder (deviation from "exactly two holders"); acceptable like catalog-service, must be recorded in DOCS-02 |
| A4 | Redis `SETNX` is sufficient dedup for payment-service (vs SQLite) | Pattern 5 / Don't Hand-Roll | Low — Redis already runs; survives restart |
| A5 | A transient `8082:8082` host port on order-service for Phase 5 standalone testing, revoked in Phase 7 (mirrors auth/catalog/cart) | Architecture | Medium — the orders contract says "port unpublished", which is the Phase-7 end state; interim port needed for testability. Planner should confirm |
| A6 | `kafka-init` init container using `kafka-topics.sh --create` is the right provisioning mechanism | Architecture / Pitfall 4 | Low — contract-faithful; alternative `NewTopic` beans would violate "auto-create OFF" |

## Open Questions

1. **order-service JWT holder deviation (A3).**
   - What we know: order-service needs `sub` from the token; gateway isn't built until Phase 7.
   - What's unclear: whether to verify JWT in order-service (clean, but adds a 3rd/4th JWT holder) or
     trust the gateway and read `sub` without crypto.
   - Recommendation: verify in order-service (reuse auth-service `JwtConfig`/`SecurityConfig`);
     record deviation in DOCS-02. Unblocks Phase 5 standalone testing.

2. **Transitional host port for order-service (A5).**
   - What we know: auth/catalog/cart all expose `:8081/:8000/:3001` for Phases 2–6.
   - What's unclear: the orders contract states order-service port is unpublished — that is the Phase-7
     state, but Phase 5 needs a test surface.
   - Recommendation: add `8082:8082` in Phase 5, revoke in Phase 7 (consistent with siblings).

3. **Crash-test granularity for ORDR-08.**
   - What we know: kill payment-service mid-flow; final state must converge.
   - What's unclear: whether to assert via kafka-ui lag, a console consumer, or a poll on `GET /orders/{id}`.
   - Recommendation: drive it from the Phase 9 smoke test (poll order status to terminal) AND make it
     observable in kafka-ui during manual runs.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker + Compose v2 | whole phase | ✓ | Compose plugin | — |
| JDK 21 (build host) | order-service Maven build | ✓ (host has JDK) | per env | use Maven wrapper (no host JDK strictly required) |
| Python 3.13 + uv | payment-service | ✓ | 3.13 | — |
| apache/kafka:4.2.1 image | event bus | ✓ (pull at deploy) | 4.2.1 | — |
| Redis (already in Compose) | payment dedup | ✓ | 8-alpine | in-memory map (loses restart safety — reject) |
| PostgreSQL 18 (already in Compose) | orders DB | ✓ | 18 | — |
| provectuslabs/kafka-ui | observability (dev) | ✓ (pull) | latest | Kafka console consumer via `kafka-console-consumer.sh` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all present or pulled from registry.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` → this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| order-service | JUnit 5 + Spring Boot Test + `spring-kafka-test` (`EmbeddedKafka`) + Testcontainers PostgreSQL |
| payment-service | pytest 9.x + pytest-asyncio (auto) + httpx + Testcontainers Kafka (or shared compose broker) |
| Config file (order) | `src/test/resources/application-test.yml` (EmbeddedKafka + test Postgres) |
| Config file (payment) | `pyproject.toml [tool.pytest.ini_options]` (asyncio_mode=auto) — already present from catalog copy |
| Quick run (order) | `./mvnw -q test` |
| Full suite (order) | `./mvnw -q test` (all modules) |
| Quick run (payment) | `uv run pytest -q` |
| Full suite (payment) | `uv run pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORDR-01 | Checkout snapshots items + prices from cart | integration (order) | `./mvnw -q test` (mock cart client) | ❌ Wave 0 |
| ORDR-02 | Order persists + produces `order.created` | integration (EmbeddedKafka) | `./mvnw -q test` | ❌ Wave 0 |
| ORDR-03 | Payment consumes + produces `payment.completed` per `PAYMENT_MODE` | integration (payment + broker) | `uv run pytest -q` | ❌ Wave 0 |
| ORDR-04 | Terminal-state guard idempotent under redelivery | unit (order state machine) | `./mvnw -q test` | ❌ Wave 0 |
| ORDR-05 | Idempotency-Key: replay returns 200 + original | integration (order) | `./mvnw -q test` | ❌ Wave 0 |
| ORDR-06 | Cart cleared after checkout | integration (order + mock cart) | `./mvnw -q test` | ❌ Wave 0 |
| ORDR-07 | Order history + detail polling endpoint | integration (order + JPA) | `./mvnw -q test` | ❌ Wave 0 |
| ORDR-08 | Kill/restart payment converges to terminal | compose e2e (manual/orchestration) | `docker kill` + poll `GET /orders/{id}` | ❌ Phase 9 |

### Sampling Rate
- **Per task commit (order):** `./mvnw -q test` (EmbeddedKafka + Testcontainers PG)
- **Per task commit (payment):** `uv run pytest -q`
- **Per wave merge:** full suite of both services green
- **Phase gate:** full suites + the ORDR-08 compose kill-test before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `services/order-service/src/test/...` — saga + idempotency + state-machine tests (ORDR-01..07)
- [ ] `services/payment-service/tests/test_saga.py` — consumer dedup + produce per PAYMENT_MODE (ORDR-03)
- [ ] `application-test.yml` for order-service (EmbeddedKafka + Testcontainers PG)
- [ ] Shared test broker fixture for payment-service (Testcontainers `KafkaContainer` KRaft, or reuse compose kafka in integration profile)
- [ ] One compose-level script asserting ORDR-08 (kill payment-service, poll to terminal)

## Security Domain

> `security_enforcement: true`, ASVS L1. This phase adds the order-service JWT-verify path and
> server-side enforcement of ownership.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no (issuance is auth-service) | n/a — order-service only verifies |
| V3 Session Management | yes (JWT verify to derive `sub`) | Spring `oauth2ResourceServer` + `JwtDecoder` (HS256 pinned, iss/aud/skew) — copy auth-service `JwtConfig` [VERIFIED: services/auth-service/.../JwtConfig.java] |
| V4 Access Control | yes | Order queries/scans filtered by `sub`; another user's order → 404 (no existence leak) [VERIFIED: orders-service.openapi.yaml:212-220] |
| V5 Input Validation | yes | `Idempotency-Key` length 16–255; JSON parse of Kafka payloads validated against pydantic models; reject malformed events | 
| V6 Cryptography | no (no new crypto) | n/a — JWT secret handled by Spring/PyJWT; never logged |
| V13 API (L1) | yes | Unified error envelope; `400`/`401`/`404` codes match `_shared.yaml` |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged/invalid JWT reaching order-service | Spoofing | Pin `alg=HS256`, validate `iss=ecommerce-auth`, `aud=ecommerce-api`, ±60s skew (copy auth-service); reject `none`/asymmetric swaps |
| IDOR on `GET /orders/{id}` | Elevation | Server-side filter by `sub`; 404 for others (no existence leak) |
| Duplicate order via replayed body | Tampering | `Idempotency-Key` + unique `idempotency_keys.key`; same key → original order, no re-run |
| Poison Kafka message crashes consumer | Tampering | Validate every payload with pydantic (payment) / Jackson (order); log + skip on failure (contract: "poison messages logged and skipped") |

## Sources

### Primary (HIGH confidence)
- docs.spring.io/spring-kafka/reference/3.3/tips.html and /kafka/receiving-messages/listener-annotation.html — `@KafkaListener`, ackMode, group.id, transaction examples
- docs.spring.io/spring-boot/reference/messaging/kafka.html — `spring.kafka.*` property mapping, auto-configured `KafkaTemplate`
- aiokafka.readthedocs.io/en/stable/consumer.html and /examples/manual_commit.html — consumer group, `enable_auto_commit`, manual commit, at-least-once
- hub.docker.com/r/apache/kafka + github.com/apache/kafka/blob/trunk/docker/examples/README.md — KRaft combined-mode `KAFKA_*` env vars
- docs/kafka-topics.md, docs/api-contracts/orders-service.openapi.yaml, docs/api-contracts/_shared.yaml — event + REST contracts (authoritative)

### Secondary (MEDIUM confidence)
- github.com/provectus/kafka-ui — KRaft + consumer-group/topic observability (compat noted LOW in STACK; dev-only)
- services/cart-service/src/totals.js, routes/internal.js, routes/cart.js — verbatim snapshot + clear contract (read this session)
- services/auth-service/* — Spring Boot template (pom, Dockerfile, JwtConfig, Flyway) reused by order-service
- services/catalog-service/* — FastAPI template (config, main, pyproject, Dockerfile) reused by payment-service

### Tertiary (LOW confidence)
- aiokafka producer `send_and_wait` ordering semantics — standard but not individually fetched; marked [ASSUMED] where used
- Specific Spring serializer class names — canonical, marked [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions pinned in `docs/versions.md`; Kafka/aiokafka/Spring config verified against official docs.
- Architecture: MEDIUM — saga topology, idempotency, and crash-recovery design are sound but contain [ASSUMED] wiring decisions (A1–A6) the planner should confirm (notably A3 JWT-holder and A5 transitional port).
- Pitfalls: HIGH — PG18 volume, orders-DB creation, KRaft env vars, and aiokafka autocommit are verified against authoritative sources.

**Research date:** 2026-08-27
**Valid until:** 2026-09-26 (30 days — Kafka/Spring Boot move fast; re-verify pins at build time)
