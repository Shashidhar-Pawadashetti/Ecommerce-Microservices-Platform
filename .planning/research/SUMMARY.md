# Project Research Summary

**Project:** Ecommerce Microservices Platform
**Domain:** Polyglot e-commerce microservices platform (learning-oriented demo; designed as a future DevOps/Kubernetes practice target)
**Researched:** 2026-08-24
**Overall confidence:** MEDIUM (every stream verified against primary sources — npm/PyPI registries, spring.io, official image docs, OWASP, microservices.io — with web-derived findings capped at MEDIUM per source-hierarchy seam)

> Detail lives in sibling files: `.planning/research/STACK.md` (version pins), `.planning/research/FEATURES.md` (scope + gaps G1–G8), `.planning/research/ARCHITECTURE.md` (topology, saga, build-order validation), `.planning/research/PITFALLS.md` (12 pitfalls with prevention phases).

---

## Executive Summary

This project is a learning-oriented polyglot e-commerce platform: 7 backend services (Java/Spring auth-order-gateway trio, Python/FastAPI catalog-payment duo, Node/Express-kafkajs cart-notification pair), a Kafka KRaft event bus carrying an async order→payment saga, three polyglot datastores (Postgres/MongoDB/Redis), a Next.js storefront, all orchestrated on Docker Compose. Feature research found its scope is **almost exactly the feature set of Microsoft's canonical dotnet/eShop demo** — the industry benchmark for a "credible microservices demo" — while Google's Online Boutique ships *less* (no login, JSON-file catalog). The plan is neither thin nor bloated; its distinctive spine versus both references is the **Kafka async event flow and real JWT gateway auth**, precisely what makes it a strong observability/resilience/K8s practice target later. Only eight small, cheap gaps separate the plan from feeling broken or fake (product-detail page, logout, payment-failure UX, async-aware confirmation page, cart clearing after checkout, order-detail endpoint for polling, email content definition, seed-product images — G1–G8 in FEATURES.md).

The recommended approach is the build plan's own sequence, **validated by architecture research with two edits**: (1) the contracts phase widens to own repo scaffolding (`.gitattributes`/`.editorconfig` must precede the first Java commit on Windows), a five-rule JSON interop style guide (string IDs, integer cents, ISO-8601 ms UTC timestamps, explicit nullability, ignore unknown fields), Kafka dedup keys in topic contracts, and a mechanical OpenAPI drift-check script; (2) the orchestration phase is reframed as a **cold-start reproducibility audit** (`down -v && up` → healthy → scripted E2E passes with zero manual steps), not initial wiring — each service already joins Compose incrementally in its own phase. Architectural laws confirmed across research: database-per-service enforced by separate credentials, snapshot-on-write across ownership boundaries (orders copy prices/names, never reference live catalog), exactly two synchronous service-to-service edges (cart→catalog validation, order→cart at checkout) with everything else event-driven, idempotent consumers with commit-after-process, and a same-origin Next.js proxy that eliminates CORS entirely while keeping JWTs in httpOnly cookies.

The dominant risk profile is **integration and environment, not feature scope**. The top killers are all known with verbatim fixes: Kafka `advertised.listeners` (bootstrap succeeds, every real operation fails — use the official dual-listener compose block), KRaft `CLUSTER_ID`/volume mismatches (crash loops; codify `down -v` reset), JVM containers OOMKilled with exit 137 (explicit `mem_limit` + `-XX:MaxRAMPercentage=75`, sum ≤75% of Docker Desktop RAM), the postgres:18 volume-layout change (mount `/var/lib/postgresql`, NOT `/var/lib/postgresql/data`, or data silently vanishes), Windows CRLF poisoning `mvnw`/entrypoints/`.env` secrets, cross-language contract drift, and JWT trust-boundary drift between issuer and gateway validator. Separately, four **stack-level deviations from the original build plan need stakeholder sign-off**: Mailpit replaces MailHog (unmaintained since 2020), PyMongo `AsyncMongoClient` replaces Motor (deprecated, EOL May 2026), kafkajs is accepted as unmaintained (escape hatch documented), and Spring Boot 3.5 is past OSS EOL (acceptable for local learning; one-line upgrade path to Boot 4.0 exists).

