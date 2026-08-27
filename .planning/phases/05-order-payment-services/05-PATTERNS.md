# Phase 5: Order + Payment Services - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 31 (order-service ~21 new, payment-service ~8 new, infra ~2 modified)
**Analogs found:** 19 / 31 (strong analog = 19; no-analog = 12, all of which have inline code examples in `05-RESEARCH.md`)

## Strategy Summary

Reuse is the dominant theme of Phase 5:

- **order-service is a near-verbatim Spring Boot clone of `services/auth-service/`** (same Boot parent 3.5.16, JDK 21, Maven wrapper, Flyway, JWT-verify `JwtConfig`). Differences are additive: `spring-kafka` + `spring-kafka-test`, an `orders` Flyway migration plus an `idempotency_keys` table, a Kafka producer/consumer, an `IdempotencyInterceptor`, and a `POST /orders` controller that calls cart-service over HTTP.
- **payment-service is a FastAPI clone of `services/catalog-service/`** (same `pyproject.toml` shape, `python:3.13-slim` + `uv` Dockerfile, `pydantic-settings` `config.py`, lifespan-driven `main.py`). Differences are additive: `aiokafka` + `redis` deps, a Kafka consumer/producer in the lifespan, and pydantic event models.
- **Cart edges are already built (Phase 4).** order-service only *consumes* two existing routes; copy the exact response shapes from `cart-service/src/totals.js`, `routes/internal.js`, `routes/cart.js`.
- **Event + REST contracts are frozen docs.** `docs/kafka-topics.md`, `docs/api-contracts/_shared.yaml`, and `docs/api-contracts/orders-service.openapi.yaml` are the single drift surface — both services must match them field-for-field.
- **Genuinely new (no codebase analog):** all Kafka plumbing (`KafkaConfig`, `OrderEventProducer`, `PaymentCompletedConsumer`, `consumer.py`, `producer.py`), the `kafka-init` init container, and the `orders` DB creation. Patterns for these are quoted inline from `05-RESEARCH.md` (verified against official Spring/aiokafka docs).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `services/order-service/pom.xml` | config (build) | build-time | `services/auth-service/pom.xml` | exact-clone (+kafka) |
| `services/order-service/Dockerfile` | config (build) | build-time | `services/auth-service/Dockerfile` | exact-clone (port 8082) |
| `services/order-service/.mvn/wrapper/*` | config | build-time | `services/auth-service/.mvn/wrapper/*` | exact-copy |
| `services/order-service/src/main/java/com/ecommerce/order/OrderServiceApplication.java` | entrypoint | boot | `services/auth-service/.../AuthServiceApplication.java` | role-match |
| `services/order-service/src/main/resources/application.yml` | config | config | `services/auth-service/.../application.yml` | close (add kafka) |
| `services/order-service/src/main/java/com/ecommerce/order/config/JwtConfig.java` | config | request-response | `services/auth-service/.../config/JwtConfig.java` | exact-copy |
| `services/order-service/src/main/java/com/ecommerce/order/config/SecurityConfig.java` | config | request-response | `services/auth-service/.../config/SecurityConfig.java` | close (matchers differ) |
| `services/order-service/src/main/java/com/ecommerce/order/config/KafkaConfig.java` | config | event-driven | **none** (RESEARCH Pattern 1) | no-analog |
| `services/order-service/src/main/java/com/ecommerce/order/config/IdempotencyConfig.java` | config | request-response | `services/auth-service/.../config/SecurityConfig.java` (bean style) | partial |
| `services/order-service/src/main/java/com/ecommerce/order/web/OrdersController.java` | controller | request-response (CRUD) | `services/auth-service/.../web/AuthController.java` | role-match |
| `services/order-service/src/main/java/com/ecommerce/order/web/IdempotencyInterceptor.java` | middleware/interceptor | request-response | `services/auth-service/.../web/GlobalExceptionHandler.java` (envelope reuse) | partial (RESEARCH Pattern 2) |
| `services/order-service/src/main/java/com/ecommerce/order/web/GlobalExceptionHandler.java` | middleware | request-response | `services/auth-service/.../web/GlobalExceptionHandler.java` | exact-clone |
| `services/order-service/src/main/java/com/ecommerce/order/support/ApiError.java` | model/dto | request-response | `services/auth-service/.../support/ApiError.java` | exact-copy |
| `services/order-service/src/main/java/com/ecommerce/order/domain/Order.java` | model | CRUD | `services/auth-service/.../user/User.java` | role-match (JPA entity) |
| `services/order-service/src/main/java/com/ecommerce/order/domain/OrderRepository.java` | model/repo | CRUD | `services/auth-service/.../user/UserRepository.java` | role-match |
| `services/order-service/src/main/java/com/ecommerce/order/domain/IdempotencyKey.java` | model | CRUD | `services/auth-service/.../user/User.java` | role-match |
| `services/order-service/src/main/java/com/ecommerce/order/domain/IdempotencyRepository.java` | model/repo | CRUD | `services/auth-service/.../user/UserRepository.java` | role-match |
| `services/order-service/src/main/java/com/ecommerce/order/kafka/OrderEventProducer.java` | service | event-driven (producer) | **none** (RESEARCH Pattern 1/Code) | no-analog |
| `services/order-service/src/main/java/com/ecommerce/order/kafka/PaymentCompletedConsumer.java` | service | event-driven (consumer) | **none** (RESEARCH Pattern 1/4) | no-analog |
| `services/order-service/src/main/java/com/ecommerce/order/kafka/OrderCreatedPayload.java` | model/dto | event-driven | `services/auth-service/.../web/dto/*` (record DTOs) | role-match |
| `services/order-service/src/main/resources/db/migration/V1__create_orders.sql` | migration | CRUD | `services/auth-service/.../db/migration/V1__create_users.sql` | exact-clone (schema differs) |
| `services/order-service/src/test/resources/application-test.yml` | config (test) | test | `services/auth-service/.../application.yml` | partial |
| `services/order-service/src/test/...` (ORDR-01..07) | test | test | `services/auth-service/src/test/...` | role-match |
| `services/payment-service/pyproject.toml` | config (build) | build-time | `services/catalog-service/pyproject.toml` | exact-clone (+aiokafka,redis) |
| `services/payment-service/Dockerfile` | config (build) | build-time | `services/catalog-service/Dockerfile` | exact-clone (port) |
| `services/payment-service/app/config.py` | config | config | `services/catalog-service/app/config.py` | close (add kafka/redis/payment_mode) |
| `services/payment-service/app/main.py` | entrypoint/controller | event-driven (lifespan) | `services/catalog-service/app/main.py` | close (lifespan adapters) |
| `services/payment-service/app/consumer.py` | service | event-driven (consumer) | **none** (RESEARCH Code) | no-analog |
| `services/payment-service/app/producer.py` | service | event-driven (producer) | **none** (RESEARCH Code) | no-analog |
| `services/payment-service/app/models.py` | model | event-driven | `services/catalog-service/app/models.py` | role-match (pydantic v2) |
| `services/payment-service/tests/test_saga.py` | test | test | `services/catalog-service/tests/conftest.py` | role-match (testcontainers) |
| `docker-compose.yml` (modify) | config (infra) | infra | existing compose (kafka/orders-db/kafka-ui/kafka-init) | partial (no-analog additions) |

