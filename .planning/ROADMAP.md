# Roadmap: Ecommerce Microservices Platform

## Overview

Ten phases take the platform from empty repo to a reproducible end-to-end purchase journey. Contracts and scaffolding come first because three languages with no shared types can only interoperate through committed specs — every later phase plans from those files, not from each other. Each service phase then ships one service complete (code, tests, Dockerfile, its own docker-compose entry and healthcheck), verified standalone before the next begins. The Order+Payment pair travels together because they form a single Kafka saga that cannot be verified in halves. Late gateway placement is deliberate: services prove themselves on temporary published ports, then the gateway revokes those ports as its isolation verify. The frontend consumes everything through the gateway alone, and the final two phases prove the whole system reproduces from nothing (`down -v && up`) and freeze handoff documentation.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Contracts & Repo Scaffolding** - OpenAPI specs, Kafka topic contracts, JSON interop rules, pinned versions, monorepo skeleton — before any service code
- [ ] **Phase 2: Auth Service** - Java/Spring Boot signup/login/JWT//me on Postgres; first JVM-in-Docker proof with compose entry + healthcheck
- [ ] **Phase 3: Catalog Service** - Python/FastAPI product browse/search/filter/CRUD on MongoDB with idempotent ~20-product seed
- [ ] **Phase 4: Cart Service** - Node/Express session carts in Redis with server-side totals validated against Catalog
- [ ] **Phase 5: Order + Payment Services** - Inseparable Kafka saga pair: checkout snapshot, mock payment, status state machine, redelivery proof
- [ ] **Phase 6: Notification Service** - Node/kafkajs worker consuming both topics into Mailpit confirmation emails
- [ ] **Phase 7: API Gateway** - Spring Cloud Gateway single ingress: routing, JWT enforcement, port revocation, rate limiting
- [ ] **Phase 8: Frontend** - Next.js storefront: browse, cart, checkout with polling confirmation, order history through same-origin proxy
- [ ] **Phase 9: Orchestration Audit** - Cold-start reproducibility (`down -v && up` → all healthy) + zero-manual-steps scripted E2E smoke test
- [ ] **Phase 10: Handoff Documentation** - Finalized architecture doc and runbook so a new engineer can run/reset/debug from docs alone

## Phase Details

### Phase 1: Contracts & Repo Scaffolding

**Goal**: The interop backbone exists before any service code — committed REST/event contracts and cross-language JSON rules are the sole drift guard between independent polyglot milestones, and repo hygiene (LF enforcement, pinned versions) is locked in from commit one.
**Depends on**: Nothing (first phase)
**Requirements**: CONTR-01, CONTR-02, CONTR-03, CONTR-04, CONTR-05
**Success Criteria** (what must be TRUE):

  1. `docs/api-contracts/` holds an OpenAPI spec covering every REST endpoint the auth, catalog, cart, and order services will expose — reviewable before any service code exists
  2. `docs/kafka-topics.md` fully specifies `order.created` and `payment.completed` (key, JSON schema, `outcome: APPROVED|DECLINED`, producer, consumers, dedup/idempotency fields, email content payload) — sufficient to implement either side in any language without asking questions
  3. Cross-language JSON interop conventions are documented and checkable by inspection: ISO 8601 dates, integer-cents money, string IDs, unknown-fields-ignored policy
  4. A fresh clone on Windows yields LF line endings everywhere `.gitattributes` governs (shell scripts, `.env`) — no CRLF poisoning is possible at checkout
  5. The pinned version manifest records exact versions for every stack component (Spring Boot/Cloud/JDK, FastAPI/Pydantic, Node LTS, Kafka, Postgres 18, Mongo, Redis, Next.js), and the monorepo skeleton exists (`services/` tree, root README, `.env.example`)

**Plans:** 5 plans

Plans:
**Wave 1**

- [ ] 01-01-PLAN.md — Repo foundation: pre-freeze sign-off gates, `.gitattributes`-first LF law, monorepo skeleton, `.env.example`

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Validation gate (`check-contracts.sh`) + shared components + auth-service contract — the tracer slice proven end-to-end
- [ ] 01-03-PLAN.md — Pinned version manifest (`docs/versions.md`) + JSON interop conventions (`docs/json-interop.md`)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-04-PLAN.md — Catalog + cart service OpenAPI contracts (public reads / protected writes / internal edges)
- [ ] 01-05-PLAN.md — Orders contract (idempotent checkout, status machine) + Kafka topic contracts (`order.created`, `payment.completed`, email payload)

