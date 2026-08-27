---
phase: 05-order-payment-services
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - services/order-service/pom.xml
  - services/order-service/Dockerfile
  - services/order-service/src/main/resources/application.yml
  - services/order-service/src/main/resources/db/migration/V1__create_orders.sql
  - services/order-service/src/main/java/com/ecommerce/order/OrderServiceApplication.java
  - services/order-service/src/main/java/com/ecommerce/order/config/JwtConfig.java
  - services/order-service/src/main/java/com/ecommerce/order/config/SecurityConfig.java
  - services/order-service/src/main/java/com/ecommerce/order/config/IdempotencyConfig.java
  - services/order-service/src/main/java/com/ecommerce/order/web/OrdersController.java
  - services/order-service/src/main/java/com/ecommerce/order/web/IdempotencyInterceptor.java
  - services/order-service/src/main/java/com/ecommerce/order/web/GlobalExceptionHandler.java
  - services/order-service/src/main/java/com/ecommerce/order/support/ApiError.java
  - services/order-service/src/main/java/com/ecommerce/order/domain/Order.java
  - services/order-service/src/main/java/com/ecommerce/order/domain/OrderRepository.java
  - services/order-service/src/main/java/com/ecommerce/order/domain/IdempotencyKey.java
  - services/order-service/src/main/java/com/ecommerce/order/domain/IdempotencyRepository.java
  - services/order-service/src/main/java/com/ecommerce/order/kafka/OrderEventProducer.java
  - services/order-service/src/main/java/com/ecommerce/order/kafka/PaymentCompletedConsumer.java
  - services/order-service/src/main/java/com/ecommerce/order/kafka/OrderCreatedPayload.java
  - services/order-service/src/main/java/com/ecommerce/order/config/CartClient.java
  - services/order-service/src/test/java/com/ecommerce/order/OrderSagaIntegrationTests.java
  - services/order-service/src/test/resources/application-test.yml
  - services/payment-service/pyproject.toml
  - services/payment-service/Dockerfile
  - services/payment-service/app/config.py
  - services/payment-service/app/main.py
  - services/payment-service/app/consumer.py
  - services/payment-service/app/producer.py
  - services/payment-service/app/models.py
  - services/payment-service/tests/conftest.py
  - services/payment-service/tests/test_saga.py
  - docker-compose.yml
  - .env.example
  - docs/runbook.md
  - services/order-service/README.md
  - services/payment-service/README.md
  - scripts/phase5-tracer-smoke.sh
  - scripts/phase5-kill-test.sh
autonomous: true
requirements: [ORDR-01, ORDR-02, ORDR-03, ORDR-04, ORDR-05, ORDR-06, ORDR-07, ORDR-08]
user_setup: []
estimate:
  tokens: 400000
  raw_tokens: 200000
  tasks: 4
  confidence: low
must_haves:
  truths:
    - "A checkout converts the caller's cart into an order that snapshots items AND prices at purchase time, persists to Postgres, and produces order.created (observable in kafka-ui or a console consumer)."
    - "With PAYMENT_MODE set, payment-service consumes order.created and produces payment.completed carrying APPROVED|DECLINED; order-service transitions PENDING_PAYMENT -> PAID | PAYMENT_FAILED under a terminal-state guard (idempotent under redelivery)."
    - "Replaying POST /orders with the same Idempotency-Key header returns the original order (200) instead of creating a duplicate (ORDR-05)."
    - "Killing and restarting payment-service mid-flow still ends in the correct final state — at-least-once redelivery is demonstrated via console consumer or kafka-ui (ORDR-08)."
    - "The cart is cleared after successful checkout, and the user can list order history and fetch individual order detail suitable for frontend status polling (404 on other-owner, no existence leak)."
  artifacts:
    - "services/order-service (Spring Boot 3.5.16 clone of auth-service) with POST /orders, GET /orders, GET /orders/{id}, Flyway V1 orders + idempotency_keys, Kafka producer/consumer, idempotency interceptor, JWT self-verify."
    - "services/payment-service (FastAPI 0.141.1 clone of catalog-service) with aiokafka consumer+producer, Redis SETNX dedup, PAYMENT_MODE mock."
    - "docker-compose.yml gains apache/kafka:4.2.1 KRaft, kafka-init init container (order.created / payment.completed, 3 partitions RF=1), orders database init, kafka-ui, and both service entries (8082 / 8083)."
    - "Wave-0 test suites: order-service saga/idempotency/state-machine (EmbeddedKafka + Testcontainers PG), payment-service consumer-dedup (pytest)."
  key_links:
    - "order.created is produced ONLY AFTER the order + idempotency row commit (dual-write ordering) — breakage makes payment authorize a nonexistent order."
    - "PaymentCompletedConsumer terminal-state guard (isTerminal -> ack+ignore) — breakage causes a second transition under redelivery."
    - "payment-service Redis SETNX before authorize — breakage double-authorizes a redelivered order.created."
    - "CartClient forwards the caller's Authorization header and reads sub from the token — breakage yields 401 from cart-service or identity injection."
---