---

## Pattern Assignments

### A. order-service ↔ auth-service (Java / Spring Boot 3.5.16)

**Analog root:** `services/auth-service/`

#### A1. `pom.xml` — copy verbatim, then ADD kafka + testcontainers
**Source:** `services/auth-service/pom.xml` (lines 1-126)
**Imports/dependency pattern** (copy the whole `<parent>` + `<properties>` + base `<dependencies>` block verbatim):
```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>3.5.16</version>            <!-- pinned by docs/versions.md -->
  <relativePath/>
</parent>
<groupId>com.ecommerce</groupId>
<artifactId>order-service</artifactId>  <!-- rename ONLY this -->
<properties><java.version>21</java.version></properties>
```
**ADD (after the actuator dependency, ~line 80):**
```xml
<!-- Kafka producer + consumer (Boot-managed spring-kafka 3.3.x -> kafka-clients 3.9) -->
<dependency>
  <groupId>org.springframework.kafka</groupId>
  <artifactId>spring-kafka</artifactId>
</dependency>
<!-- Testcontainers PostgreSQL for saga integration tests (matches auth-service testcontainers block) -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-testcontainers</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>kafka</artifactId>        <!-- NEW for payment/order saga tests -->
  <scope>test</scope>
</dependency>
```
> Keep `spring-boot-starter-web`, `-security`, `-oauth2-resource-server`, `-data-jpa`, `-validation`, `flyway-core`, `flyway-database-postgresql`, `postgresql`, `-actuator` EXACTLY as in auth-service. Do NOT add `spring-kafka-test` separately if using Testcontainers Kafka; add it only if you prefer `EmbeddedKafka` (RESEARCH valid.arch: Wave-0 unit tests).