### Phase 2: Auth Service

**Goal**: Users can securely register, log in, and prove who they are via JWT — and the riskiest runtime family (JVM-in-Docker: multi-stage build, memory flags, PG18 volume mount) is proven first, producing templates the order service and gateway copy.
**Depends on**: Phase 1 (parallelizable with Phase 3)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):

  1. A new user can sign up with email/password; duplicate emails are rejected; stored passwords are hashed, not recoverable
  2. A user with valid credentials can log in and receive a signed JWT; invalid credentials are refused
  3. An authenticated user can retrieve their own profile via `/me`; requests without a valid JWT are rejected
  4. Logout behaves as the documented client-side token discard (no server revocation in v1), stated in the service's docs
  5. The auth container builds via multi-stage Dockerfile, runs as its own docker-compose entry with a passing healthcheck, and passes a standalone curl smoke test (signup → login → `/me`)

**Plans**: TBD

### Phase 3: Catalog Service

**Goal**: Visitors can browse a seeded product catalog without accounts, and every later phase has product truth (IDs, prices, names) to validate against.
**Depends on**: Phase 1 (parallelizable with Phase 2)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06
**Success Criteria** (what must be TRUE):

  1. Anyone can fetch the product listing with no token and no login
  2. Anyone can fetch a single product's details by ID
  3. Listing results can be filtered by category and searched by text query, with basic sort by price/name
  4. Running the seed script populates ~20 realistic products with bundled placeholder images; re-running it changes nothing (idempotent)
  5. Product create/update/delete works via authenticated API calls (Swagger-driven; no admin UI) and is refused without authentication

**Plans**: TBD

### Phase 4: Cart Service

**Goal**: Logged-in users get persistent carts whose totals are computed server-side from live catalog prices — establishing the platform's first synchronous service-to-service trust boundary.
**Depends on**: Phase 1 (JWT claims contract), Phase 3 (catalog validation)
**Requirements**: CART-01, CART-02, CART-03, CART-04
**Success Criteria** (what must be TRUE):

  1. A logged-in user can add an item (product ID + quantity) to their cart; unknown product IDs and invalid quantities are rejected via Catalog validation
  2. The user can update quantities and remove items; returned line and grand totals are computed server-side from live Catalog prices (the client cannot dictate totals)
  3. A cart persists across sessions, keyed `cart:{userId}` in Redis
  4. An abandoned cart expires after the configurable Redis TTL, demonstrated in an observable test

**Plans**: TBD

### Phase 5: Order + Payment Services

**Goal**: Checkout completes through the async order→payment saga with correct final states — including under crashes and at-least-once redelivery. Highest-complexity phase; Kafka enters Compose here as an inseparable two-service pair.
**Depends on**: Phase 1 (topic contracts), Phase 2 (signed tokens), Phase 4 (cart contents at checkout)
**Requirements**: ORDR-01, ORDR-02, ORDR-03, ORDR-04, ORDR-05, ORDR-06, ORDR-07, ORDR-08
**Success Criteria** (what must be TRUE):

  1. Checking out converts the cart into an order that snapshots items AND prices at purchase time, persists to Postgres, and produces `order.created` (observable via console consumer or Kafka UI)
  2. With `PAYMENT_MODE` set (`always_success|always_fail|random`), the Payment Service consumes `order.created` and produces `payment.completed` carrying the outcome; the Order Service transitions `PENDING_PAYMENT → PAID | PAYMENT_FAILED` under terminal-state guards (idempotent under redelivery)
  3. Replaying `POST /orders` with the same `Idempotency-Key` header returns the original order instead of creating a duplicate
  4. Killing and restarting the Payment Service mid-flow still ends in the correct final state — at-least-once redelivery demonstrated via console consumer or Kafka UI
  5. The cart is cleared after successful checkout, and the user can view order history and individual order detail suitable for frontend status polling

**Plans**: TBD

### Phase 6: Notification Service

**Goal**: Order events become human-visible confirmation emails — the third consumer group proves idempotency patterns hold across a second Kafka client library.
**Depends on**: Phase 5 (topics exist) — parallelizable with Phase 7
**Requirements**: NOTF-01, NOTF-02
**Success Criteria** (what must be TRUE):

  1. The worker runs as its own Kafka consumer group subscribed to both `order.created` and `payment.completed` (visible in the consumer-group listing)
  2. After an approved order flow, a confirmation email containing the order number, item summary, and status arrives in Mailpit matching the Phase 1 email-content contract
  3. A declined-payment flow also delivers its contracted email content, assertable via Mailpit's REST API