<objective>
Build the Order + Payment Kafka saga pair as one inseparable phase: checkout snapshots the
cart (items + live prices), persists an order in PENDING_PAYMENT, publishes order.created,
and payment-service consumes it, runs the mock authorization (PAYMENT_MODE), and publishes
payment.completed, which order-service consumes to transition to PAID | PAYMENT_FAILED. Both
consumers are idempotent by construction so at-least-once redelivery and a mid-flow kill of
payment-service still converge to the correct terminal state.

Purpose: the first Kafka-in-Compose phase and the core async correctness story of the platform.
Output: two production services, real Kafka wiring, idempotency on both HTTP-replay and
event-redelivery axes, order history/detail for polling, and a demonstrated crash-recovery proof.
</objective>

<execution_context>
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/.planning/workflows/execute-plan.md
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/.planning/templates/summary.md
</execution_context>

<context>
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/.planning/STATE.md
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/.planning/ROADMAP.md
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/.planning/REQUIREMENTS.md
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/.planning/phases/05-order-payment-services/05-RESEARCH.md
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/.planning/phases/05-order-payment-services/05-PATTERNS.md
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/docs/kafka-topics.md
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/docs/api-contracts/orders-service.openapi.yaml
@C:/Users/shash/OneDrive/Desktop/PROJECTS/Ecommerce-Microservices-Platform/docs/api-contracts/_shared.yaml
# Analog templates to clone (read_first on each task references these exact files):
#   order-service <- services/auth-service/{pom.xml, Dockerfile, src/main/resources/application.yml,
#       src/main/java/com/ecommerce/auth/config/JwtConfig.java, config/SecurityConfig.java,
#       web/GlobalExceptionHandler.java, support/ApiError.java, web/AuthController.java,
#       security/RestAuthenticationEntryPoint.java, src/main/resources/db/migration/V1__create_users.sql}
#   payment-service <- services/catalog-service/{pyproject.toml, Dockerfile, app/config.py, app/main.py,
#       app/models.py, tests/conftest.py}
#   cart edges (already built) <- services/cart-service/src/routes/internal.js, routes/cart.js,
#       totals.js, config.js
#   composer additions reference existing docker-compose.yml (postgres/users, redis, cart-service)
</context>

<tasks>

<!-- ════════════════════════════════════════════════════════════════════════════
     WAVE 1 — TRACER: the thin order→payment saga, proven end-to-end on REAL Kafka
     ════════════════════════════════════════════════════════════════════════════ -->

