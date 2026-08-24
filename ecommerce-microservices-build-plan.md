# E-Commerce Microservices — Build & Execute Plan

**Scope of this plan:** build a working, containerized, polyglot e-commerce microservice application that runs locally via Docker Compose. This is the "ready-made app" you'll later deploy/operate to learn DevOps (K8s, CI/CD, observability, etc. are a *separate* follow-on project — not covered here).

**Toolchain:** OpenCode + GSD Core, using the Discuss → Plan → Execute → Verify → Ship loop, one milestone per service.

**Stack:** Java (Spring Boot), Python (FastAPI), JavaScript/Node.js, Apache Kafka, Next.js.

---

## 1. Architecture Overview

```
                        ┌──────────────┐
                        │   Frontend   │  (Phase 8)
                        │   Next.js    │
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                        │  API Gateway │  (Spring Cloud Gateway)
                        └──────┬───────┘
        ┌───────────┬─────────┼─────────┬───────────┬────────────┐
   ┌────▼───┐  ┌─────▼────┐ ┌─▼──────┐ ┌▼────────┐ ┌▼─────────┐ ┌▼───────────┐
   │  Auth  │  │ Catalog  │ │  Cart  │ │  Order  │ │ Payment  │ │Notification│
   │ Service│  │ Service  │ │Service │ │ Service │ │ Service  │ │  Service   │
   │ (Java) │  │ (Python) │ │(Node)  │ │ (Java)  │ │(Python)  │ │  (Node)    │
   └───┬────┘  └────┬─────┘ └───┬────┘ └────┬────┘ └────┬─────┘ └─────┬──────┘
       │            │           │           │           │             │
   Postgres      MongoDB      Redis      Postgres    (stateless,   (consumes
   (users)      (products)   (cart/     (orders)      mock          events)
                              session)                processor)
                                              │           ▲             ▲
                                              └───────────┴─────────────┘
                                                    Kafka (event bus)
                                        topics: order.created, payment.completed
```

**Why this shape:** genuinely polyglot (JVM, Python, Node), 3 different datastore types, sync REST *and* async event streaming via Kafka, a gateway, and a stateless service — enough real-world surface area to make containerization, orchestration, and CI meaningfully hard, without being so large it takes weeks to build.

### Services & responsibilities

| Service | Responsibility | Stack | Datastore |
|---|---|---|---|
| API Gateway | Single entry point, routing, JWT check, rate limiting | Java + Spring Cloud Gateway | — |
| Auth Service | Signup/login, JWT issuing, user profile | Java + Spring Boot | PostgreSQL |
| Catalog Service | Product CRUD, search, categories | Python + FastAPI | MongoDB |
| Cart Service | Add/remove/update item, session cart | Node.js + Express | Redis |
| Order Service | Create order, order history, produces `order.created` | Java + Spring Boot (Spring Kafka) | PostgreSQL |
| Payment Service | Consumes `order.created`, mock authorization, produces `payment.completed` | Python + FastAPI (confluent-kafka / aiokafka) | stateless |
| Notification Service | Consumes `order.created` / `payment.completed`, logs/sends mock email | Node.js worker (kafkajs) + Mailhog | — |
| Event Bus | Async decoupling between Order/Payment/Notification | Apache Kafka (KRaft mode — no ZooKeeper needed) | — |
| Frontend | Browse, cart, checkout, order history | Next.js (React) | — |

