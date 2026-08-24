# Feature Research

**Domain:** E-commerce platform (learning-oriented, polyglot microservices demo — 7 backend services + gateway + Next.js storefront on Docker Compose)
**Researched:** 2026-08-24
**Confidence:** MEDIUM (cross-checked across canonical reference apps — Microsoft eShop/dotnet, Google Online Boutique — plus e-commerce UX research; all web-derived claims are secondary-source corroborated)

---

## Headline Finding

The build plan's feature scope is **almost exactly the feature set of Microsoft's canonical microservices demo** (eShopOnContainers / dotnet/eShop): list catalog items, filter by type/brand, add to basket, edit/remove basket items, checkout, register/sign in/out, review orders. That scope is the industry's benchmark for "credible microservices demo," so the plan is neither too thin nor bloated. Google's Online Boutique ships *less* (no login at all, products from a JSON file). The plan's distinctive spine vs both references: **Kafka async event flow (order.created → payment → notification) and real JWT auth**, which are precisely what make it a good DevOps practice target later.

The gaps that would make it feel broken or fake are small and cheap: product detail page, logout, payment-failure UX, an async-aware confirmation page, cart clearing after checkout, and images on seed products. All flagged below.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these and the demo reads as a toy or a broken store. Split into the two views requested: **storefront user journey** and **per-service backend capabilities**.

#### A. Storefront User Journey Features

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| A1 | **Browse without login** — public product listing page with category navigation | First thing every visitor does; forcing login to browse reads as broken (both reference apps allow anonymous browse) | LOW | Gateway must expose `GET /catalog/**` publicly; auth required only from cart onward |
| A2 | **Product detail page (PDP)** — single-product view: name, description, price, image(s), stock indicator, add-to-cart | Universal e-commerce pattern; "browse" without a detail view feels like a list mockup | LOW | Requires explicit `GET /catalog/products/{id}` contract (currently only implied by "product CRUD" — see Gap G1) |
| A3 | **Category filter + text search + sorting** | Table stakes discovery trio; every checklist source lists search/filters/sort together | LOW–MEDIUM | Search planned (Mongo text index suffices at ~20 products); sort by price/name is nearly free — add to contracts |
| A4 | **Cart: add / update qty / remove, with live totals** | The core commerce primitive; editable cart with persistent cost summary directly reduces abandonment (~70% avg abandonment rate, Baymard) | MEDIUM | Planned (Redis keyed `cart:{userId}`). Must validate product ID/price against Catalog at write time (planned) and show line + grand totals |
| A5 | **Cart persistence across sessions + TTL expiry** | Users expect their cart when they come back; abandoned-cart expiry is standard Redis hygiene | LOW | Planned (`cart:{userId}` TTL). Verify expiry observable (already a plan verify criterion) |
| A6 | **Signup / login / logout / `/me`** | Account = order history anchor; logout is listed as a basic feature even in eShop's minimal list | LOW–MEDIUM | Signup/login/JWT/`/me` planned; **logout is not mentioned anywhere in the plan** (Gap G2) |
| A7 | **Checkout: convert cart → order** | The decisive moment; requires address/shipping fields (mock), order summary before confirm | MEDIUM | Order Service snapshots line items **and prices** into the order document at checkout time (never references live cart/catalog prices — catalog can change between add-to-cart and checkout) |
| A8 | **Mock payment step with visible success AND failure outcomes** | Payment is table stakes; but with random success/fail, the *failure path* becomes table stakes too or demos look broken | LOW (backend) / MEDIUM (UX) | Planned random authorization. UI must gracefully render `PAYMENT_FAILED` orders with a clear message and a re-order path (Gap G3) |
| A9 | **Async-aware confirmation page** — order placed → "Processing…" → paid/failed | Because payment resolves via Kafka round-trip, status is NOT available synchronously at checkout; a confirmation page showing stale "pending" forever reads as broken | MEDIUM | Frontend polls `GET /orders/{id}` until terminal state (or refetches on next visit). Requires an order-detail endpoint in contracts (Gap G4). This is the key UX consequence of the event-driven design |
| A10 | **Order history + order detail with status** | "Where is my order?" is the #1 post-purchase expectation; status lifecycle (Pending → Paid/Failed/Canceled) is the industry-standard minimum | LOW–MEDIUM | History planned; detail view needed for A9 anyway |
| A11 | **Order confirmation email** (order number, item summary, status) via Mailhog | Transactional email within minutes is post-checkout table stakes in real commerce; Mailhog makes it observable — great demo moment | LOW | Planned. Specify email content in the Kafka contract phase so emails don't ship stubby (Gap G5) |
| A12 | **Cart cleared after successful checkout** | Leftover cart items after purchase looks buggy; every real store empties the cart | LOW (trivial) | Implied but never stated — make it an explicit acceptance criterion of Phase 5 (Gap G6) |
| A13 | **Realistic seed data: ~20 products WITH images** | A text-only catalog screams "fake"; eShop ships AI-generated images for exactly this reason | LOW | Plan says "~20 sample products" but not images. Bundle placeholder images (local static assets or generated SVGs) in seed script (Gap G7) |
| A14 | **Gateway routing + auth boundary** — protected routes return 401 without valid JWT; downstream services unreachable externally | Single entry point IS the demo's security story | MEDIUM | Planned. Public paths: `/auth/**`, `GET /catalog/**`; protected: `/cart/**`, `/orders/**`, checkout |