#### A2. `Dockerfile` — copy verbatim, change port 8081→8082
**Source:** `services/auth-service/Dockerfile` (lines 1-30) — copy the whole file, change only:
- `EXPOSE 8081` → `EXPOSE 8082`
- comment header "auth-service" → "order-service"
Base images `eclipse-temurin:21-jdk-alpine` / `-jre-alpine` and the `MaxRAMPercentage=75` + `spring` non-root user stay identical.

#### A3. `application.yml` — copy, repoint datasource to `orders`, add `spring.kafka.*`
**Source:** `services/auth-service/src/main/resources/application.yml` (lines 1-31)
```yaml
server:
  port: 8082                       # was 8081
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/orders}  # was /users
    username: ${POSTGRES_USER:ecommerce}
    password: ${POSTGRES_PASSWORD:}
  jpa:
    hibernate:
      ddl-auto: validate          # Flyway owns schema (same as auth)
  kafka:                          # NEW — RESEARCH Pattern 1 (verified spring-kafka docs)
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
    consumer:
      group-id: order-service
      enable-auto-commit: false   # RECORD ackMode => at-least-once
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
management:
  endpoints:
    web:
      exposure:
        include: health
jwt:                               # copy auth-service jwt block verbatim (HS256 verify)
  secret: ${JWT_SECRET:bG9jYWwtZGV2LW9ubHktc2lnbmluZy1zZWNyZXQtMzJieXRlcw==}
  issuer: ${JWT_ISSUER:ecommerce-auth}
  audience: ${JWT_AUDIENCE:ecommerce-api}
  ttl-seconds: ${JWT_TTL_SECONDS:3600}
```

#### A4. `config/JwtConfig.java` — COPY VERBATIM
**Source:** `services/auth-service/src/main/java/com/ecommerce/auth/config/JwtConfig.java` (lines 1-84)
Copy the entire file; only change the package declaration `com.ecommerce.auth.config` → `com.ecommerce.order.config`. This gives order-service the MAC-only HS256 decoder with ±60s skew, issuer `ecommerce-auth`, audience `ecommerce-api` validators — exactly what RESEARCH Security Domain requires (V3 Session Mgmt, ASVS L1). This realizes open-question **A3** (order-service self-verifies JWT until Phase 7).

#### A5. `config/SecurityConfig.java` — copy, adapt matchers
**Source:** `services/auth-service/src/main/java/com/ecommerce/auth/config/SecurityConfig.java` (lines 31-66)
Reuse the `PasswordEncoder` bean? **No** — order-service stores no passwords; drop it. Keep the stateless chain + `oauth2ResourceServer(jwt(...).authenticationEntryPoint(entryPoint))`. Change the `authorizeHttpRequests` block:
```java
.authorizeHttpRequests(auth -> auth
    .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
    .requestMatchers("/actuator/health", "/health").permitAll()  // network-internal probes
    .requestMatchers("/orders/**").authenticated()               // all order ops need bearer
    .anyRequest().denyAll())
```
> `RestAuthenticationEntryPoint` + `ApiError` envelope are reused from the auth-service copy (see A8/A9). `sub` is recovered in the controller via `Authentication#getName()` (same as `AuthController.me()` line 73-74).

