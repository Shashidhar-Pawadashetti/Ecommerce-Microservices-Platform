# Ecommerce Microservices Platform

## What This Is

A production-grade, polyglot e-commerce web application built as independently containerizable microservices, running locally via Docker Compose. Seven backend services (Java/Spring Boot, Python/FastAPI, Node.js/Express) communicate via a Spring Cloud Gateway and Kafka event bus over three datastore types (PostgreSQL, MongoDB, Redis), with a Next.js frontend. Built to serve later as the stable deployment target for a separate DevOps learning arc (Kubernetes, CI/CD, observability).

## Core Value

A complete end-to-end purchase journey — signup → browse products → add to cart → checkout → payment → order status update → notification — working across all services through the gateway, verified by `docker compose up` plus a scripted smoke test.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Contracts first: OpenAPI specs for every REST endpoint + Kafka topic contracts (`order.created`, `payment.completed`) under `docs/`
- [ ] Auth Service (Java/Spring Boot): signup, login, JWT issue/verify, `/me`; PostgreSQL users table; multi-stage Dockerfile
- [ ] Catalog Service (Python/FastAPI): product CRUD, category filter, text search; MongoDB `products`; ~20-product seed script
- [ ] Cart Service (Node/Express): add/remove/update items, session carts in Redis keyed `cart:{userId}` with TTL; validates product IDs/prices against Catalog
- [ ] Order Service (Java/Spring Kafka): create order from cart, persist to Postgres, produce `order.created`, consume `payment.completed` to update status
- [ ] Payment Service (Python/FastAPI + aiokafka): consume `order.created`, mock authorization, produce `payment.completed`
- [ ] Notification Service (Node worker/kafkajs): consume both topics, log + send mock email via Mailhog
- [ ] API Gateway (Spring Cloud Gateway): route `/auth/**`, `/catalog/**`, `/cart/**`, `/orders/**`; JWT validation filter on protected routes; downstream services unreachable from outside Docker network
- [ ] Frontend (Next.js): browse, cart, checkout, order history; server components/API routes through gateway; JWT in httpOnly cookie
- [ ] Local orchestration: docker-compose wiring all services + Postgres + MongoDB + Redis + Kafka (KRaft) + Mailhog + Kafka UI; per-service healthchecks; scripted E2E smoke test passes
- [ ] Handoff docs: finalized architecture diagram, runbook (run/reset/failure modes)

### Out of Scope

- Kubernetes manifests / Helm charts — deliberately deferred to follow-on DevOps project
- CI/CD pipelines (GitHub Actions) — same follow-on arc
- Observability stack (Prometheus/Grafana, tracing, lag monitoring) — same follow-on arc
- Secrets management (Vault), network policies, service mesh — same follow-on arc
- Schema Registry / Avro — JSON contracts suffice for v1; stricter contracts are a later exercise
- Production-grade auth (OAuth2/OIDC provider) — JWT issuing is sufficient for this scope
- Real payment processing — mock authorization only, by design

## Context

- **Learning-oriented**: the app itself is the deliverable; its heterogeneity (3 languages, 3 build toolchains, 3 datastores, sync REST + async Kafka) is intentional — it makes later containerization/orchestration/CI genuinely challenging.
- **Contracts-first strategy is non-negotiable**: with no shared type system across Java/Python/Node, OpenAPI specs and Kafka topic schemas are the only drift guard between independent milestones.
- **Monorepo layout**: one self-contained folder per service under `services/`, each with own Dockerfile, dependency manifest, tests, `.env.example`. Compose grows incrementally — each service joins Compose right after its milestone ships.
- **Verification standard**: "verify" means container builds, runs standalone, passes curl/Postman smoke test — and for Kafka services, an observed message round-trip. Not just "code compiles."
- **Follow-on plan exists**: `ecommerce-microservices-build-plan.md` at repo root is the source document.

## Constraints

- **Tech stack (pinned)**: Java/Spring Boot 3.x + Maven (api-gateway, auth-service, order-service); Python/FastAPI + Pydantic v2 (catalog-service, payment-service); Node.js/Express (cart-service); Node worker + kafkajs (notification-service); Next.js frontend; Apache Kafka KRaft mode (no ZooKeeper)
- **Versions**: exact framework versions pinned at planning time per phase — latest stable, researched then locked so plans don't drift across milestones
- **Runtime**: local Docker Compose only; single-broker Kafka
- **Datastores fixed per service**: PostgreSQL (users, orders), MongoDB (products), Redis (carts) — no swapping

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Maven over Gradle for Java services | Most common in enterprise Spring shops; predictable POMs; best Spring Boot docs support | — Pending |
| Single milestone v1.0 containing all 11 phases | Plan's per-phase Discuss→Plan→Execute→Verify loop maps naturally onto GSD phases; less ceremony than split milestones | — Pending |
| Pin latest stable versions during phase planning | Prevents version drift across independent, fresh-context milestones in three languages | — Pending |
| Contracts-first (Phase 1 before any service code) | Only drift guard available across polyglot services without shared types | — Pending |
| Monorepo, one folder per service | Easiest for Docker Compose, future Helm values-per-service, CI matrix builds | — Pending |
| Incremental docker-compose growth | Each service integrates immediately after shipping; Kafka broker+producer+consumer proven in Phase 5 before more consumers | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-24 after initialization*