#### B. Per-Service Backend Capability Expectations

| Service | Table-Stakes Capabilities | Complexity | Key Design Notes |
|---------|--------------------------|------------|------------------|
| **Auth** (Java/Spring, Postgres) | Signup w/ email uniqueness + password hashing (bcrypt), login, JWT issue/verify, `GET /me` | MEDIUM | No refresh tokens for v1 (see Anti-Features); access token with sane expiry (e.g., 24h local). Logout can be client-side token discard for v1 — honest and sufficient |
| **Catalog** (Python/FastAPI, Mongo) | Product CRUD, get-by-id, category filter, text search, sort params, limit/skip pagination, seed script w/ images | LOW–MEDIUM | Pydantic v2 models mirror OpenAPI contract. CRUD exists for completeness/demo-ability via Swagger; no admin UI needed (Anti-F4) |
| **Cart** (Node/Express, Redis) | Add/update/remove/get items keyed `cart:{userId}`, quantity guards (≥1, sane max), TTL, server-side price validation vs Catalog | MEDIUM | Cart stores product ID + qty only; **price always re-fetched from Catalog** (single source of truth). Totals computed server-side |
| **Order** (Java/Spring Kafka, Postgres) | Create order from cart snapshot, persist, produce `order.created`, consume `payment.completed` → update status, order history, order detail | HIGH (hardest service — owns the state machine + both sides of the Kafka flow) | Status machine: `PENDING_PAYMENT → PAID \| PAYMENT_FAILED \| CANCELLED`. Consumer must tolerate at-least-once redelivery (status transitions idempotent — setting PAID twice is harmless if guarded) |
| **Payment** (Python/FastAPI, stateless) | Consume `order.created`, mock authorize, produce `payment.completed` carrying outcome (`APPROVED\|DECLINED`) | MEDIUM | Recommend one topic + outcome field over separate `payment.failed` topic (fewer contracts, same information). Add deterministic mode env var (D1 below) |
| **Notification** (Node/kafkajs, Mailhog) | Consumer group on both topics, render email (order number, items, status), deliver to Mailhog | LOW–MEDIUM | Dedupe by event ID to avoid double emails on rebalance/redelivery (cheap insurance) |
| **Gateway** (Spring Cloud Gateway) | Route table for 5 path prefixes, JWT validation filter, public/protected route classification | MEDIUM | Rate limiting is planned but is *above* table stakes for demos (neither reference app gates on it) — keep it, it's cheap in SCG and a future load-test target (see Not-Table-Stakes note N1) |

### Differentiators (Competitive Advantage)