#### A6. `web/OrdersController.java` — mirror `AuthController` shape
**Source:** `services/auth-service/src/main/java/com/ecommerce/auth/web/AuthController.java` (lines 40-85)
Copy the controller anatomy: `@RestController`, constructor injection, `ResponseEntity<...>`, `@Valid`, and **sub-derived identity** (`UUID.fromString(authentication.getName())` — lines 72-74). Adapt to:
- `POST /orders` (no body, reads `Idempotency-Key` via interceptor-bound attribute, returns `201` + `Location` on create / `200` on replay, `400` empty cart, `401` bad token).
- `GET /orders` → `OrderList` (server-side `sub` filter → 404-on-other-owner semantics implemented in repo query).
- `GET /orders/{id}` → `OrderSnapshot` or `404 NOT_FOUND` (never existence leak).
Return bodies via a `OrderSnapshotResponse` record mirroring `UserResponse.from(user)` builder style (line 52).

#### A7. `web/IdempotencyInterceptor.java` — RESEARCH Pattern 2 (no direct analog, reuse envelope)
**Source:** `services/auth-service/.../web/GlobalExceptionHandler.java` (envelope strings) + `docs/api-contracts/_shared.yaml` (`IdempotencyKey` param 16-255, lines 36-47)
Pseudo-pattern to implement (A2 in RESEARCH):
```java
// preHandle: read "Idempotency-Key"; 400 VALIDATION_FAILED if missing/<16/>255 (use ApiError envelope)
//   existing key -> 200 + stored snapshot (no controller run)
//   absent -> bind key to request attribute, proceed
// afterCompletion (on 201): persist (key -> orderId) in SAME tx as order insert
```
The `ApiError("VALIDATION_FAILED", "...")` constructor and `ResponseEntity.status(...).body(new ApiError(...))` come from A8/A9.

#### A8. `web/GlobalExceptionHandler.java` + A9. `support/ApiError.java` — COPY VERBATIM (envelope)
**Source:** `services/auth-service/src/main/java/com/ecommerce/auth/web/GlobalExceptionHandler.java` (lines 20-60) and `services/auth-service/src/main/java/com/ecommerce/auth/support/ApiError.java` (lines 1-9)
Copy both files changing only the package. The `ApiError(String code, String message)` record IS the `_shared.yaml` Error envelope. Add handlers for order-specific cases reusing the same `VALIDATION_FAILED` / `NOT_FOUND` / `CONFLICT` strings from `_shared.yaml` (lines 100-131):
- empty cart on checkout → `VALIDATION_FAILED`
- unknown order / other-owner → `NOT_FOUND` (line 118)
- duplicate idempotency key (race backstop) → reuse `CONFLICT` envelope + a `DUPLICATE_*`-style code.

#### A10. `domain/Order.java`, `OrderRepository.java`, `IdempotencyKey.java`, `IdempotencyRepository.java`
**Source:** `services/auth-service/src/main/java/com/ecommerce/auth/user/User.java` + `UserRepository.java` (JPA entity + `JpaRepository` style)
- `Order`: `@Entity` with `orderId` (string), `userId` (string = sub), `status` (enum `PENDING_PAYMENT|PAID|PAYMENT_FAILED` per orders.openapi D-01), `totalCents` int, `currency` String, `createdAt` (timestamptz). Add `isTerminal()` helper for the state-machine guard (RESEARCH Pattern 4).
- `OrderRepository`: `JpaRepository<Order,Long>` + `findByOrderId(String)` + `findByUserIdOrderByCreatedAtDesc(String sub)` (for `GET /orders` server-side owner filter → 404-for-others).
- `IdempotencyKey`: `@Entity` `key` (PK, String, 16-255), `orderId` (String), `createdAt`. Unique constraint on `key` = the race-safe duplicate guard (mirrors `users_email_uniq`, RESEARCH Pattern 2).
- `IdempotencyRepository`: `JpaRepository<IdempotencyKey,String>` + `findByKey(String)`.