**Language split rationale:** Java/Spring Boot for the two most "enterprise-transactional" services (Auth, Order — where you'd realistically see Spring in industry), Python/FastAPI for the two I/O-bound, rapid-iteration services (Catalog, Payment), Node for the two lightweight event-driven/stateless pieces (Cart, Notification, plus the Kafka consumer ergonomics of kafkajs). This gives you three distinct build toolchains (Maven/Gradle, pip/poetry, npm) and three distinct container base-image families — exactly the kind of heterogeneity you'll face in a real polyglot shop, and a much richer target for later CI matrix builds and K8s resource tuning per runtime.

---

## 2. Repo Strategy

**Monorepo**, one top-level folder per service — this is the easiest structure for Docker Compose, later Helm values-per-service, and CI matrix builds across three different build systems.

```
ecommerce-microservices/
├── services/
│   ├── api-gateway/        # Java, Spring Cloud Gateway (Maven/Gradle)
│   ├── auth-service/       # Java, Spring Boot (Maven/Gradle)
│   ├── catalog-service/    # Python, FastAPI (poetry/pip)
│   ├── cart-service/       # Node.js, Express (npm)
│   ├── order-service/      # Java, Spring Boot (Maven/Gradle)
│   ├── payment-service/    # Python, FastAPI (poetry/pip)
│   └── notification-service/  # Node.js worker (npm)
├── frontend/                # Next.js
├── docker-compose.yml
├── docker-compose.override.yml   # local dev overrides (hot reload, etc.)
├── .env.example
├── docs/
│   ├── architecture.md
│   ├── api-contracts/       # OpenAPI specs per service
│   └── kafka-topics.md      # event schemas / topic contracts
└── README.md
```

Each service folder is self-contained: its own `Dockerfile`, dependency manifest (`pom.xml`/`build.gradle`, `pyproject.toml`, `package.json`), `src/`, `tests/`, `.env.example`.

---

## 3. Build Phases (GSD Core milestones)

Run each phase as its own GSD milestone: `/gsd-new-project` once at the start, then within it treat each numbered phase below as a milestone going through Discuss → Plan → Execute → Verify → Ship.

### Phase 0 — Project Initialization
- `npx @opengsd/gsd-core@latest --opencode --local` in the repo root
- `/gsd-new-project` → describe the system from Section 1 as your CONTEXT.md seed, including the per-service language assignment so GSD's planner respects it
- Set up root `README.md`, `.gitignore`, `.env.example`, empty `services/` tree
- **Verify:** repo scaffolds cleanly, GSD commands available in OpenCode

### Phase 1 — Contracts First
- Write OpenAPI specs for every REST endpoint each service will expose
- Write Kafka topic contracts in `docs/kafka-topics.md`: topic name, key, JSON schema (or Avro if you want schema-registry practice later), producer, consumer(s) — for `order.created` and `payment.completed`
- This gives every later milestone a fixed contract to build against — critical when different milestones are different languages, since there's no shared type system to catch drift for you
- **Verify:** contracts reviewed and committed under `docs/api-contracts/` and `docs/kafka-topics.md`

### Phase 2 — Auth Service (Java / Spring Boot)
- Signup, login, JWT issue/verify, `/me` endpoint
- Spring Data JPA + PostgreSQL: `users(id, email, password_hash, created_at)`
- Multi-stage Dockerfile (Maven/Gradle build stage → slim JRE runtime stage)
- **Verify:** `docker build` succeeds; container runs standalone; curl/Postman smoke test passes; unit tests green

### Phase 3 — Catalog Service (Python / FastAPI)
- Product CRUD, category filter, simple text search
- Motor/PyMongo + MongoDB collection: `products`
- Seed script with ~20 sample products; Pydantic models matching the OpenAPI contract
- **Verify:** seed script populates data; list/search endpoints return expected results; `docker build` produces a slim image (python:slim base)

### Phase 4 — Cart Service (Node.js / Express)
- Add/remove/update item, get cart by user/session
- Redis keyed by `cart:{userId}`, TTL for abandoned carts
- Calls Catalog Service internally (REST) to validate product IDs/prices
- **Verify:** cart persists across requests; TTL expiry observable

### Phase 5 — Order + Payment Services (Java + Python, via Kafka)
- Order Service (Spring Boot + Spring Kafka): create order from cart, persist to Postgres, produce `order.created`
- Payment Service (FastAPI + confluent-kafka): consume `order.created`, run a mock authorization (random success/fail is fine), produce `payment.completed`
- Order Service consumes `payment.completed` to update order status
- Set up Kafka topics with sensible partitions (e.g., 3) and consumer groups per service
- **Verify:** end-to-end message flow observed via `kafka-console-consumer` or Kafka UI (e.g., Kafdrop/Redpanda Console); order status transitions correctly; test consumer offset/redelivery behavior by killing and restarting Payment Service mid-flow

### Phase 6 — Notification Service (Node.js worker, kafkajs)
- Consumes `order.created` and `payment.completed` as a Kafka consumer group
- Logs to console + sends to Mailhog (local fake SMTP, its own Docker container)
- **Verify:** events trigger visible notification output; consumer group lag stays at 0 under normal load

### Phase 7 — API Gateway (Java / Spring Cloud Gateway)
- Route `/auth/**`, `/catalog/**`, `/cart/**`, `/orders/**` to the right service
- JWT validation filter at the gateway for protected routes
- **Verify:** all downstream services reachable only through the gateway from "outside" the Docker network

### Phase 8 — Frontend (Next.js)
- Browse products, add to cart, checkout, view order history
- Server components/API routes calling the gateway; JWT stored appropriately (httpOnly cookie recommended)
- **Verify:** full user journey works against the running backend

### Phase 9 — Local Orchestration
- `docker-compose.yml` wiring all services + Postgres + MongoDB + Redis + Kafka (KRaft, single-broker) + Mailhog + Kafdrop/Redpanda Console (Kafka UI)
- Health checks (`healthcheck:` blocks) per service — note JVM services take longer to become ready, so tune `start_period` accordingly
- **Verify:** `docker compose up` brings the entire system up cleanly; run a scripted end-to-end smoke test (signup → browse → add to cart → checkout → see order paid → see notification logged)

### Phase 10 — Handoff Documentation
- `docs/architecture.md` finalized diagram + service contracts + Kafka topic map
- `docs/runbook.md`: how to run locally, how to reset data/topics, common failure modes (e.g., JVM services OOMing on low-memory dev machines, Kafka needing `KAFKA_ADVERTISED_LISTENERS` set correctly for Docker networking)
- This becomes your baseline for the *next* project phase: containerization hardening, Kubernetes, CI/CD, observability, and security — done deliberately as separate learning milestones once this app is stable

---

## 4. Execution Notes for Using OpenCode + GSD Core

- Treat **Phase 1 (contracts)** as non-negotiable — with three different languages in play, the contracts (REST + Kafka schemas) are the only thing keeping services interoperable across independent, fresh-context milestones.
- Build **one service per milestone**, in the dependency order above (Auth → Catalog → Cart → Order/Payment → Notification → Gateway → Frontend) so each service can be smoke-tested standalone before it's wired into Compose.
- When prompting GSD's Discuss step for a Java or Python milestone, explicitly state the framework version you want pinned (e.g., Spring Boot 3.x, FastAPI + Pydantic v2) so the plan step doesn't guess and drift between milestones.
- Use GSD's Verify step strictly — for this project "verify" should mean "container builds, runs standalone, and passes a curl/Postman smoke test (and, for Kafka-connected services, an observed message round-trip)," not just "code compiles."
- Keep `docker-compose.yml` growing incrementally — add each service to Compose right after its milestone ships, rather than deferring integration to the very end. This is especially important for Kafka: get the broker + one producer + one consumer working in Compose in Phase 5 before adding more consumers in Phase 6.

---

## 5. What's Deliberately Excluded (future project)

- Kubernetes manifests / Helm charts
- CI/CD pipelines (GitHub Actions), including per-language build matrices
- Observability stack (Prometheus/Grafana, distributed tracing across JVM/Python/Node, Kafka lag monitoring)
- Secrets management (Vault), network policies, service mesh
- Schema Registry / Avro (if you want stricter Kafka contracts later) and production-grade auth (OAuth2/OIDC provider)

These are exactly the skills you said you want to practice — this plan intentionally stops at "a real, runnable, well-contracted, polyglot microservice app in Docker Compose" so that everything above becomes its own dedicated DevOps learning arc against a stable target.