---

## Key Findings

### Recommended Stack

All versions verified 2026-08-24 against primary distribution channels (registry dist-tags, PyPI release pages, spring.io release matrices, official Docker Hub tags). Full detail + install snippets: STACK.md.

**Core technologies:**
- **Java trio (gateway, auth, order):** Spring Boot **3.5.16** + Spring Cloud **2025.0.3 "Northfields" BOM** (never mix trains) + **JDK 21 LTS** + Maven wrapper committed per service. ⚠️ Gateway starter artifact renamed: `spring-cloud-starter-gateway-server-webflux` (old name deprecated); properties moved to `spring.cloud.gateway.server.webflux.*`.
- **JWT:** Spring Security OAuth2 Resource Server on both auth (issue) and gateway (verify) — version-managed by Boot, industry-standard; prefer over hand-rolled jjwt. HS256 must be pinned explicitly (RS256 is the default trust).
- **Python duo (catalog, payment):** FastAPI **0.141.1** (`fastapi[standard]`) + Pydantic **2.13.4** on **Python 3.13-slim**. Catalog uses **pymongo ≥4.9 `AsyncMongoClient`** (⚠️ Motor is deprecated/EOL — do not use); payment uses **aiokafka 0.14.0**.
- **Node duo (cart, notification):** **Node 24 LTS "Krypton"**, **Express 5.2.1** (mind wildcard-syntax changes vs Express 4 tutorials) + **ioredis 6.0.0** for cart; **kafkajs 2.2.4** (unmaintained since Aug 2024 — pragmatic pick, pure-JS/alpine-friendly, documented successor: `@confluentinc/kafka-javascript`) + **nodemailer 9.0.5** for notification.
- **Event bus:** **apache/kafka:4.2.1**, KRaft combined mode, single broker — ZooKeeper removed entirely in Kafka 4.x; never add a ZK container. Single-broker dev overrides required (RF=1, `min.isr=1`, rebalance delay 0).
- **Datastores:** **postgres:18** (⚠️ volume mounts at `/var/lib/postgresql` — PGDATA layout changed in 18; old habit silently loses data), **mongo:8.0** (long-support line; avoid rapid 8.3.x), **redis:8-alpine**.
- **Frontend:** **Next.js 16.3.2** (App Router, React 19, Turbopack default) — consumes ONLY the gateway through a same-origin `/api/*` proxy.
- **Mail:** **Mailpit** (SMTP :1025, UI :8025) — drop-in MailHog replacement; REST API enables programmatic email assertions in the E2E smoke test. ⚠️ Deliberate deviation from original plan (which named MailHog) — flag to stakeholders.

**Critical compatibility rules:** spring-kafka stays Boot-managed (clients 3.9 ⇔ broker 4.2 — older-client-than-broker is the supported direction; never force kafka-clients 4.x on Boot 3.5). Pin exact image tags. Alpine base images fine for Java/Node; adopt `node:slim` only if swapping to librdkafka-based clients.

### Expected Features

Benchmarked against dotnet/eShop and Online Boutique: the plan sits at feature parity with both canonical demos while being more demanding operationally (Kafka + auth + polyglot persistence). Full tables: FEATURES.md.

**Must have (table stakes):**
- Public browse without login: catalog list, category filter, text search, **product detail page (G1)**, sort + pagination params
- Signup / login / **logout (G2)** / `/me`; JWT through gateway; browsing public, auth required from cart onward
- Cart: add/update/remove with live server-computed totals, price validation against Catalog, persistence + TTL expiry
- Checkout → order snapshot (items AND prices copied at checkout) → `order.created` → mock payment → `payment.completed` → status update
- **Async-aware confirmation page** polling `GET /orders/{id}` (G4) until PAID/PAYMENT_FAILED — the key UX consequence of the event-driven design
- Order history + detail; **graceful PAYMENT_FAILED rendering** (G3); **cart cleared after success** (G6)
- Confirmation emails with real content (order number, items, status — G5); **seeded ~20 products WITH images** (G7)
- **Deterministic `PAYMENT_MODE` env var** (always_success | always_fail | random) — protects the scripted E2E smoke test from random-failure flakiness; highest value-per-line-of-code differentiator
- Gateway routing + auth boundary: protected routes 401 without valid JWT; downstream services unreachable externally