#### A11. `resources/db/migration/V1__create_orders.sql` — clone Flyway layout
**Source:** `services/auth-service/src/main/resources/db/migration/V1__create_users.sql` (lines 1-20)
Copy the header discipline ("OWNED BY FLYWAY: append-only"). Schema:
```sql
CREATE TABLE orders (
    id            bigserial PRIMARY KEY,
    order_id      varchar(64) NOT NULL,
    user_id       varchar(64) NOT NULL,
    status        varchar(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
    total_cents   integer NOT NULL CHECK (total_cents >= 0),
    currency      varchar(3) NOT NULL DEFAULT 'USD',
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX orders_order_id_uniq ON orders (order_id);

CREATE TABLE idempotency_keys (
    key          varchar(255) PRIMARY KEY,   -- Idempotency-Key header (16-255 enforced in app)
    order_id     varchar(64) NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
```
> PG18 volume mount stays at `/var/lib/postgresql` (RESEARCH Pitfall 3) — do NOT add `/data`.

#### A12. `kafka/OrderCreatedPayload.java` — record DTO (mirror auth DTOs)
**Source:** `services/auth-service/src/main/java/com/ecommerce/auth/web/dto/*` (record DTO style, e.g. `UserResponse.java`)
Implement as a Java `record` with `toJson()` (Jackson) matching `docs/kafka-topics.md` `order.created` payload EXACTLY (fields: `eventId, orderId, userId, userEmail, items[]{productId,nameSnapshot,unitPriceCents,quantity}, totalCents, currency, createdAt`). `OrderEventProducer` uses `KafkaTemplate<String,String>.send("order.created", orderId, payload.toJson())` (RESEARCH Pattern 1 / Code).

---

### B. order-service → cart-service internal edges (CONTRACT ONLY, already built Phase 4)

order-service does **not** modify cart-service; it only calls two existing routes. Copy the exact wire shapes below so the snapshot mapping matches `totals.js` field-for-field.

**B1. `GET /cart/{userId}` snapshot — `services/cart-service/src/routes/internal.js` (lines 24-43)**
```js
internalRouter.get('/cart/:userId', verifyBearer, async (req, res, next) => {
  const cart = await cartStore.readCart(req.params.userId);
  if (cart.items.length === 0) { throw new NotFound(); }   // EMPTY CART => 404
  const priceMap = await batchPrice(ids);
  return res.status(200).json(buildCartView(...));          // 200 with snapshot
});
```
**B2. Snapshot field names — `services/cart-service/src/totals.js` (lines 12-40)**
```js
return {
  userId,
  items: viewItems,          // each: { productId, name, quantity, unitPriceCents, lineTotalCents }
  grandTotalCents,           // order-service maps -> totalCents
  currency: 'USD',
  updatedAt,
};
```
order-service mapping: `name → nameSnapshot`, `unitPriceCents → unitPriceCents`, `grandTotalCents → totalCents`, `currency → currency`. Empty cart → treat as `400 VALIDATION_FAILED` at checkout.

**B3. `DELETE /cart` clear — `services/cart-service/src/routes/cart.js` (lines 149-156)**
```js
cartRouter.delete('/', verifyBearer, async (req, res, next) => {
  const userId = req.user.sub;        // identity from token, NOT body
  await cartStore.clearCart(userId);  // idempotent; 204 even if empty
  return res.status(204).end();       // 204 NO CONTENT
});
```
order-service must **forward the caller's `Authorization` header** to both calls (do NOT synthesize userId); cart-service derives `sub` from the token. Java side: a `WebClient` (no existing analog in repo — RESEARCH does not pin one; use `WebClient` with `.header(HttpHeaders.AUTHORIZATION, incomingAuthHeader)`). Empty-cart internal read ⇒ 404 ⇒ checkout returns `400 VALIDATION_FAILED`.

**B4. Env naming reference — `services/cart-service/src/config.js` (lines 13-24)**
order-service needs `CART_SERVICE_URL` (default `http://cart-service:3001`) and forwards `Authorization`. Redis URL constant `REDIS_URL` lives here too — reuse the same `REDIS_URL` env name for payment-service dedup (RESEARCH Pattern 5).