For this project "competitive advantage" = features that make the demo credible to a technical audience and richer as a DevOps practice target — NOT consumer-facing extras.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Deterministic payment simulation mode** — `PAYMENT_MODE=always_success\|always_fail\|random` env var | Makes the scripted E2E smoke test (Phase 9) deterministic instead of flaky-random; lets you demo the failure path on demand. Highest value-per-line-of-code on this list | LOW | Strongly recommended. Random mode stays default for realism in manual demos |
| D2 | **Idempotency keys on checkout** (`Idempotency-Key` header on POST /orders) | Prevents duplicate orders from double-clicks/retries — a real production problem; classic interview-worthy pattern; pairs well with the random-failure mode | MEDIUM | Order Service stores key→order mapping; replays return existing order. If deferred, at minimum disable the checkout button client-side |
| D3 | **Consumer-side dedupe (event IDs)** in Notification | Notification survives Kafka redeliveries/rebalances without duplicate emails — demonstrates at-least-once semantics awareness | LOW–MEDIUM | Cheap: track processed event IDs in Redis/memory with window |
| D4 | **Order status timeline component** (visual state machine in order detail) | High perceived quality for low effort; makes the async saga *visible* — the whole point of the app | LOW–MEDIUM | Pure frontend over existing status field |
| D5 | **Per-service Swagger/OpenAPI UI exposed in dev** | FastAPI gives it free; springdoc for Spring. Technical-audience credibility + debugging aid during milestones | LOW | Aligns with contracts-first strategy; document in runbook |
| D6 | **Sort + pagination on catalog/list endpoints** | Professional API surface; nearly free in FastAPI/Mongo and Spring Data | LOW | Bake into Phase 1 contracts so they're contractual, not bolted on |
| D7 | **Simulated fulfillment transition** (script/admin endpoint flips PAID → SHIPPED → DELIVERED) | Completes the lifecycle story honestly ("simulated shipping" like Boutique's mock shippingservice) without building logistics | LOW–MEDIUM | Optional; only after v1 core is stable. Without it, orders ending at PAID is fine and honest |
| D8 | **Transactional outbox pattern** (Order Service) | THE canonical microservices reliability pattern (no dual-write between Postgres commit and Kafka publish); superb future material for the observability/resilience learning arc | HIGH | Defer to v2 unless message-loss pain appears early. Flag now so the order persistence schema doesn't preclude it |

### Anti-Features (Deliberately NOT Building)

Includes everything excluded in the plan plus things commonly requested that this project should refuse.

| # | Feature | Why Requested (surface appeal) | Why Problematic (here) | Alternative |
|---|---------|-------------------------------|------------------------|-------------|
| AF1 | **Real payment processing** (Stripe/PayPal) | "It's not a real store otherwise" | Accounts, PCI posture, external network dependency, non-reproducible demos — excluded by design | Mock processor + outcome-carrying events (planned) |
| AF2 | **OAuth2/OIDC provider** (Keycloak/Auth0) | "Production-grade auth" | Another heavyweight container; distracts from JWT mechanics the gateway needs to exercise; excluded by design | Plain JWT issue/verify (planned); refresh-token flow is the v1.x middle ground if desired |
| AF3 | **Guest checkout** | Real-commerce conversion best practice (~19–24% of abandonment is forced signup, Baymard-cited) | **Conflicts with project purpose**: the authenticated JWT journey through gateway → cart → order IS the exercise. Note: this is a deliberate, documented deviation from real-commerce advice | Require login before cart/checkout (as planned); keep browsing public (A1) preserves most of the friction win |
| AF4 | **Admin dashboard/UI** | "Someone has to manage products" | Needs role-based authz (new concept), new frontend surface, near-zero learning ROI for the DevOps arc | Seed scripts + CRUD-via-Swagger (D5) |
| AF5 | **Reviews & ratings** | Ubiquitous on real stores | Moderation problem, new aggregate, new service boundary; cosmetic at 20 seed products | Static placeholder trust signals in UI copy if wanted |
| AF6 | **Coupons/promotions engine** | Marketing staple | Contaminates pricing logic across Cart, Order snapshot, and Payment amounts simultaneously; hard to retrofit honestly | Fixed prices only; totals computed once at checkout |
| AF7 | **Real inventory reservation/deduction** | "Stock counts should go down" | Distributed-transaction trap across Catalog↔Order; oversell/race conditions; worst complexity-to-value ratio on this list | Display-only `stock` field on products (A2); note in docs that inventory sync is a future arc |
| AF8 | **Wishlist** | Common retention feature | New storage design + endpoints for marginal learning value; eShop skips it too | None needed |
| AF9 | **Elasticsearch/OpenSearch for search** | "Real stores use ES" | Heavy container, another ops surface; Mongo text index is fully adequate at 20 products | Mongo `$text` / regex search (planned) |
| AF10 | **Boutique-style extra services** (currency, shipping-quote, recommendations, ads) | "More services = more impressive" | Each adds a container + contract without advancing the JWT/Kafka/polyglot story; dilutes focus | Revisit SHIPPED-state simulation (D7) only if lifecycle richness is missed |
| AF11 | **Micro-frontends / BFF-per-client / second frontend** | Architecture-fashionable | One Next.js storefront through one gateway is right-sized; BFF variants multiply build/deploy surface | Single Next.js app using Next server routes → gateway (planned) |
| AF12 | **Refresh-token rotation / token revocation lists** | Security completeness | Stateful session machinery contradicts the stateless-JWT lesson; revocation needs another datastore | Short-ish lived JWT + logout-as-client-discard for v1 |
| AF13 | **Password reset / email verification flows** | Standard account features | Fake flows through Mailhog feel more fake than no flow; expands Auth scope | Document as deliberate exclusion; signup just works |
| AF14 | **Schema Registry/Avro, multi-broker Kafka, K8s, CI/CD, observability stack** | Production parity | Already excluded per plan §5 — they are the *next* project's curriculum against this stable target | JSON contracts in `docs/kafka-topics.md` (Phase 1); KRaft single broker (planned) |

---

## Build Plan Audit (requested flags)

### In the plan but NOT table stakes (keep anyway — know why)

| Plan Item | Verdict |
|-----------|---------|
| Gateway rate limiting | Above demo-minimum (neither reference app includes it); cheap in Spring Cloud Gateway; keep — future load-testing target |
| Redis TTL for abandoned carts | Slightly beyond minimum; nice Redis-semantics demonstration; keep |
| Kafka partitions=3 + kill/restart offset testing (Phase 5 verify) | Operational maturity beyond typical demos; perfectly aligned with learning goal; keep |
| Full product CRUD (vs read-only catalog) | Real stores need it internally, but a demo could be read-only + seed script; keep because it enables Swagger-driven demos and costs little |

### Missing from the plan — would make the demo feel broken or fake

| Gap | Fix | Where |
|-----|-----|-------|
| **G1:** PDP endpoint implicit, not contractual | `GET /catalog/products/{id}` in Phase 1 OpenAPI + PDP route in Phase 8 | Phase 1, 8 |
| **G2:** Logout nowhere mentioned | Client-side token discard + header link; trivially satisfy eShop's basic-feature bar | Phase 2/8 |
| **G3:** Random payment failures have no UX home | Render `PAYMENT_FAILED` status with message + re-order affordance; treat as first-class state, not error toast | Phase 5 contract, Phase 8 UI |
| **G4:** Confirmation is async — no polling/detail endpoint specified | `GET /orders/{id}` in contracts; confirmation page polls until `PAID\|PAYMENT_FAILED` | Phase 1, 5, 8 |
| **G5:** Email content unspecified | Define order-number/items/status payload in `kafka-topics.md` so Mailhog emails look real | Phase 1 |
| **G6:** Cart clearing after checkout unstated | Explicit acceptance criterion in Phase 5 verify | Phase 5 |
| **G7:** Seed products have no images | Bundle ~20 placeholder images with seed script | Phase 3 |
| **G8:** Checkout double-click can double-order | Idempotency keys (D2) or, minimally, client-side button disabling | Phase 5/8 |

---

## Feature Dependencies

```
[Contracts: OpenAPI + Kafka topics]  ←── everything depends on this (polyglot drift guard)
    │
    ├──> [Auth Service]
    │        └──requires──> [Gateway JWT filter] ──requires──> [Protected /cart /orders] ──requires──> [Frontend auth flows: login/signup/logout]
    │
    ├──> [Catalog Service + seed data w/ images]
    │        ├──enables──> [Browse + PDP + search/filter/sort]   (public, no auth)
    │        └──requires-by──> [Cart validation] ──enhances──> [Checkout correctness]
    │
    ├──> [Cart Service (Redis)]
    │        └──feeds──> [Checkout: convert cart → order snapshot] ──requires──> [Cart clearing on success]
    │
    ├──> [Kafka broker]
    │        └──carries──> [order.created] ──consumed-by──> [Payment mock] ──produces──> [payment.completed]
    │                                                                    │
    │                                          consumed-by────────────────┤
    │                                                    │                │
    │                                            [Order status update]   [Notification → Mailhog email]
    │                                                    │
    │                                        [Order history/detail UI] ──polls──> [Confirmation page A9]
    │
    └──> [Gateway routing] ──last-mile──> [Next.js consumes ONLY gateway]

[Deterministic PAYMENT_MODE] ──resolves-conflict──> [Random failure] vs [Scripted E2E smoke test]
```

### Dependency Notes

- **Everything requires Contracts (Phase 1):** three languages, no shared types — REST shapes and event schemas are the only interoperability guarantee. Any feature added later (sort params, outcome fields, order-detail endpoint) must land in contracts first.
- **A9 (confirmation page) requires G4 (order-detail endpoint):** the async payment round-trip means checkout cannot return final status; polling `GET /orders/{id}` is the mechanism. This dependency crosses service/frontend phases — decide the endpoint shape in Phase 1.
- **A8 requires D1 to be demo-safe:** random payment failure + scripted smoke test = flaky verification. Deterministic mode converts a conflict into a config choice.
- **Catalog enhances Cart and Checkout:** cart validates against catalog (planned); checkout snapshots prices — if catalog changes mid-session, the *order* stays truthful. This is why orders copy data rather than reference it.
- **AF3 (guest checkout) conflicts with the authenticated-journey goal:** documented deviation; public browsing (A1) keeps the friction argument mostly moot.
- **AF7 (inventory deduction) conflicts with v1 simplicity:** cross-service stock mutation reintroduces distributed transactions the architecture deliberately avoids.

---

## MVP Definition

The whole plan is one milestone (v1.0, Phases 0–10), so "MVP" here = what each phase must include vs what can slip without breaking the demo.

### Launch With (v1) — the full journey, gap-fixed

- [ ] Public browse: catalog list, category filter, text search, PDP, sort+pagination params (A1–A3, D6) — the store must feel browsable before any auth
- [ ] Auth: signup/login/logout//me, JWT through gateway, httpOnly cookie (A6, A14)
- [ ] Cart: add/update/remove, server-side totals, catalog validation, persistence + TTL (A4–A5)
- [ ] Checkout → order snapshot → `order.created` → mock payment → `payment.completed` → status update (A7–A8)
- [ ] Async-aware confirmation page + order detail + order history (A9–A10)
- [ ] Mailhog emails with real content (order number, items, status) (A11)
- [ ] Cart cleared on success; PAYMENT_FAILED rendered gracefully (G3, G6)
- [ ] Deterministic `PAYMENT_MODE` env var (D1) — protects the Phase 9 smoke test
- [ ] Seeded catalog with images (A13/G7)
- [ ] Compose wiring + healthchecks + scripted E2E smoke test passing end-to-end

### Add After Validation (v1.x)

- [ ] Idempotency keys on checkout (D2) — trigger: once the happy path is stable; doubles as retry-safety for the smoke test
- [ ] Consumer dedupe in Notification (D3) — trigger: observed redelivery during kill/restart experiments
- [ ] Order status timeline UI (D4) — trigger: frontend polish pass
- [ ] Swagger UI exposure documented per service (D5) — trivial, anytime
- [ ] Simulated SHIPPED/DELIVERED transitions (D7) — trigger: if lifecycle feels truncated in demos

### Future Consideration (v2+ / next DevOps arc)

- [ ] Transactional outbox pattern (D8) — pairs naturally with the observability/resilience learning arc
- [ ] Refresh-token flow — if longer-lived sessions become annoying locally
- [ ] Everything in §5 exclusions: K8s/Helm, CI/CD, observability, secrets, Schema Registry, OIDC, real payments

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|-----------|--------------------|----------|
| Browse/PDP/search/filter (public) | HIGH | LOW–MED | P1 |
| Auth (signup/login/logout/me) + gateway boundary | HIGH | MED | P1 |
| Cart (validated, persisted, totals) | HIGH | MED | P1 |
| Checkout → order → mock payment → status (full Kafka loop) | HIGH | HIGH | P1 |
| Async-aware confirmation + order detail/history | HIGH | LOW–MED | P1 |
| Notification emails w/ real content | MEDIUM | LOW | P1 |
| Seed data with images | HIGH (realism) | LOW | P1 |
| Payment-failure UX | HIGH (demo integrity) | LOW | P1 |
| Deterministic PAYMENT_MODE | HIGH (testability) | LOW | P1 |
| Cart clearing post-checkout | MEDIUM | LOW | P1 |
| Sort/pagination params | MEDIUM | LOW | P2 |
| Idempotency keys | MEDIUM | MED | P2 |
| Consumer dedupe | MEDIUM | LOW–MED | P2 |
| Status timeline UI | MEDIUM | LOW–MED | P2 |
| Swagger UI exposure | MEDIUM (technical cred) | LOW | P2 |
| SHIPPED/DELIVERED simulation | LOW–MEDIUM | LOW–MED | P3 |
| Transactional outbox | MEDIUM (learning) | HIGH | P3 |

**Priority key:** P1 = demo is broken/fake without it · P2 = should have, add when stable · P3 = future consideration

---

## Competitor Feature Analysis

Benchmarked against the two canonical open-source microservices e-commerce demos.

| Feature | dotnet/eShop (Microsoft) | Online Boutique (Google) | Our Approach |
|---------|--------------------------|--------------------------|--------------|
| Identity/auth | Dedicated Identity service; register/sign-in/sign-out | **None** — auto session IDs, no login | JWT service (Java) + gateway filter — middle ground, deliberately exercises token flow |
| Catalog | Postgres-backed catalog API, filter by type/brand | Products served from a **JSON file** | Mongo + FastAPI, CRUD + text search + seed script — most realistic of the three |
| Cart | Redis basket service | C# cart service + Redis | Node/Express + Redis keyed by user, TTL — matches both references' pattern |
| Checkout/ordering | Ordering service + event bus integration events | Synchronous gRPC orchestration (checkoutservice calls payment/shipping/email directly) | Java ordering + **Kafka async saga** — our distinctive spine |
| Payment | Mock payment via event flow | Mock charge returning transaction ID | Mock authorization with outcome-carrying event + deterministic mode (D1) — more testable than either |
| Email/notification | Event-handler email | Mock emailservice called synchronously | Kafka consumer group + Mailhog — observable, decoupled |
| Async bus | RabbitMQ-style event bus abstraction | **None** (sync gRPC) | Kafka KRaft, JSON contracts — strongest differentiator vs both |
| API gateway/BFF | Yes (gateways per front-end) | No (frontend calls services directly) | Spring Cloud Gateway w/ JWT filter — matches eShop's pattern |
| Reviews/coupons/inventory/wishlist/admin | Absent | Absent | Also absent (anti-features AF4–AF8) — parity with canonical demos confirms these aren't expected |
| Extras (currency/shipping/recs/ads) | Absent | Present (adds 4 services + loadgen) | Excluded (AF10) — right call for focus; our heterogeneity budget goes to 3 languages × 3 datastores instead |

**Verdict:** the plan sits at feature parity with the industry-standard demos while being *more* demanding operationally (Kafka + auth + polyglot persistence) — exactly the profile a DevOps practice target wants. Nothing in the plan is gratuitous; the additions it needs are the eight small gaps (G1–G8).

---

## Sources

- Microsoft Learn — *Introducing eShopOnContainers reference app* (features/requirements list; verified 2026-08-24): https://learn.microsoft.com/en-us/dotnet/architecture/cloud-native/introduce-eshoponcontainers-reference-app
- github.com/dotnet/eShop — current reference app README/architecture (HIGH confidence, primary repo)
- github.com/GoogleCloudPlatform/microservices-demo — Online Boutique README, 11-service table incl. "does not require signup/login", JSON-file catalog, mock payment/shipping/email (HIGH confidence, primary repo)
- Baymard Institute figures (~70.22% avg cart abandonment; forced-account & hidden-cost drivers) as cited by multiple secondary sources (designstudiouiux.com, growth-engines.com, heurilens.com, miledevs.com) — MEDIUM confidence (secondary citations)
- E-commerce feature checklists 2026 (corroborating table-stakes sets): tonjoo.com, wowinfotech.com, lucidly.ae, shrimo.com, stellar-soft.com, mediasearchgroup.com
- Order-status lifecycle patterns: Adobe Commerce order workflow docs, Magento 2 state/status guides (mgt-commerce.com, mageplaza.com, amasty.com), dsers.com fulfillment-status guide — MEDIUM confidence
- Cached digests: 5 entries in research-store (keys 56d3fcad…, d94bac30…, 0187edb…, 54288ffa…), provider brave/websearch fallback, confidence MEDIUM (verified tier via classify-confidence)

---
*Feature research for: Ecommerce Microservices Platform (learning-oriented polyglot demo)*
*Researched: 2026-08-24*
