# Requirements: Ecommerce Microservices Platform

**Defined:** 2026-08-24
**Core Value:** A complete end-to-end purchase journey — signup → browse → cart → checkout → payment → order status update → notification — working across all services through the gateway, verified by `docker compose up` plus a scripted smoke test.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Contracts & Scaffolding

- [x] **CONTR-01**: OpenAPI specs exist for every REST endpoint each service will expose, committed under `docs/api-contracts/` before any service code
- [x] **CONTR-02**: Kafka topic contracts defined in `docs/kafka-topics.md`: `order.created` and `payment.completed` (single topic carrying `outcome: APPROVED|DECLINED`), with key, JSON schema, producer, consumers, dedup/idempotency fields, and email content payload
- [x] **CONTR-03**: Cross-language JSON interop conventions documented: ISO 8601 dates, integer-cents money, string IDs, unknown-fields-ignored policy
- [x] **CONTR-04**: Monorepo scaffolding exists: `services/` tree, `.gitattributes` enforcing LF (Windows CRLF guard), root README, `.env.example`
- [x] **CONTR-05**: Pinned version manifest recorded (Spring Boot 3.5.x + Cloud 2025.0.x/JDK 21, FastAPI/Pydantic 2, Node LTS, Kafka 4.x, Postgres 18, Mongo 8, Redis 8, Next.js stable) so fresh-context milestones don't drift

### Authentication

- [x] **AUTH-01**: User can sign up with email/password (unique email enforced, password stored hashed)
- [ ] **AUTH-02**: User can log in with valid credentials and receive a signed JWT
- [ ] **AUTH-03**: Authenticated user can retrieve their own profile via `/me`
- [ ] **AUTH-04**: User can log out (client-side token discard; no server revocation in v1)

### Catalog

- [ ] **CAT-01**: Visitor can browse the product listing without logging in
- [ ] **CAT-02**: Visitor can view a single product's detail page backed by `GET /catalog/products/{id}`
- [ ] **CAT-03**: Visitor can filter the catalog by category
- [ ] **CAT-04**: Visitor can search products by text query (with basic sort by price/name)
- [ ] **CAT-05**: Seed script populates ~20 realistic products including bundled placeholder images
- [ ] **CAT-06**: Products can be created/updated/deleted via authenticated API calls (Swagger-driven; no admin UI)

### Cart

- [ ] **CART-01**: Logged-in user can add an item to their cart (product ID + quantity validated against Catalog)
- [ ] **CART-02**: User can update quantities and remove items; line and grand totals computed server-side from live Catalog prices
- [ ] **CART-03**: Cart persists across sessions, keyed `cart:{userId}` in Redis
- [ ] **CART-04**: Abandoned carts expire via configurable Redis TTL (expiry observable in tests)

### Order & Payment

- [ ] **ORDR-01**: User can checkout: cart contents convert into an order that snapshots items AND prices at purchase time
- [ ] **ORDR-02**: Order creation persists to Postgres and produces `order.created` to Kafka
- [ ] **ORDR-03**: Payment Service consumes `order.created`, runs mock authorization controlled by `PAYMENT_MODE` env var (`always_success|always_fail|random`), and produces `payment.completed` carrying the outcome
- [ ] **ORDR-04**: Order Service consumes `payment.completed` and transitions status `PENDING_PAYMENT → PAID | PAYMENT_FAILED` with terminal-state guards (transitions idempotent under redelivery)
- [ ] **ORDR-05**: `POST /orders` accepts an `Idempotency-Key` header; replayed keys return the original order instead of creating duplicates
- [ ] **ORDR-06**: Cart is cleared after successful checkout
- [ ] **ORDR-07**: User can view order history and individual order detail (`GET /orders/{id}`) suitable for frontend status polling
- [ ] **ORDR-08**: At-least-once redelivery behavior demonstrated: killing and restarting Payment mid-flow results in correct final state (offset/redelivery test observed via console consumer or Kafka UI)

### Notification

- [ ] **NOTF-01**: Notification worker consumes both `order.created` and `payment.completed` as a Kafka consumer group
- [ ] **NOTF-02**: Order confirmation emails (order number, item summary, status per contract payload) are delivered to Mailhog/Mailpit and visible in its web UI

### API Gateway

- [ ] **GTWY-01**: Gateway routes `/auth/**`, `/catalog/**`, `/cart/**`, `/orders/**` to the correct downstream services
- [ ] **GTWY-02**: Protected paths (`/cart/**`, `/orders/**`) return 401 without a valid JWT and pass with one
- [ ] **GTWY-03**: Public paths (`/auth/**`, `GET /catalog/**`) work without any token
- [ ] **GTWY-04**: Downstream services publish no host ports; they are reachable only through the gateway from outside the Docker network
- [ ] **GTWY-05**: Basic rate limiting applied at the gateway (Spring Cloud Gateway request-rate limiter)

### Frontend

- [ ] **FRNT-01**: Storefront provides browse, product detail page, category filter, and text search views
- [ ] **FRNT-02**: Cart page supports quantity updates/removals with live totals
- [ ] **FRNT-03**: Signup/login UI works; JWT held in httpOnly cookie via Next.js server-side proxy (same-origin; no CORS surface)
- [ ] **FRNT-04**: Checkout flow shows an order summary before confirming and submits with an idempotency key
- [ ] **FRNT-05**: Confirmation page polls order status until terminal state and renders both PAID and PAYMENT_FAILED as first-class outcomes (failure shows message + path forward, not an error toast)
- [ ] **FRNT-06**: User can view order history and order detail pages
- [ ] **FRNT-07**: Logout link clears the session client-side

### Local Orchestration