---

### C. payment-service ↔ catalog-service (Python 3.13 / FastAPI 0.141.1)

**Analog root:** `services/catalog-service/`

#### C1. `pyproject.toml` — copy, ADD `aiokafka` + `redis`
**Source:** `services/catalog-service/pyproject.toml` (lines 1-32)
Copy verbatim; change `name = "payment-service"`. Add runtime deps (RESEARCH Installation):
```toml
dependencies = [
    "fastapi[standard]==0.141.1",
    "pydantic==2.13.4",
    "pydantic-settings==2.15.0",
    "PyJWT==2.13.0",          # harmless; not used for JWT verify in payment
    "aiokafka==0.14.0",       # NEW
    "redis>=5",               # NEW (asyncio redis for SETNX dedup)
]
```
Keep `[tool.pytest.ini_options]` `asyncio_mode = "auto"` (line 30) — this is what RESEARCH Validation Architecture expects for `uv run pytest`.

#### C2. `Dockerfile` — copy verbatim, change port
**Source:** `services/catalog-service/Dockerfile` (lines 1-33)
Copy the whole `python:3.13-slim` + `uv sync --frozen --no-dev` + non-root `app` user pattern. Change `EXPOSE 8000` → `EXPOSE 8001` (or the port chosen for payment-service) and the `uvicorn` `--port` accordingly. Keep `UV_LINK_MODE=copy` / `UV_COMPILE_BYTECODE=1` / non-root conventions.