**Plans**: TBD

### Phase 7: API Gateway

**Goal**: One public door — all traffic enters through the gateway, protected routes demand valid JWTs, and every downstream service goes dark to the outside world (temporary standalone ports revoked).
**Depends on**: Phases 2–5 (routes target their APIs) — parallelizable with Phase 6
**Requirements**: GTWY-01, GTWY-02, GTWY-03, GTWY-04, GTWY-05
**Success Criteria** (what must be TRUE):

  1. Calls to `/auth/**`, `/catalog/**`, `/cart/**`, and `/orders/**` through the gateway reach the correct downstream service
  2. `/cart/**` and `/orders/**` return 401 without a valid JWT, pass with one, and reject forged/tampered tokens (contract-tested)
  3. `/auth/**` and `GET /catalog/**` respond normally with no token at all
  4. From outside the Docker network, downstream services' ports are unreachable — only the gateway answers
  5. Excessive request rates are throttled by the gateway rate limiter

**Plans**: TBD

### Phase 8: Frontend

**Goal**: The complete purchase journey is usable in a browser through the gateway alone — browse to paid (or gracefully failed) order, with the JWT never exposed outside an httpOnly cookie.
**Depends on**: Phase 7
**Requirements**: FRNT-01, FRNT-02, FRNT-03, FRNT-04, FRNT-05, FRNT-06, FRNT-07
**Success Criteria** (what must be TRUE):

  1. A visitor can browse the storefront: product listing, product detail, category filter, and text search views
  2. Signup/login work with the JWT held in an httpOnly cookie via the same-origin Next.js proxy, and a logout link clears the session client-side
  3. The cart page supports quantity updates and removals with live totals
  4. Checkout shows an order summary before confirming, submits with an idempotency key, and the confirmation page polls until terminal state — rendering both PAID and PAYMENT_FAILED as first-class outcomes (failure shows message plus path forward, not an error toast)
  5. The user can view their order history and individual order detail views

**Plans**: TBD
**UI hint**: yes

### Phase 9: Orchestration Audit

**Goal**: The whole platform provably reproduces from nothing — cold-start healthy and a scripted end-to-end smoke test green with zero manual steps. Wiring already happened incrementally per service phase; this phase audits the assembled whole.
**Depends on**: Phases 1–8
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04
**Success Criteria** (what must be TRUE):

  1. `docker compose up` brings the entire system healthy: 8 application services + PostgreSQL + MongoDB + Redis + Kafka (KRaft) + Mailpit + Kafka UI
  2. Every service reports a passing healthcheck — JVM services use tuned `start_period`, memory limits are sized so no OOMKill occurs on dev machines (aggregate budget audited)
  3. The scripted end-to-end smoke test passes with zero manual steps: signup → browse → add to cart → checkout → order reaches PAID → notification visible
  4. Cold-start reproducibility holds: `docker compose down -v && up` yields a fully working system — data resets cleanly, Kafka topics recreated

**Plans**: TBD

### Phase 10: Handoff Documentation

**Goal**: A new engineer can run, reset, and debug the platform from documentation alone — the stable deployment target for the follow-on DevOps arc is formally handed over.
**Depends on**: Phases 1–9
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):

  1. `docs/architecture.md` is finalized with diagram, service contracts summary, and Kafka topic map
  2. `docs/runbook.md` enables someone unfamiliar with the project to run it locally, reset data/topics, and resolve common failure modes (JVM OOM exit 137, Kafka listener misconfig, postgres:18 volume layout, Windows CRLF) using documented fix commands

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 ∥ 3 → 4 → 5 → 6 ∥ 7 → 8 → 9 → 10
(Parallelization waves available: Wave A = {2, 3}; Wave D = {6 ∥ 7})

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Contracts & Repo Scaffolding | 0/5 | Not started | - |
| 2. Auth Service | 0/TBD | Not started | - |
| 3. Catalog Service | 0/TBD | Not started | - |
| 4. Cart Service | 0/TBD | Not started | - |
| 5. Order + Payment Services | 0/TBD | Not started | - |
| 6. Notification Service | 0/TBD | Not started | - |
| 7. API Gateway | 0/TBD | Not started | - |
| 8. Frontend | 0/TBD | Not started | - |
| 9. Orchestration Audit | 0/TBD | Not started | - |
| 10. Handoff Documentation | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-24 — 47/47 v1 requirements mapped*