- [ ] **ORCH-01**: `docker compose up` brings the entire system healthy: 8 services + Postgres + MongoDB + Redis + Kafka (KRaft) + Mailhog/Mailpit + Kafka UI
- [ ] **ORCH-02**: Every service has a working healthcheck (JVM services use tuned `start_period`; memory limits set to avoid OOMKill on dev machines)
- [ ] **ORCH-03**: A scripted end-to-end smoke test passes with zero manual steps: signup → browse → add to cart → checkout → order reaches PAID → notification visible
- [ ] **ORCH-04**: Cold-start reproducibility holds: `compose down -v && up` yields a fully working system (data resets cleanly, Kafka topics recreated)

### Handoff Documentation

- [ ] **DOCS-01**: `docs/architecture.md` finalized with diagram, service contracts summary, and Kafka topic map
- [ ] **DOCS-02**: `docs/runbook.md` covers local run instructions, data/topic reset procedures, and common failure modes (JVM OOM, Kafka listener misconfig, PG18 volume layout, Windows CRLF)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Experience & Reliability

- **EXPR-01**: Order status timeline component (visual state machine on order detail) — D4
- **EXPR-02**: Simulated fulfillment transition (admin/script flips PAID → SHIPPED → DELIVERED) — D7
- **EXPR-03**: Transactional outbox pattern in Order Service (dual-write elimination) — D8
- **EXPR-04**: Consumer-side event-ID dedupe in Notification Service — D3
- **EXPR-05**: springdoc/OpenAPI UI exposure for Spring services (FastAPI ships /docs natively) — D5
- **EXPR-06**: Cursor/limit-skip pagination parameters on catalog list endpoints — D6
- **EXPR-07**: Refresh-token flow (middle ground toward production auth) — AF12 middle ground

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real payment processing (Stripe/PayPal) | External dependency + PCI posture; mock processor is deliberate |
| OAuth2/OIDC provider (Keycloak/Auth0) | Heavyweight container; distracts from JWT mechanics the gateway must exercise |
| Guest checkout | Conflicts with project purpose — the authenticated JWT journey IS the exercise (documented deviation from real-commerce advice) |
| Admin dashboard/UI | Needs role-based authz + new frontend surface; seed scripts + Swagger suffice |
| Reviews & ratings | Moderation problem, new aggregate; cosmetic at 20 products |
| Coupons/promotions engine | Contaminates pricing logic across Cart/Order/Payment simultaneously |
| Real inventory deduction | Distributed-transaction trap across Catalog↔Order; display-only stock field instead |
| Wishlist | Marginal learning value; eShop skips it too |
| Elasticsearch/OpenSearch | Heavy container; Mongo text index adequate at 20 products |
| Extra boutique services (currency, shipping-quote, recommendations, ads) | Each adds container + contract without advancing JWT/Kafka/polyglot story |
| Micro-frontends / BFF-per-client | One Next.js storefront through one gateway is right-sized |
| Password reset / email verification flows | Fake flows through Mailhog feel more fake than none; expands Auth scope |
| Kubernetes/Helm, CI/CD, observability stack, Vault/service mesh, Schema Registry/Avro, multi-broker Kafka | Deliberately excluded — these form the follow-on DevOps learning arc against this stable target |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONTR-01 | Phase 1 | Complete |
| CONTR-02 | Phase 1 | Complete |
| CONTR-03 | Phase 1 | Complete |
| CONTR-04 | Phase 1 | Complete |
| CONTR-05 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| CAT-01 | Phase 3 | Pending |
| CAT-02 | Phase 3 | Pending |
| CAT-03 | Phase 3 | Pending |
| CAT-04 | Phase 3 | Pending |
| CAT-05 | Phase 3 | Pending |
| CAT-06 | Phase 3 | Pending |
| CART-01 | Phase 4 | Pending |
| CART-02 | Phase 4 | Pending |
| CART-03 | Phase 4 | Pending |
| CART-04 | Phase 4 | Pending |
| ORDR-01 | Phase 5 | Pending |
| ORDR-02 | Phase 5 | Pending |
| ORDR-03 | Phase 5 | Pending |
| ORDR-04 | Phase 5 | Pending |
| ORDR-05 | Phase 5 | Pending |
| ORDR-06 | Phase 5 | Pending |
| ORDR-07 | Phase 5 | Pending |
| ORDR-08 | Phase 5 | Pending |
| NOTF-01 | Phase 6 | Pending |
| NOTF-02 | Phase 6 | Pending |
| GTWY-01 | Phase 7 | Pending |
| GTWY-02 | Phase 7 | Pending |
| GTWY-03 | Phase 7 | Pending |
| GTWY-04 | Phase 7 | Pending |
| GTWY-05 | Phase 7 | Pending |
| FRNT-01 | Phase 8 | Pending |
| FRNT-02 | Phase 8 | Pending |
| FRNT-03 | Phase 8 | Pending |
| FRNT-04 | Phase 8 | Pending |
| FRNT-05 | Phase 8 | Pending |
| FRNT-06 | Phase 8 | Pending |
| FRNT-07 | Phase 8 | Pending |
| ORCH-01 | Phase 9 | Pending |
| ORCH-02 | Phase 9 | Pending |
| ORCH-03 | Phase 9 | Pending |
| ORCH-04 | Phase 9 | Pending |
| DOCS-01 | Phase 10 | Pending |
| DOCS-02 | Phase 10 | Pending |

**Coverage:**

- v1 requirements: 47 total
- Mapped to phases: 47 ✓
- Unmapped: 0

> Note: an earlier revision of this file stated "43 total"; recounted during roadmap creation — actual v1 count is 47.

---
*Requirements defined: 2026-08-24*
*Last updated: 2026-08-24 after roadmap creation (traceability populated)*