**Should have (add once stable):**
- Idempotency keys on checkout (D2) — or at minimum client-side double-click guard (G8)
- Consumer-side dedupe on `eventId` in Notification (D3); order-status timeline UI (D4); Swagger UI exposure per service (D5)

**Defer (v2+ / next learning arc):**
- Transactional outbox pattern (D8 — flag now so order schema doesn't preclude it), refresh tokens, simulated SHIPPED/DELIVERED transitions (D7), then the planned next arc: K8s/Helm, CI/CD, observability, Schema Registry, OIDC

**Anti-features (deliberately refuse):** real payments, OIDC provider (Keycloak), guest checkout (conflicts with the authenticated-JWT exercise — documented deviation), admin dashboard, reviews/ratings, coupons, inventory deduction (distributed-transaction trap), wishlist, Elasticsearch (20 products don't need it), Boutique-style extra services, micro-frontends/BFF-per-client.

### Architecture Approach

Architecture research defines how the fixed components connect (full detail: ARCHITECTURE.md). Sync REST for reads/validation on the user's critical path; async Kafka for business-event side effects. The order–payment flow is a **two-step choreographed saga** (no orchestrator): order persists `PENDING`, produces `order.created` (key=orderId, 3 partitions), payment consumes → mock-authorizes → produces `payment.completed` with explicit `outcome` field (one topic, not two) → order consumes with a **state-machine guard** (PENDING→PAID/PAYMENT_FAILED; terminal states immutable — the guard IS the idempotency mechanism) → notification (one consumer group subscribed to BOTH topics, dedupes on `eventId`, no cross-topic ordering assumption) emails via Mailpit. Checkout returns `201 {orderId, status: PENDING}` immediately; the UI polls.

**Major components:**
1. **api-gateway** (Spring Cloud Gateway, Netty) — single ingress, path routing, central JWT enforcement (signature + iss/aud/exp locally, never phones auth), CORS policy point; after this phase lands, only frontend/gateway/operator-UI ports stay published
2. **auth-service** (Java, Postgres `users` DB) — signup/login//me, BCrypt, issues HS256 JWTs (~1h TTL); sole writer of users DB
3. **catalog-service** (FastAPI, MongoDB) — product CRUD/search/filter/sort, serves product truth to cart & frontend; idempotent seed script with images
4. **cart-service** (Express, Redis `cart:{userId}` + TTL) — stores productId+qty only, re-validates against catalog (the ONE sync dependency), computes totals server-side
5. **order-service** (Java + spring-kafka, Postgres `orders` DB) — hardest service: owns the status state machine, both sides of the saga, order history; snapshots cart atomically, clears cart after persist
6. **payment-service** (FastAPI + aiokafka, stateless) — pure Kafka reactor, `/health` REST only; validates amount>0 before authorizing
7. **notification-service** (Node/kafkajs worker, no HTTP port) — consumes both topics, renders real-content emails, dedupes on `eventId`
8. **frontend** (Next.js) — catch-all route-handler proxy translating httpOnly cookie ⇄ `Authorization: Bearer`; server components attach the token explicitly (SSR fetch does not propagate Set-Cookie)
9. **kafka** — durable replay log; dual-listener config (containers `kafka:19092`, host tools `localhost:9092`)

One Postgres container hosts two logical DBs (`users`, `orders`) with **separate DB credentials** as the isolation barrier — splitting containers later is a JDBC URL change. Datastore access crosses service boundaries only via APIs/events, never shared connections.

### Critical Pitfalls

Top 5 of 12 (full set with warning signs, recovery steps, and phase mapping: PITFALLS.md):

1. **Kafka `advertised.listeners` misconfiguration** — bootstrap connects but every real operation times out; the #1 Kafka-in-Docker failure. Bake the official dual-listener compose block verbatim (bind bare `:port`, advertise container-name for services and `localhost:9092` for host tools, unique port per listener, `KAFKA_LISTENER_SECURITY_PROTOCOL_MAP`). Smoke test includes one host-side AND one container-side metadata dump.
2. **Non-idempotent consumers under at-least-once redelivery** — the mandated kill/restart test guarantees duplicates. Design every consumer idempotent from day one (dedup keys frozen in contracts: payment skips seen `orderId`, order gates on state transitions, notification dedupes on `eventId`); auto-commit OFF everywhere; commit-after-produce for payment.
3. **Cross-language contract drift** (three runtimes, zero shared types) — committed OpenAPI YAML + `kafka-topics.md` are THE source of truth; a drift script diffs each service's live spec against committed files in every phase Verify. Encode the five JSON interop rules once (string IDs, integer `priceCents`, ISO-8601 ms UTC, explicit nullability, ignore unknown fields) or Jackson/Pydantic/JS will disagree silently on dates, >2^53 IDs, and money rounding.
4. **Environment/container trap cluster** — postgres:18 volume layout change (mount `/var/lib/postgresql`; wrong path silently initdb's into an anonymous volume and "Docker loses your database"); JVM OOMKill exit 137 with empty logs (`-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError` + explicit `mem_limit`, sum ≤75% of Docker Desktop allocation); Windows CRLF breaking `mvnw`, shell entrypoints, and `.env` secrets (commit `.gitattributes` with LF eol rules BEFORE the first Java commit; `sed -i 's/\r$//'` safety net in Dockerfiles; beware OneDrive sync locks on this repo's path); KRaft `CLUSTER_ID`/storage mismatches (set once, named volume at `KAFKA_LOG_DIRS`, reset = `down -v`).
5. **JWT trust boundary + cookie fragility** — pin HS256 on both sides (never header-derived), validate `iss`+`aud` with ~60s skew tolerance, CSPRNG ≥32-byte secret held by EXACTLY two services with startup length assertion, forged-token (`alg:none`, tampered signature) contract tests in the gateway phase. Cookie/CORS solved structurally by the same-origin Next.js proxy (no CORS anywhere; `SameSite=Lax` works over localhost http).

Also load-bearing: healthchecks use `start_period` (JVM 90s) rather than inflated retries, with per-runtime check commands (temurin-alpine has BusyBox wget, python-slim has NEITHER curl nor wget, node needs a tiny `healthcheck.cjs`); `depends_on: service_healthy` is start-ordering, not supervision.

---

## Implications for Roadmap

Architecture research validated the proposed 10-phase build order against the dependency DAG (contracts→everything; catalog→cart→order+payment→notification; auth→gateway→frontend; everything→orchestration→docs). **Keep it, with two edits**: widen Phase 1, and reframe Phase 9 as a cold-start reproducibility audit. Suggested phasing:

### Phase 1: Contracts, Interop Rules & Repo Scaffolding
**Rationale:** Three languages with no shared types — REST shapes, event schemas, claim names, and port map are the ONLY interoperability guarantee. Every later phase plans from these files, not from each other. Windows CRLF guards must exist before the first Java file is committed.
**Delivers:** Committed OpenAPI YAMLs (auth/catalog/cart/orders — including `GET /products/{id}` and `GET /orders/{id}`, closing G1/G4), `docs/kafka-topics.md` (payload schemas, `outcome` field, dedup keys, 3 partitions, auto-create off), JSON interop style guide (5 rules), JWT claims contract (`sub/email/roles/iss/aud`), route/port map, `scripts/check-contracts.sh` drift-gate skeleton, `.gitattributes`/`.editorconfig`/`.env.example`, monorepo skeleton.
**Avoids:** Pitfalls 4, 5, 11 (drift, JSON ambiguity, CRLF) at the root.

### Phase 2: Auth Service (first JVM-in-Docker proof)
**Rationale:** No runtime dependencies; the highest-risk runtime family (JVM memory flags, `mvnw` inside Maven build stage, correct PG18 volume mount) gets proven first and its Dockerfile/compose/healthcheck templates are copied by order-service and gateway.
**Delivers:** Signup/login/logout-support//me, BCrypt (pwdlib-equivalent discipline on Java side), Flyway, actuator healthcheck template, JWT signing config written down verbatim for Phase 7, first Compose entry + standalone curl smoke test.
**Uses:** Spring Boot 3.5.16, postgres:18 (mounted correctly the first time).
**Addresses:** Features A6, A14 (partial — issuance side).

### Phase 3: Catalog Service + Seeded Data (parallelizable with Phase 2)
**Rationale:** Independent of auth; required by cart (price validation) and seeds the data every later smoke test needs.
**Delivers:** FastAPI CRUD + get-by-id + category filter + text search + sort/pagination params (contractual, D6), AsyncMongoClient access, idempotent 20-product seeder WITH placeholder images (G7), `/health` endpoint + python-side healthcheck template.
**Avoids:** Pitfall 12 (python-slim has no curl/wget — urllib one-liner pattern).

### Phase 4: Cart Service
**Rationale:** First internal service-to-service REST call (batch-validate vs catalog) and first TTL datastore; depends on Phase 2 only via the claims contract.
**Delivers:** Express 5 cart API keyed `cart:{userId}`, quantity guards, touch-TTL-on-every-mutation, server-side totals, short-TTL existence cache against catalog, Node alpine healthcheck.
**Avoids:** Pitfall/trap "sync validation per item" (batch once per request); AF7 temptation (display-only stock).

### Phase 5: Order + Payment — the Kafka Saga (inseparable pair)
**Rationale:** Cannot be split or verified separately: the message round-trip and the kill/restart redelivery test need both endpoints alive. Highest-complexity phase; Kafka enters Compose here.
**Delivers:** Verbatim dual-listener Kafka block (Pitfall 1), pre-created topics (3 partitions), single-broker RF=1 overrides, named volume at `KAFKA_LOG_DIRS`, order snapshot + `PENDING→PAID|PAYMENT_FAILED` state machine, aiokafka payment with dedup + commit-after-produce, **deterministic `PAYMENT_MODE` env var (D1)**, cart clearing after persist (G6), `reset-all`/`reset-keep-data` scripts codified, host+container metadata checks, kill/restart redelivery verification.
**Avoids:** Pitfalls 1, 2, 3 at their point of maximum danger.

### Phase 6: Notification Service (parallelizable with Phase 7)
**Rationale:** Depends only on Phase 5's topics; re-validates idempotency under kafkajs's different timeout model (no max.poll.interval equivalent — sessionTimeout sized above slowest handler, auto-commit disabled).
**Delivers:** Third consumer group on both topics, `eventId` dedupe window, real-content email rendering (payload defined in Phase 1 contracts — closes G5), nodemailer→Mailpit delivery, Mailpit REST-API assertions covering the FAILURE path too.

### Phase 7: API Gateway
**Rationale:** Must precede frontend (hard dependency). Late placement is deliberate: phases 2–6 proved each service standalone via temporary published ports; this phase REVOKES them — the isolation verify is literally "service ports stop responding from the host."
**Delivers:** Renamed starter (`spring-cloud-starter-gateway-server-webflux`), route table for 5 prefixes, HS256 `JwtDecoder` bean with iss/aud validators + 60s skew, forged-token contract tests, CORS decision (expected: none needed under full-proxy), trusted-proxies setting.
**Avoids:** Pitfall 8 entirely at the enforcement point.

### Phase 8: Next.js Frontend
**Rationale:** Consumes every REST surface at once; last functional piece.
**Delivers:** Catch-all `/api/[...path]` proxy with cookie⇄Bearer translation, httpOnly SameSite=Lax SESSION cookie set by the proxy, browse/PDP/search UI, cart UI, checkout with immediate-201 + polling confirmation page (A9), PAYMENT_FAILED UX with re-order affordance (G3), order history/detail/timeline, logout (G2), logged-out deep-link redirects, checkout double-click guard (minimum form of G8), Windows polling fallbacks (`WATCHPACK_POLLING=true`).
**Avoids:** Pitfall 9 (structurally eliminated), UX pitfalls table.

### Phase 9: Orchestration Audit (reframed — NOT initial wiring)
**Rationale:** Each service already joined Compose incrementally. True scope: prove the whole thing reproduces from nothing.
**Delivers:** Cold-start criterion — `docker compose down -v && up` reaches all-healthy and the scripted E2E passes with ZERO manual steps; aggregate memory-budget audit (sum of limits ≤75% of Docker Desktop RAM); full healthcheck-matrix review; smoke-test wait strategy sized to worst-case `start_period + retries × (interval + timeout)`; E2E asserts emails via Mailpit REST API.
**Avoids:** Pitfalls 6, 7, 12 at system level; "looks done but isn't" cold-start checklist item.

### Phase 10: Documentation & Runbook
**Rationale:** Runbook content accretes from earlier phases' verify notes; final freeze.
**Delivers:** Failure-mode entries with fix commands (exit 137, INCONSISTENT_CLUSTER_ID, PG18 mount error, CRLF symptoms), Windows/OneDrive setup notes, reset-flow documentation, final spec/diagram freeze, documented exclusions (refresh tokens, password reset) and deviations (Mailpit, AsyncMongoClient, Boot 3.5 EOL posture).

### Phase Ordering Rationale

- **Dependencies discovered:** catalog→cart (price validation), cart→order (checkout source), auth→gateway (claims/secret contract), order+payment→notification (both topics), gateway→frontend (single-ingress assumption), everything→contracts. The order respects every hard edge.
- **Grouping by architecture:** each service phase ships its own compose entry + healthcheck (incremental integration); the gateway phase removes temporary port publications rather than adding wiring; orchestration audits instead of assembling.
- **Rejected alternatives:** gateway-second (destroys standalone-smoke pedagogy), order/payment split (unverifiable half-sagas), notification-before-gateway swap (zero dependency benefit).
- **Parallelization waves available if desired:** Wave A = {auth, catalog}; Wave B = {cart}; Wave C = {order+payment}; Wave D = {notification ∥ gateway}; then frontend serial.

### Research Flags

Phases likely needing deeper research during planning (`--research-phase`):
- **Phase 5 (Order + Payment):** highest integration complexity — concrete spring-kafka producer/consumer config, aiokafka consumer-loop patterns, and kill/restart test design benefit from a focused pass even though pitfalls/architecture docs carry verbatim configs.
- **Phase 3 (Catalog) — light:** PyMongo `AsyncMongoClient` is a new API (post-Motor) with thin example coverage; worth a targeted look at async collection CRUD + indexing patterns.
- **Phase 8 (Frontend) — light:** Next.js 16 conventions (proxy.ts rename, route-handler param Promises) evolve fast; verify current-doc specifics at plan time.

Phases with standard/well-documented patterns (skip research-phase):
- **Phases 1, 2, 4, 6, 7, 9, 10:** recipes are effectively verbatim in ARCHITECTURE.md and PITFALLS.md (compose blocks, JwtDecoder bean, healthcheck matrix, drift script, monorepo layouts).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Every version pin verified Aug 2026 against primary channels (npm dist-tags, PyPI, spring.io matrices, Docker Hub tag listings); web-derived findings capped at MEDIUM. Two flagged risks: kafkajs maintenance, Boot 3.5 OSS EOL — both with documented paths. |
| Features | MEDIUM | Scope parity established against two canonical primary repos (dotnet/eShop, Online Boutique — HIGH); Baymard abandonment figures are secondary citations; gap analysis G1–G8 internally consistent. |
| Architecture | MEDIUM (boundaries MEDIUM-HIGH) | Topology follows directly from fixed components + canonical microservices.io patterns; JWT flow verified against official Spring Security docs; frontend proxy verified against official Next.js 16 docs; saga shape corroborated by multiple independent implementations. |
| Pitfalls | MEDIUM | Each finding multi-source (official image docs/repos, OWASP cheat sheet, docker-library PR threads, practitioner post-mortems); prevention recipes are concrete and phase-mapped. |

**Overall confidence:** MEDIUM — sufficient for roadmap creation; the plan's structure survived adversarial validation (build-order challenge, competitor benchmark, pitfall mapping) without structural changes.

### Gaps to Address

- **Spring Boot 3.5 OSS EOL (ended 2026-06-30):** decide at roadmap time — stay pinned (recommended for a local learning target; matches tutorial ecosystem) vs one-line bump to Boot 4.0 + Oakwood train. Either way, record the posture in the runbook.
- **Build-plan deviations needing stakeholder sign-off:** MailHog→Mailpit; Motor→PyMongo AsyncMongoClient. Both are strictly-better swaps but deviate from the written plan — confirm before Phase 1 freezes contracts.
- **Kafka UI tool × Kafka 4.x compatibility:** LOW confidence on specific UI versions (Kafdrop/Redpanda Console/provectuslabs) — verify chosen image at Phase 5 scaffold time.
- **Checkout idempotency keys (D2):** v1 or v1.x? Minimum viable protection (client-side button disable, G8) belongs in Phase 8 regardless; full server-side keys recommended as first v1.x addition.
- **Seed-image sourcing method:** bundle static placeholders vs generated SVGs — pick during Phase 3 planning (trivial either way, but G7 must not slip).
- **OneDrive sync on this repo's path:** research flagged file-lock races during builds; recommend excluding the project dir from OneDrive sync (or relocating dev copies) — a user-environment decision to surface early, not a code fix.
- **kafkajs long-term:** accepted-risk with documented successor (`@confluentinc/kafka-javascript`, requires `node:slim`); revisit only if friction appears.

---

## Sources

Aggregated highlights; complete per-file citation lists with confidence grades live in each research file.

### Primary (HIGH-reliability data)
- npm registry latest dist-tags; PyPI release pages — express 5.2.1, next 16.3.2, ioredis 6.0.0, nodemailer 9.0.5, fastapi 0.141.1, pydantic 2.13.4 (STACK)
- github.com/dotnet/eShop + GoogleCloudPlatform/microservices-demo READMEs — feature-parity benchmarks (FEATURES)
- Official apache/kafka repo compose examples; docker-library/postgres PR #1259 — listener config, PG18 volume change (PITFALLS)
- docs.spring.io OAuth2 Resource Server reference; Next.js v16 official Route Handler docs — JwtDecoder bean, proxy pattern (ARCHITECTURE)
- microservices.io — Database-per-service, Saga, Shared-datastore anti-pattern (ARCHITECTURE)

### Secondary (MEDIUM confidence)
- spring.io Spring Cloud release-train wiki + endoflife.date — Boot↔Cloud matrix, EOL dates (STACK)
- mongodb.com Motor deprecation notice; kafkajs issue #1753 + Confluent/Platformatic blogs — driver/client lifecycle (STACK)
- OWASP JWT Cheat Sheet + WorkOS/PortSwigger algorithm-confusion analyses (PITFALLS)
- Confluent rmoff listener explainers, Axonops Kafka Docker guide, Spring Kafka docs, aiokafka #848, kafkajs #1182 (PITFALLS)
- Baymard Institute figures via multiple secondary citations; 2026 e-commerce feature checklists; Adobe/Magento order-lifecycle docs (FEATURES)
- Contract-first post-mortems (Malt engineering, api-contract-testing.com, oasdiff drift gating) (PITFALLS)

### Tertiary (LOW confidence — validate at build time)
- Kafka UI (Kafdrop/Redpanda Console/provectuslabs) version compatibility with Kafka 4.x (STACK — flagged inline)
- Exact BusyBox wget flag support in chosen alpine base tags (PITFALLS — cheap to verify per phase)

---
*Research completed: 2026-08-24*
*Ready for roadmap: yes*