<task type="tracer">
  <name>Wave 1 — Order→Payment saga skeleton wired end-to-end on real Kafka</name>
  <files>
    services/order-service/pom.xml
    services/order-service/Dockerfile
    services/order-service/src/main/resources/application.yml
    services/order-service/src/main/resources/db/migration/V1__create_orders.sql
    services/order-service/src/main/java/com/ecommerce/order/OrderServiceApplication.java
    services/order-service/src/main/java/com/ecommerce/order/config/JwtConfig.java
    services/order-service/src/main/java/com/ecommerce/order/config/SecurityConfig.java
    services/order-service/src/main/java/com/ecommerce/order/web/OrdersController.java
    services/order-service/src/main/java/com/ecommerce/order/web/GlobalExceptionHandler.java
    services/order-service/src/main/java/com/ecommerce/order/support/ApiError.java
    services/order-service/src/main/java/com/ecommerce/order/domain/Order.java
    services/order-service/src/main/java/com/ecommerce/order/domain/OrderRepository.java
    services/order-service/src/main/java/com/ecommerce/order/kafka/OrderEventProducer.java
    services/order-service/src/main/java/com/ecommerce/order/kafka/PaymentCompletedConsumer.java
    services/order-service/src/main/java/com/ecommerce/order/kafka/OrderCreatedPayload.java
    services/order-service/src/main/java/com/ecommerce/order/config/CartClient.java
    services/payment-service/pyproject.toml
    services/payment-service/Dockerfile
    services/payment-service/app/config.py
    services/payment-service/app/main.py
    services/payment-service/app/consumer.py
    services/payment-service/app/producer.py
    services/payment-service/app/models.py
    docker-compose.yml
    .env.example
    scripts/phase5-tracer-smoke.sh
  </files>
  <read_first>
    .planning/phases/05-order-payment-services/05-RESEARCH.md
    .planning/phases/05-order-payment-services/05-PATTERNS.md
    docs/kafka-topics.md
    docs/api-contracts/orders-service.openapi.yaml
    docs/api-contracts/_shared.yaml
    services/auth-service/pom.xml
    services/auth-service/Dockerfile
    services/auth-service/src/main/resources/application.yml
    services/auth-service/src/main/java/com/ecommerce/auth/config/JwtConfig.java
    services/auth-service/src/main/java/com/ecommerce/auth/config/SecurityConfig.java
    services/auth-service/src/main/java/com/ecommerce/auth/web/GlobalExceptionHandler.java
    services/auth-service/src/main/java/com/ecommerce/auth/support/ApiError.java
    services/auth-service/src/main/java/com/ecommerce/auth/web/AuthController.java
    services/auth-service/src/main/java/com/ecommerce/auth/security/RestAuthenticationEntryPoint.java
    services/auth-service/src/main/resources/db/migration/V1__create_users.sql
    services/catalog-service/pyproject.toml
    services/catalog-service/Dockerfile
    services/catalog-service/app/config.py
    services/catalog-service/app/main.py
    services/catalog-service/app/models.py
    services/cart-service/src/routes/internal.js
    services/cart-service/src/routes/cart.js
    services/cart-service/src/totals.js
    services/cart-service/src/config.js
    docker-compose.yml
  </read_first>
  <action>
    Build BOTH services as clones of their templates plus the Kafka plumbing and wire real Kafka
    into Compose, then prove the happy-path saga end-to-end.

    ORDER-SERVICE (clone auth-service, package com.ecommerce.order):
    - pom.xml: copy auth-service pom verbatim; change artifactId to order-service; ADD spring-kafka
      (Boot-managed 3.3.x) and spring-kafka-test + org.testcontainers:kafka (test scope). Keep all
      other deps (web, security, oauth2-resource-server, data-jpa, validation, flyway-core,
      flyway-database-postgresql, postgresql, actuator, testcontainers postgresql).
    - Dockerfile: copy auth-service Dockerfile; change EXPOSE 8081 -> 8082; header comment to order-service.
    - application.yml: copy auth-service application.yml; server.port=8082; datasource url ->
      ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/orders}; add spring.kafka block per
      RESEARCH Pattern 1 (bootstrap=${KAFKA_BOOTSTRAP_SERVERS:kafka:9092}, producer/consumer
      StringSerializer/Deserializer, consumer group-id=order-service, enable-auto-commit=false,
      auto-offset-reset=earliest); keep the jwt: block verbatim (HS256 verify).
    - JwtConfig.java / ApiError.java / RestAuthenticationEntryPoint: COPY auth-service files, change
      only the package to com.ecommerce.order. (A3 deviation: order-service self-verifies JWT; record
      in docs/runbook.md + service README "JWT holder (Phase 5, recorded for DOCS-02)".)
    - SecurityConfig.java: copy; drop the PasswordEncoder bean (no passwords stored); keep stateless
      chain + oauth2ResourceServer(jwt(Customizer.withDefaults()).authenticationEntryPoint(entryPoint));
      matchers: dispatcherTypeMatchers(ERROR).permitAll(); requestMatchers("/actuator/health","/health").permitAll();
      requestMatchers("/orders/**").authenticated(); anyRequest().denyAll().
    - Order.java: @Entity, fields orderId (String, unique), userId (String == sub), status enum
      PENDING_PAYMENT|PAID|PAYMENT_FAILED (default PENDING_PAYMENT), totalCents int (>=0),
      currency String default USD, createdAt timestamptz default now(); add boolean isTerminal()
      (PAID||PAYMENT_FAILED).
    - OrderRepository: JpaRepository<Order,Long> + findByOrderId(String) + findByUserIdOrderByCreatedAtDesc(String).
    - OrderCreatedPayload.java: record mirroring docs/kafka-topics.md order.created EXACTLY
      (eventId, orderId, userId, userEmail, items[]{productId,nameSnapshot,unitPriceCents,quantity},
      totalCents, currency, createdAt) with Jackson toJson().
    - OrderEventProducer.java: @Service with KafkaTemplate<String,String>; publishCreated(Order) sends
      "order.created" with key=orderId and value=payload.toJson().
    - PaymentCompletedConsumer.java: @KafkaListener(id="order-service", topics="payment.completed",
      groupId="order-service"); parse PaymentCompletedPayload; call orderService.applyPaymentResult
      (if order.isTerminal() return; else set PAID when outcome APPROVED else PAYMENT_FAILED; save).
      This IS the ORDR-04 terminal guard (hardened/tested in Wave 3).
    - CartClient.java: @Component WebClient (Boot auto-configured); method snapshot(userId, authHeader)
      GET {CART_SERVICE_URL:http://cart-service:3001}/cart/{userId} with header Authorization forward;
      maps the JSON (name->nameSnapshot, unitPriceCents, grandTotalCents->totalCents, currency) into
      an OrderSnapshot; throws EmptyCart when items empty. Method clear(authHeader) -> DELETE /cart
      forwarding the Authorization header (cart-service derives sub from token; order-service NEVER
      synthesizes userId).
    - OrdersController.java: @RestController; POST /orders (NO body) reads Idempotency-Key attribute
      (set by interceptor in Wave 2 — for the tracer, just read the header directly or accept any),
      recovers sub via Authentication#getName(), calls CartClient.snapshot(sub, authHeader) -> 400
      VALIDATION_FAILED if empty; builds Order (status PENDING_PAYMENT) and saves in a transaction,
      then publishes order.created, then calls CartClient.clear(authHeader); returns 201 + Location
      + OrderSnapshot. GET /orders -> OrderList (findByUserIdOrderByCreatedAtDesc -> summaries).
      GET /orders/{id} -> OrderSnapshot or 404 NOT_FOUND (never leak existence of others).
    - GlobalExceptionHandler.java: copy auth-service; add handlers reusing ApiError strings
      VALIDATION_FAILED / NOT_FOUND from _shared.yaml for empty-cart and unknown/other-owner order.
    - V1__create_orders.sql: copy V1__create_users.sql discipline (append-only Flyway); create orders
      (id bigserial PK, order_id varchar(64) NOT NULL, user_id varchar(64) NOT NULL, status
      varchar(20) NOT NULL DEFAULT 'PENDING_PAYMENT', total_cents integer NOT NULL CHECK(>=0),
      currency varchar(3) NOT NULL DEFAULT 'USD', created_at timestamptz NOT NULL DEFAULT now());
      CREATE UNIQUE INDEX orders_order_id_uniq ON orders(order_id). (idempotency_keys table added Wave 2.)

    PAYMENT-SERVICE (clone catalog-service, package app):
    - pyproject.toml: copy catalog-service; name=payment-service; ADD "aiokafka==0.14.0" and
      "redis>=5" to dependencies; keep fastapi[standard]==0.141.1, pydantic==2.13.4,
      pydantic-settings==2.15.0, PyJWT==2.13.0. Keep [tool.pytest.ini_options] asyncio_mode="auto".
    - Dockerfile: copy catalog-service; EXPOSE 8000 -> 8083; uvicorn --port 8083.
    - config.py: copy catalog-service config.py; ADD kafka_bootstrap_servers: str="kafka:9092",
      redis_url: str="redis://redis:6379/0", payment_mode: str="always_success" (always_success|
      always_fail|random). Keep extra="ignore".
    - models.py: copy catalog interop discipline (extra="ignore", Field(ge=0), iso_ms helper);
      define OrderCreated (eventId, orderId, userId, userEmail, items[], totalCents, currency,
      createdAt) and PaymentCompleted (eventId, orderId, outcome: APPROVED|DECLINED, reason:
      Optional[str]=None OMITTED on APPROVED, processedAt) — field names EXACTLY per docs/kafka-topics.md.
    - main.py: copy catalog lifespan envelope + _error_response + handlers verbatim; REPLACE the Mongo
      lifespan with a Kafka lifespan that starts AIOKafkaConsumer + AIOKafkaProducer (see consumer.py/
      producer.py) and shuts them down in finally. NO include_router (payment is Kafka-only).
    - consumer.py + producer.py: implement the RESEARCH Code Example loop — AIOKafkaConsumer
      "order.created" group_id="payment-service", auto_offset_reset="earliest",
      enable_auto_commit=False, value_deserializer=json.loads; AIOKafkaProducer value_serializer=json.dumps.
      For each msg: validate with OrderCreated model; run authorize(payment_mode) ->
      outcome APPROVED|DECLINED; build PaymentCompleted (reason None on APPROVED); producer.send_and_wait
      ("payment.completed", key=orderId, value=event); THEN await consumer.commit(). (Redis SETNX dedup
      added Wave 2 — tracer may double-authorize on redelivery; that is fine for the happy-path proof.)
    - app/__init__.py: ensure package marker exists.

    COMPOSE (docker-compose.yml): appended services, AFTER the existing postgres/redis/cart-service:
    - kafka: image apache/kafka:4.2.1; env KAFKA_NODE_ID=1, KAFKA_PROCESS_ROLES=broker,controller,
      KAFKA_CONTROLLER_QUORUM_VOTERS=1@kafka:29093, KAFKA_LISTENERS=PLAINTEXT://kafka:9092,
      CONTROLLER://kafka:29093, KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092,
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,
      KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER, KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT,
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1, KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1,
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1, KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0,
      KAFKA_AUTO_CREATE_TOPICS_ENABLE=false; healthcheck: kafka-topics.sh --bootstrap-server
      localhost:9092 --list; start_period 30s. NO zookeeper.
    - kafka-init: image apache/kafka:4.2.1; depends_on kafka healthy; restart: "no"; command
      sh -c creating order.created and payment.completed with --partitions 3 --replication-factor 1
      --if-not-exists via kafka-topics.sh --bootstrap-server kafka:9092.
    - orders-db-init: image postgres:18; depends_on postgres healthy; restart:"no"; command sh -c
      'psql -U $$POSTGRES_USER -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='"'"'orders'"'"'"
      | grep -q 1 || psql -U $$POSTGRES_USER -d postgres -c "CREATE DATABASE orders"'; env from
      POSTGRES_USER/POSTGRES_PASSWORD (idempotent — safe on long-lived volumes, RESEARCH Pitfall 4).
    - kafka-ui: image provectuslabs/kafka-ui:latest (read-only, dev-only); ports 8080:8080; env
      KAFKA_CLUSTERS_0_NAME=local, KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092; depends_on kafka.
    - order-service: build ./services/order-service; ports 8082:8082 (TRANSITIONAL — revoked in
      Phase 7 per A5 accepted debt; record in README); mem_limit 512m; env SPRING_DATASOURCE_URL=
      jdbc:postgresql://postgres:5432/orders, SPRING_DATASOURCE_USERNAME/PASSWORD from POSTGRES_*,
      SERVER_PORT=8082, KAFKA_BOOTSTRAP_SERVERS=kafka:9092, CART_SERVICE_URL=http://cart-service:3001,
      JWT_*; depends_on postgres healthy, kafka-init, cart-service healthy; healthcheck wget
      actuator/health grep UP, start_period 60s.
    - payment-service: build ./services/payment-service; ports 8083:8083 (transitional); mem_limit
      512m; env KAFKA_BOOTSTRAP_SERVERS=kafka:9092, REDIS_URL=redis://redis:6379/0,
      PAYMENT_MODE=${PAYMENT_MODE:-always_success}, JWT_* (harmless); depends_on kafka-init,
      redis healthy; healthcheck ps aux | grep -q '[u]vicorn'.
    - .env.example: add PAYMENT_MODE=always_success (if absent).

    scripts/phase5-tracer-smoke.sh: wait for order-service health; use auth-service to signup+login
    (mint a real bearer), add prod-1001 qty1 to cart via cart-service, POST /orders with a random
    16-char+ Idempotency-Key, then poll GET /orders/{id} until status terminal; also assert both
    topics are visible (kafka-ui REST or a kafka console consumer) — exit 0 only when order reaches
    PAID under PAYMENT_MODE=always_success.

    DEVIATIONS TO RECORD (in service READMEs + docs/runbook.md, not blocking): order-service is a JWT
    holder in Phase 5 (A3); order-service/payment-service expose transitional host ports (A5) revoked
    in Phase 7.
  </action>
  <verify>
    <automated>bash scripts/phase5-tracer-smoke.sh</automated>
  </verify>
  <done>
    Both services build and run in Compose; a real checkout produces order.created, payment-service
    consumes it and produces payment.completed, and the order transitions PENDING_PAYMENT -> PAID
    (visible in kafka-ui and via GET /orders/{id}); both topics exist with 3 partitions/RF=1.
    Acceptance governed by ORDR-01, ORDR-02, ORDR-03 (happy path), ORDR-04 (guard present), ORDR-07
    (endpoints return bodies).
  </done>
  <acceptance_criteria>
    - scripts/phase5-tracer-smoke.sh exits 0: order reaches PAID after a real checkout on real Kafka.
    - kafka-ui (or console consumer) shows 1+ message on order.created and 1+ on payment.completed.
    - GET /orders/{id} returns 200 with status PAID; GET /orders returns the order in the list.
    - docker compose ps shows kafka, kafka-init, orders-db-init, order-service, payment-service healthy/complete.
  </acceptance_criteria>
  <requirements>ORDR-01, ORDR-02, ORDR-03, ORDR-04, ORDR-07</requirements>
</task>

<!-- ════════════════════════════════════════════════════════════════════════════
     WAVE 2 — EXPANSION A: idempotency on both axes (HTTP replay + event redelivery)
     ════════════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Wave 2 — Idempotency: HTTP-replay key (ORDR-05) + payment Redis SETNX dedup (ORDR-03/08)</name>
  <files>
    services/order-service/src/main/java/com/ecommerce/order/domain/IdempotencyKey.java
    services/order-service/src/main/java/com/ecommerce/order/domain/IdempotencyRepository.java
    services/order-service/src/main/java/com/ecommerce/order/config/IdempotencyConfig.java
    services/order-service/src/main/java/com/ecommerce/order/web/IdempotencyInterceptor.java
    services/order-service/src/main/java/com/ecommerce/order/web/OrdersController.java
    services/order-service/src/main/java/com/ecommerce/order/web/GlobalExceptionHandler.java
    services/order-service/src/main/resources/db/migration/V1__create_orders.sql
    services/order-service/src/test/java/com/ecommerce/order/OrderSagaIntegrationTests.java
    services/order-service/src/test/resources/application-test.yml
    services/payment-service/app/consumer.py
    services/payment-service/tests/test_saga.py
    services/payment-service/tests/conftest.py
  </files>
  <read_first>
    .planning/phases/05-order-payment-services/05-RESEARCH.md
    .planning/phases/05-order-payment-services/05-PATTERNS.md
    docs/api-contracts/_shared.yaml
    docs/kafka-topics.md
    services/auth-service/src/main/java/com/ecommerce/auth/web/GlobalExceptionHandler.java
    services/auth-service/src/main/resources/db/migration/V1__create_users.sql
    services/order-service/src/main/java/com/ecommerce/order/web/OrdersController.java
    services/payment-service/app/consumer.py
    services/payment-service/app/config.py
  </read_first>
  <action>
    Add the two complementary idempotency mechanisms.

    ORDER-SERVICE (HTTP replay, D-05):
    - IdempotencyKey.java: @Entity key(varchar 255 PK, 16-255 enforced in app), orderId(varchar 64),
      createdAt timestamptz default now(). Add CREATE TABLE idempotency_keys(...) to V1__create_orders.sql
      (append — Flyway append-only; keep V1 as one file with both tables).
    - IdempotencyRepository: JpaRepository<IdempotencyKey,String> + findByKey(String).
    - IdempotencyInterceptor.java (HandlerInterceptor): preHandle reads "Idempotency-Key"; if missing or
      length<16 or >255 -> write 400 VALIDATION_FAILED envelope and return false; if findByKey present ->
      write 200 + stored OrderSnapshot (from the order_id) and return false (no controller run, no event,
      no cart clear); else bind key to request attribute and return true. afterCompletion: on a 201
      response, insert IdempotencyKey(key, orderId) in the SAME transaction as the order insert (the
      controller publishes order.created only after this persists). Unique constraint on key is the
      race-safe backstop -> on DataIntegrityViolationException emit 409 CONFLICT/DUPLICATE-style envelope.
    - IdempotencyConfig.java: @Configuration implements WebMvcConfigurer; addInterceptors registers
      IdempotencyInterceptor on "/orders" (POST only path).
    - OrdersController: move Idempotency-Key reading to the interceptor; after successful 201 persist,
      the interceptor stores the mapping. Return 201 on create, 200 on replay (interceptor short-circuit).
    - GlobalExceptionHandler: add a handler for the duplicate-key backstop reusing ApiError("CONFLICT",
      "...")-style code (acceptable per _shared.yaml Conflict example) — keep message non-leaking.

    PAYMENT-SERVICE (event redelivery dedup, ORDR-03/08):
    - consumer.py: before authorize, open a redis.asyncio connection from settings.redis_url; attempt
      SET payment:authorized:{orderId} {outcome-placeholder} NX (SETNX). If the key already exists ->
      skip authorize AND skip produce (the prior delivery already produced payment.completed). Only when
      SETNX returns True, run authorize() and produce. This survives container restart (Redis persists
      across payment-service restart). Keep manual commit AFTER produce.

    TESTS (Wave-0, nyquist): OrderSagaIntegrationTests using spring-kafka-test EmbeddedKafka +
    Testcontainers PostgreSQL (application-test.yml) covering: (a) full saga order.created->payment.completed
    -> PAID; (b) replay same Idempotency-Key returns the SAME order (200, original orderId, no 2nd row);
    (c) redelivered payment.completed for a terminal order is a no-op. payment-service tests/test_saga.py
    (pytest, asyncio_mode=auto, Testcontainers Kafka or shared broker) covering: (a) consume order.created
    produces payment.completed with correct outcome per PAYMENT_MODE; (b) a 2nd delivery of the SAME
    order.created does NOT produce a 2nd payment.completed (SETNX). conftest.py: KafkaContainer
    apache/kafka:4.2.1 + ASGI client + HS256 auth_token mint (copy catalog conftest shape).
  </action>
  <verify>
    <automated>cd services/order-service && ./mvnw -q test</automated>
    <automated>cd services/payment-service && uv run pytest -q</automated>
  </verify>
  <done>
    Replaying POST /orders with the same Idempotency-Key returns 200 + the original order and creates
    no duplicate; a redelivered order.created in payment-service is a no-op (SETNX); redelivered
    payment.completed for a terminal order is ignored. Both `./mvnw -q test` and `uv run pytest -q` green.
  </done>
  <acceptance_criteria>
    - order-service test: two POST /orders with identical Idempotency-Key -> second response 200 and
      exactly one orders row for that key (idempotency_keys row present).
    - order-service test: publishing payment.completed twice for a PAID order leaves status PAID (no flip).
    - payment-service test: feeding the same order.created twice yields exactly one payment.completed on
      the topic (Redis SETNX blocks the second authorize+produce).
    - ./mvnw -q test and uv run pytest -q both exit 0.
  </acceptance_criteria>
  <requirements>ORDR-03, ORDR-04, ORDR-05</requirements>
</task>

<!-- ════════════════════════════════════════════════════════════════════════════
     WAVE 2 — EXPANSION B: cart clear + ownership/IDOR + terminal-guard hardening
     ════════════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Wave 2 — Cart clear after checkout (ORDR-06) + order history/detail ownership 404 (ORDR-07)</name>
  <files>
    services/order-service/src/main/java/com/ecommerce/order/web/OrdersController.java
    services/order-service/src/main/java/com/ecommerce/order/config/CartClient.java
    services/order-service/src/main/java/com/ecommerce/order/kafka/PaymentCompletedConsumer.java
    services/order-service/src/main/java/com/ecommerce/order/web/GlobalExceptionHandler.java
    services/order-service/src/test/java/com/ecommerce/order/OrderSagaIntegrationTests.java
    services/order-service/src/test/resources/application-test.yml
    services/order-service/README.md
    docs/runbook.md
  </files>
  <read_first>
    .planning/phases/05-order-payment-services/05-RESEARCH.md
    docs/api-contracts/orders-service.openapi.yaml
    services/cart-service/src/routes/cart.js
    services/order-service/src/main/java/com/ecommerce/order/web/OrdersController.java
    services/order-service/src/main/java/com/ecommerce/order/config/CartClient.java
    services/order-service/src/main/java/com/ecommerce/order/kafka/PaymentCompletedConsumer.java
  </read_first>
  <action>
    Complete the remaining ORDR-06/ORDR-07 behaviors and lock the IDOR mitigation.

    - CartClient.clear(authHeader): already forwards Authorization to DELETE /cart (cart-service derives
      sub from token, returns 204 even if empty). Ensure OrdersController calls clear(authHeader) AFTER
      the order.created publish succeeds (so a failed publish does not wipe the cart) — i.e. clear on the
      PENDING_PAYMENT commit path, not before. If DELETE returns non-2xx, log and continue (do not fail
      the order; the saga already completed). This satisfies ORDR-06 (cart cleared after successful checkout).
    - OrdersController GET /orders: return OrderList filtered SERVER-SIDE by sub (findByUserIdOrderBy
      CreatedAtDesc) — client cannot widen. GET /orders/{id}: load by orderId; if not found OR
      order.userId != sub -> 404 NOT_FOUND (identical handling, no existence leak — IDOR mitigation,
      ASVS V4). Return OrderSnapshot including current status (the polling contract field).
    - PaymentCompletedConsumer.applyPaymentResult: make the terminal guard explicit and the single
      source of idempotency — if order.getStatus().isTerminal() return immediately (ack+ignore); else
      set PAID on APPROVED, PAYMENT_FAILED on DECLINED; save. No transition out of terminal states.
    - GlobalExceptionHandler: ensure unknown/other-owner order -> ApiError("NOT_FOUND", "The requested
      resource was not found.") (exact _shared.yaml string).
    - Tests: extend OrderSagaIntegrationTests — (a) after a successful checkout the cart GET returns an
      empty items list (cart cleared); (b) GET /orders/{otherUserOrderId} with user A's token -> 404;
      (c) GET /orders lists only the caller's orders; (d) DECLINED path flips PENDING_PAYMENT ->
      PAYMENT_FAILED and is terminal.
    - README (order-service) + docs/runbook.md: record the two accepted deviations — order-service is a
      JWT holder in Phase 5 (A3) and the 8082 transitional port is revoked in Phase 7 (A5) — under a
      "Phase 5 deviations (DOCS-02)" section so a new engineer understands the standing posture.
  </action>
  <verify>
    <automated>cd services/order-service && ./mvnw -q test</automated>
  </verify>
  <done>
    Cart is cleared after a successful checkout (observable: cart GET empty post-checkout); order
    history lists only the caller's orders; GET /orders/{id} for another user is 404 (no leak);
    DECLINED path terminates at PAYMENT_FAILED and redelivery is a no-op. Devitations recorded in README
    + runbook.
  </done>
  <acceptance_criteria>
    - order-service test: after checkout, CartClient snapshot for that user returns empty items.
    - order-service test: GET /orders/{id} with a different sub's token returns 404 (status 404).
    - order-service test: PAYMENT_MODE=always_fail yields PAYMENT_FAILED and a second payment.completed
      does not change it.
    - ./mvnw -q test exits 0.
  </acceptance_criteria>
  <requirements>ORDR-04, ORDR-06, ORDR-07</requirements>
</task>

<!-- ════════════════════════════════════════════════════════════════════════════
     WAVE 3 — Redelivery crash-proof (ORDR-08) + full suites + coverage/runbook
     ════════════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Wave 3 — ORDR-08 kill/restart redelivery proof + full suite gate + coverage/runbook</name>
  <files>
    scripts/phase5-kill-test.sh
    services/payment-service/tests/test_saga.py
    services/order-service/src/test/java/com/ecommerce/order/OrderSagaIntegrationTests.java
    .planning/phases/05-order-payment-services/COVERAGE.md
    docs/runbook.md
    services/order-service/README.md
    services/payment-service/README.md
  </files>
  <read_first>
    .planning/phases/05-order-payment-services/05-RESEARCH.md
    .planning/phases/05-order-payment-services/COVERAGE.md
    docs/kafka-topics.md
    services/order-service/src/main/java/com/ecommerce/order/kafka/PaymentCompletedConsumer.java
    services/payment-service/app/consumer.py
  </read_first>
  <action>
    Demonstrate at-least-once redelivery (ORDR-08), then seal the phase.

    - scripts/phase5-kill-test.sh: bring Compose up (kafka, kafka-init, postgres, orders-db-init,
      redis, cart-service, catalog-service, auth-service, order-service, payment-service). Signup+login,
      add to cart, POST /orders with an Idempotency-Key. IMMEDIATELY `docker compose kill payment-service`
      after the order is PENDING_PAYMENT (poll GET /orders/{id} == PENDING_PAYMENT, then kill). Then
      `docker compose start payment-service`; poll GET /orders/{id} until it reaches a terminal state
      (PAID under always_success). Assert via kafka-ui (or a console consumer on payment.completed) that
      the order.created was redelivered and exactly one terminal outcome resulted. Exit 0 on convergence.
      Document that this same assertion is folded into the Phase 9 smoke test.
    - Finalize tests: ensure payment-service test_saga.py and order-service OrderSagaIntegrationTests
      together cover the saga, idempotency (HTTP + Kafka), terminal guard, cart-clear, and ownership 404
      (prior waves created the cores; this task confirms the full set is green and adds any missing case).
    - Confirm COVERAGE.md (already written in this phase dir) is present and accurate; if any surface
      changed, update it. Add a one-line pointer in docs/runbook.md under "Phase 5" referencing the
      kill-test script and the JWT-holder / transitional-port deviations (DOCS-02).
    - Service READMEs: short "What this service does + how to run + deviations" so the phase is
      self-documenting.
  </action>
  <verify>
    <automated>bash scripts/phase5-kill-test.sh</automated>
    <automated>cd services/order-service && ./mvnw -q test</automated>
    <automated>cd services/payment-service && uv run pytest -q</automated>
  </verify>
  <done>
    ORDR-08 demonstrated: killing payment-service mid-flow and restarting converges to the correct
    terminal state via broker redelivery; full unit/integration suites for both services are green;
    COVERAGE.md + runbook + READMEs record the integration surface and deviations.
  </done>
  <acceptance_criteria>
    - phase5-kill-test.sh exits 0: order reaches PAID after payment-service is killed and restarted.
    - order-service ./mvnw -q test exits 0 with saga + idempotency + terminal-guard + cart-clear +
      ownership-404 cases present.
    - payment-service uv run pytest -q exits 0 with SETNX-dedup + PAYMENT_MODE outcome cases present.
    - COVERAGE.md exists in .planning/phases/05-order-payment-services/ and matches implemented surfaces.
  </acceptance_criteria>
  <requirements>ORDR-03, ORDR-04, ORDR-08</requirements>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → order-service | Untrusted JWT-bearing requests; order-service is the public (transitional) ingress for /orders. |
| order-service → cart-service | Internal network call; order-service forwards the caller's bearer token (no synthesized identity). |
| Client/Cart → Kafka broker | Events are the system of record trigger; consumers must not trust payloads blindly. |
| payment-service → Redis | Dedup store; a poisoned key must not crash the worker. |

## STRIDE Threat Register (ASVS L1, block_on=high)

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05-01 | Spoofing | order-service JWT verification | high | mitigate | Copy auth-service `JwtConfig` (MAC-only HS256, iss=ecommerce-auth, aud=ecommerce-api, ±60s skew, alg-swap rejected). All /orders routes `authenticated()`. (A3 deviation recorded, not a weakness.) |
| T-05-02 | Elevation (IDOR) | GET /orders/{id} | high | mitigate | Server-side filter by verified `sub`; unknown OR other-owner → identical 404 (no existence leak). ASVS V4. |
| T-05-03 | Tampering | Replayed checkout body | medium | mitigate | `Idempotency-Key` (16–255) + unique `idempotency_keys.key`; replay returns original order, no re-run. ASVS V5. |
| T-05-04 | Tampering | Poison Kafka message | medium | mitigate | Validate every payload against pydantic (payment) / Jackson (order) models; on parse failure log + skip (contract: poison messages logged and skipped). Never crash the consumer. |
| T-05-05 | Tampering | Double mock-authorization on redelivery | high | mitigate | payment-service Redis `SETNX payment:authorized:{orderId}` before authorize; redelivery is a no-op. ORDR-03/08. |
| T-05-06 | Info disclosure | `reason` echoed to user's own email | low | accept | kafka-topics.md disposition: decline reason to the user's OWN address is the feature; no third parties. Documented. |
| T-05-SC | Tampering | Maven/PyPI package installs | high | mitigate | Package Legitimacy Audit (05-RESEARCH.md) approved all pins from `docs/versions.md`; SUS verdicts are telemetry-only. No new human checkpoint beyond versions.md governance. |

**Blocking note:** T-05-01, T-05-02, and T-05-05 are HIGH and are fully mitigated by the plan (JwtConfig, sub-filter 404, Redis SETNX). No high-severity threat is left unmitigated, so the plan passes `security_block_on=high`.
</threat_model>

<verification>
Phase gate (before /gsd-verify-work):
1. `bash scripts/phase5-tracer-smoke.sh` — real-Kafka happy path to PAID (Wave 1).
2. `cd services/order-service && ./mvnw -q test` — saga + idempotency + terminal guard + cart-clear + ownership 404 green.
3. `cd services/payment-service && uv run pytest -q` — SETNX dedup + PAYMENT_MODE outcome green.
4. `bash scripts/phase5-kill-test.sh` — ORDR-08 convergence after payment-service kill/restart.
5. Manual: open kafka-ui :8080, confirm order.created / payment.completed present with 3 partitions, RF=1.
</verification>

<success_criteria>
The phase is complete when ALL of:
- [ ] Checkout snapshots cart items + prices, persists to Postgres, and produces order.created (ORDR-01, ORDR-02).
- [ ] payment-service consumes order.created, runs PAYMENT_MODE mock, produces payment.completed; order-service transitions PENDING_PAYMENT→PAID|PAYMENT_FAILED under a terminal guard (ORDR-03, ORDR-04).
- [ ] Replaying POST /orders with the same Idempotency-Key returns the original order (200), no duplicate (ORDR-05).
- [ ] Killing + restarting payment-service mid-flow still converges to the correct terminal state (ORDR-08).
- [ ] Cart is cleared after successful checkout; user can list history and fetch order detail for polling, with 404-on-other-owner (ORDR-06, ORDR-07).
- [ ] Kafka is in Compose (KRaft, no ZooKeeper), topics provisioned by kafka-init (3 partitions, RF=1), kafka-ui present, both services build and run.
- [ ] COVERAGE.md enumerates all external integrations; threat model has no unmitigated HIGH.
</success_criteria>

<output>
Create `.planning/phases/05-order-payment-services/05-PLAN.md` (this file) and
`.planning/phases/05-order-payment-services/COVERAGE.md` (already written). After execution,
the executor creates `.planning/phases/05-order-payment-services/05-01-SUMMARY.md` summarizing
what was built and the verification results.
</output>