#### C3. `app/config.py` — copy, add kafka/redis/payment_mode
**Source:** `services/catalog-service/app/config.py` (lines 15-51)
Copy `Settings(BaseSettings)` with `model_config` (`extra="ignore"`, `case_sensitive=False`) verbatim. Add (after the datastore block):
```python
# ── Kafka / Payment ──────────────────────────────────────────────
kafka_bootstrap_servers: str = "kafka:9092"
redis_url: str = "redis://redis:6379/0"
payment_mode: str = "always_success"   # always_success | always_fail | random
```
`extra="ignore"` + the `jwt_secret_bytes` property pattern stay as-is (harmless even though payment doesn't verify JWT).

#### C4. `app/main.py` — copy lifespan envelope, swap Mongo for Kafka
**Source:** `services/catalog-service/app/main.py` (lines 22-98)
Reuse the `_error_response()` (lines 22-25), the `HTTPException` handler (58-75), and `RequestValidationError` handler (78-86) **verbatim** — these emit the identical `_shared.yaml` envelope (`{"code","message"}`). Replace the Mongo `lifespan` (lines 28-37) with a Kafka lifespan:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # start AIOKafkaConsumer + AIOKafkaProducer (RESEARCH Code / Pattern 5)
    consumer, producer = await kafka_startup(settings)   # see consumer.py/producer.py
    try:
        yield
    finally:
        await kafka_shutdown(consumer, producer)
```
Keep `app = FastAPI(title="Payment Service API", ...)`. Payment-service has NO REST router to `include_router` (it is Kafka-only) — that is fine; omit `app.include_router(...)`.

#### C5. `app/models.py` — pydantic v2 event models (mirror catalog models)
**Source:** `services/catalog-service/app/models.py` (lines 11-79) — copy the interop discipline header and the `ConfigDict(extra="ignore")` + `Field(ge=0)` + `field_serializer` patterns.
Define (field names EXACTLY per `docs/kafka-topics.md`):
```python
class OrderCreated(BaseModel):
    model_config = ConfigDict(extra="ignore")     # Rule 5
    eventId: str
    orderId: str
    userId: str
    userEmail: str
    items: list[OrderItemSnapshot]
    totalCents: int = Field(ge=0)                 # Rule 2
    currency: str
    createdAt: str                                 # ISO-8601 ms UTC (Rule 1)

class PaymentCompleted(BaseModel):
    model_config = ConfigDict(extra="ignore")
    eventId: str
    orderId: str
    outcome: str                                   # APPROVED | DECLINED
    reason: str | None = None                      # OMITTED on APPROVED (Rule 4)
    processedAt: str
```
`iso_ms()` helper from catalog's `models.py` (lines 19-26) is reusable for `processedAt`.

#### C6. `tests/conftest.py` — copy testcontainers + ASGI client + HS256 token
**Source:** `services/catalog-service/tests/conftest.py` (lines 1-48)
Copy the `mongo_container`→ replace with a `KafkaContainer("apache/kafka:4.2.1")` (or reuse the compose broker in an integration profile), keep the `client` fixture (`ASGITransport` + `AsyncClient`, lines 27-35) and `auth_token` HS256 mint (lines 38-48) — payment-service tests mint a token the same way if any REST surface is added, and reuse `AsyncClient` for app startup assertions.

---

### D. Shared contract docs (drift surface for BOTH services)

| Doc | What both services must match | Key lines |
|---|---|---|
| `docs/kafka-topics.md` | `order.created` & `payment.completed` payload field names, `APPROVED\|DECLINED` enum, `reason` omitted on APPROVED, 3 partitions / RF=1, record key = `orderId`, at-least-once + idempotent consumers | 24-137 |
| `docs/api-contracts/_shared.yaml` | `Error` envelope `{code,message}`; `IdempotencyKey` header `minLength:16, maxLength:255`; shared responses `VALIDATION_FAILED`/`UNAUTHORIZED`/`NOT_FOUND`/`DUPLICATE_EMAIL` strings | 36-131 |
| `docs/api-contracts/orders-service.openapi.yaml` | `OrderSnapshot`/`OrderItem`/`OrderStatus` (`PENDING_PAYMENT\|PAID\|PAYMENT_FAILED`), `201` create vs `200` replay (D-05), `404` ownership (no leak), no body on `POST /orders` | 88-387 |

---

## No Analog Found (rely on `05-RESEARCH.md` inline code)

These files have **no existing codebase analog**; copy the verified snippets from RESEARCH (sources cited there):

| File | Role | Data Flow | Why no analog | Reference |
|---|---|---|---|---|
| `order-service/.../config/KafkaConfig.java` | config | event-driven | No Kafka in repo yet | RESEARCH Pattern 1 (`spring.kafka.*` via `application.yml` only — often no extra `@Configuration` needed; `KafkaTemplate` auto-configured) |
| `order-service/.../kafka/OrderEventProducer.java` | service | producer | No producer exists | RESEARCH §"Code Examples" `OrderEventProducer` (lines 417-433) |
| `order-service/.../kafka/PaymentCompletedConsumer.java` | service | consumer | No consumer exists | RESEARCH Pattern 1 + §"Code Examples" (lines 435-449). `@KafkaListener(id="order-service", topics="payment.completed")`; terminal-state guard inside `applyPaymentResult` |
| `order-service/.../config/IdempotencyConfig.java` | config | request-response | New pattern | RESEARCH Pattern 2 (register `IdempotencyInterceptor` via `WebMvcConfigurer.addInterceptors`) |
| `order-service/src/test/resources/application-test.yml` | config (test) | test | New | RESEARCH Validation Architecture (EmbeddedKafka + Testcontainers PG) |
| `payment-service/app/consumer.py` | service | consumer | No Kafka in repo | RESEARCH §"Code Examples" aiokafka `run()` (lines 451-485): `enable_auto_commit=False`, manual `commit()` AFTER produce, Redis `SETNX` dedup |
| `payment-service/app/producer.py` | service | producer | No Kafka in repo | RESEARCH Code: `AIOKafkaProducer(bootstrap_servers=..., value_serializer=json.dumps.encode)` |
| `docker-compose.yml` (add kafka + kafka-init + orders-db + kafka-ui) | infra | infra | Phase 5 introduces Kafka | RESEARCH Pitfall 4/5 + Architecture Diagram. Use `apache/kafka:4.2.1` KRaft combined; `kafka-init` init container runs `kafka-topics.sh --create` with 3 partitions/RF=1 (NOT `NewTopic` beans). Add `POSTGRES_DB=orders` (Pitfall 4). `provectuslabs/kafka-ui:latest` read-only |

> **Note on `WebClient` (order→cart HTTP call):** no Spring HTTP-client exists in the repo (auth-service makes no outbound calls). Use `org.springframework.web.reactive.function.client.WebClient` (Boot-auto-configured) and forward the `Authorization` header verbatim (RESEARCH Pattern 3). This is the only order-service dependency not directly cloned from auth-service.

---

## Shared Patterns (cross-cutting)

### 1. Unified Error Envelope `{code, message}`
**Apply to:** every order-service controller/exception path AND every payment-service HTTPException.
- **Java source:** `services/auth-service/.../support/ApiError.java` (record) + `GlobalExceptionHandler.java` (lines 26-59) — copy verbatim into order-service.
- **Python source:** `services/catalog-service/app/main.py` `_error_response()` (lines 22-25) + handlers (58-86) — copy verbatim into payment-service.
- **Codes:** must be the exact strings from `docs/api-contracts/_shared.yaml` (lines 100-131): `VALIDATION_FAILED`, `UNAUTHORIZED`, `NOT_FOUND`, `DUPLICATE_EMAIL` (and reuse `CONFLICT`-style envelopes for idempotency conflicts). Messages never leak internals.

### 2. Idempotency (two complementary mechanisms)
- **order-service (HTTP replay, D-05):** `IdempotencyInterceptor` (RESEARCH Pattern 2) + unique `idempotency_keys.key` (= auth-service `users_email_uniq` guard, lines 8-9 of V1 SQL). Same key → original order, no re-run.
- **payment-service (Kafka redelivery, ORDR-03):** Redis `SET key payment:authorized:{orderId} {outcome} NX` (RESEARCH Pattern 5 / Code lines 472-474) — survives restart, prevents double mock authorization.

### 3. JWT Verification (HS256, MAC-only)
- **order-service:** copy `auth-service/JwtConfig.java` (lines 45-84) + `SecurityConfig` oauth2ResourceServer block (lines 61-63). Derive `sub` via `Authentication#getName()` (mirror `AuthController.me()` lines 72-74). Realizes A3 deviation (record in DOCS-02).
- **payment-service:** does **NOT** verify JWT (Kafka-only consumer; RESEARCH Standard Stack: "payment-service consumes Kafka only — it does NOT need the JWT secret"). No JwtConfig needed.

### 4. At-Least-Once Kafka (both services)
- **order-service:** Boot default `ackMode=RECORD` + `enable-auto-commit=false` ⇒ offset commits after listener success; thrown exception ⇒ redelivery (RESEARCH Pattern 1, A1). Producer sends `order.created` **after** DB commit (Pitfall 2).
- **payment-service:** `enable_auto_commit=False` + manual `await consumer.commit()` **after** `producer.send_and_wait("payment.completed")` (RESEARCH Pitfall 6 / Code lines 481-482). Record key = `orderId` on both topics for per-order ordering.

### 5. Money / Timestamp / Identifier interop (Rule 2/1/3 from `docs/json-interop.md`)
- Integer cents everywhere (`totalCents`, `unitPriceCents`), never floats.
- ISO-8601 millisecond + `Z` timestamps (catalog `iso_ms()` helper, models.py lines 19-26, reusable in payment).
- `orderId`/`userId` are strings on the wire (Rule 3) even if stored as `bigint`/`uuid` internally.

---

## Metadata

**Analog search scope:** `services/auth-service/`, `services/catalog-service/`, `services/cart-service/`, `docs/api-contracts/`, `docs/kafka-topics.md`
**Files scanned:** 19 analog files read; grep for `RestTemplate|WebClient|@KafkaListener|AIOKafka` returned **0 matches** (confirming no existing Kafka/HTTP-client analog).
**Pattern extraction date:** 2026-08-27
**Key reuse facts:** auth-service (Boot 3.5.16, JDK 21, Flyway, JwtConfig) and catalog-service (FastAPI 0.141.1, pydantic-settings, uv Dockerfile, testcontainers conftest) are the locked templates. cart-service routes internal.js/cart.js/totals.js are the frozen contract for the two edges order-service calls.
