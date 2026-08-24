# Architecture Research

**Domain:** Polyglot e-commerce microservices platform (Spring Cloud Gateway + Java/Spring Boot auth & order + Python/FastAPI catalog & payment + Node/Express cart + Node/kafkajs notification, Kafka KRaft event bus, Postgres/MongoDB/Redis, Next.js frontend, Docker Compose)
**Researched:** 2026-08-24
**Confidence:** MEDIUM (architecture patterns cross-checked against canonical sources — microservices.io database-per-service & saga pattern pages, official Spring Security resource-server docs, official Next.js 16 route-handler docs — plus multiple independent 2024–2026 implementations; per source-hierarchy seam, web-derived findings cap at MEDIUM)

> Components are **fixed** by the build plan and PROJECT.md. This document defines *how they connect*: boundaries, data ownership, event contracts, trust model, build order, and monorepo conventions. Version pins live in STACK.md; failure-mode detail lives in PITFALLS.md.

---

## Standard Architecture

### System Overview

```
                                   EXTERNAL (published ports only)
        ┌──────────────┐                ┌───────────────────┐
        │   Browser    │◄──────────────►│  Next.js :3000    │  frontend
        └──────┬───────┘  same-origin   │ (App Router)      │
               │  /api/*    /api/*      └────────┬──────────┘
               ▼                    server-side │ fetch + httpOnly cookie
        ════════════════════════════════════════╪═══ Docker network (internal) ═══
                                                ▼
                                     ┌─────────────────────┐
                                     │  API Gateway :8080  │ Spring Cloud Gateway
                                     │  route + JWT check  │ (WebFlux/Netty)
                                     └──────┬──────────────┘
              ┌──────────────────┬──────────┼────────────────┬──────────────┐
              ▼                  ▼          ▼                ▼              ▼
      ┌──────────────┐  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
      │ auth :8081   │  │ catalog      │ │ cart     │ │ order    │ │ payment :8001│
      │ Java/Spring  │  │ :8000        │ │ :3001    │ │ :8082    │ │ FastAPI      │
      │ issues JWT   │  │ Python/FastAPI│ │ Node/Expr│ │ Java/Spr.│ │ (Kafka only; │
      └──────┬───────┘  └──────┬───────┘ └────┬─────┘ └───┬──┬───┘ │  /health)    │
             ▼                 ▼              ▼           │  │     └──────▲───────┘
        PostgreSQL       MongoDB          Redis            │  │            │
        db: users        products         cart:{userId}    │  └── payment.completed
        db: orders       collection       + TTL            ├── order.created ──┐
        (one pg:18       (mongo:8.0)      (redis:8)        │                   │
         container,                                        ▼                   │
         2 logical DBs,                          ┌──────────────────┐         │
         separate creds)                         │ Kafka :19092     │◄────────┘
                                                 │ (apache/kafka    │  topics:
                                                 │  4.2.1 KRaft ×1) │  order.created
                                                 └───────▲──────────┘  payment.completed
                                                         │
                                          ┌──────────────┴───────────┐
                                          │ notification (Node worker│──► Mailpit :1025
                                          │ kafkajs; no HTTP port)   │    (SMTP mock,
                                          │ consumes BOTH topics     │     UI :8085 pub)
                                          └──────────────────────────┘
```

**Published ports:** only `3000` (frontend), `8080` (gateway), plus operator UIs (Mailpit, Kafka UI, host-side Kafka listener `localhost:9092`). All seven services are reachable *only* inside the Docker network once the gateway phase completes. During their own build phases, individual services temporarily publish ports for standalone curl smoke tests — those publications are removed when the gateway phase lands.

### Component Responsibilities

| Component | Responsibility | Owns (data) | Talks to |
|-----------|----------------|-------------|----------|
| **api-gateway** (Java/SCG) | Single ingress; path routing; JWT signature/claim validation on protected routes; CORS policy point | nothing (stateless) | auth, catalog, cart, order (HTTP reverse-proxy) |
| **auth-service** (Java/Spring) | Signup, login, `/me`; issues signed JWTs; user profile persistence | Postgres `users` DB exclusively | gateway (served); nobody else |
| **catalog-service** (Python/FastAPI) | Product CRUD, category filter, text search; serves product truth to cart & frontend | MongoDB `products` exclusively | gateway (served); cart (internal REST client) |
| **cart-service** (Node/Express) | Add/remove/update cart items; TTL expiry; validates product IDs/prices against catalog; computes totals | Redis `cart:{userId}` keys exclusively | gateway (served); catalog (REST client) |
| **order-service** (Java/Spring + spring-kafka) | Create order from cart snapshot; persist; produce `order.created`; consume `payment.completed` → status transitions; order history | Postgres `orders` DB exclusively; Kafka group `order-service` | gateway (served); Kafka (produce+consume); cart (reads cart via gateway-facing contract or direct internal call — see §Communication) |
| **payment-service** (Python/FastAPI + aiokafka) | Stateless mock authorizer: consume `order.created` → authorize → produce `payment.completed`. No DB. REST surface is `/health` only | nothing persisted; Kafka group `payment-service` | Kafka only |
| **notification-service** (Node worker + kafkajs) | Consume both topics; log; render + send mock email via SMTP | nothing (dedup window in memory is acceptable for v1) | Kafka only; Mailpit |
| **frontend** (Next.js) | Browse, cart, checkout, order-history UI; same-origin API proxy; httpOnly cookie session | nothing | gateway (server-side fetch through Compose network) |
| **kafka** | Async decoupling of order↔payment↔notification; durable replay log | topics `order.created`, `payment.completed` | order, payment, notification |

---

## Communication Topology

### Decision rule: sync REST for reads/validation on the user's critical path; async Kafka for business-event side effects

Sync when the caller cannot produce a correct response without the answer *now* (cart needs a current price before accepting an item). Async when the action is a business fact others react to eventually (an order existing, a payment concluding) — this buys decoupling, replay, and tolerance of downstream downtime.

### Complete edge list

| # | Caller → Callee | Protocol | Purpose | Contract |
|---|-----------------|----------|---------|----------|
| 1 | Browser → frontend :3000 | HTTPS/HTTP | UI + same-origin `/api/*` | — |
| 2 | frontend → gateway :8080 | HTTP (Compose-internal) | ALL API traffic; cookie⇄Bearer translation happens in frontend proxy | OpenAPI per service |
| 3 | gateway → auth / catalog / cart / order | HTTP | Routing; JWT filter enforces auth on protected prefixes (`/cart/**`, `/orders/**`, `/auth/me`) | OpenAPI |
| 4 | **cart → catalog** | HTTP (internal, `http://catalog:8000`) | Validate productId exists + fetch authoritative `priceCents` at add-time; batch re-validate at checkout | OpenAPI `GET /catalog/products/{id}`, `POST /catalog/products/batch` (add to spec in contracts phase) |
| 5 | order → cart | HTTP (internal) | Read cart contents at checkout to snapshot into the order | OpenAPI `GET /carts/{userId}` |
| 6 | order → Kafka | produce | `order.created` after persisting order row (PENDING) | `docs/kafka-topics.md` |
| 7 | Kafka → payment | consume (group `payment-service`) | Trigger mock authorization | same |
| 8 | payment → Kafka | produce | `payment.completed` (outcome APPROVED/DECLINED) | same |
| 9 | Kafka → order | consume (group `order-service`) | Status transition on payment outcome | same |
| 10 | Kafka → notification | consume (group `notification-service`, both topics) | Email rendering/sending | same |
| 11 | notification → Mailpit | SMTP | Mock email delivery | — |

**Edges that must NOT exist:** payment → any REST call (it is purely reactive); notification → any REST call; auth in any per-request path (gateway validates tokens locally, never phones auth); any service → another service's datastore; browser → any service except via frontend/gateway.

Cart→Catalog is deliberately the **only** synchronous service-to-service dependency (plus order→cart at checkout). Keeping the sync graph nearly a star around the gateway is what prevents this becoming a distributed monolith: a catalog outage degrades add-to-cart (return 503 with friendly copy), but browsing and checkout of already-snapshotted carts still work.

---

## Data Ownership & Cross-Service Access

### Ownership table

| Datastore | Logical DB/collection | Owner (sole writer) | Consumers get data via |
|-----------|----------------------|--------------------|-----------------------|
| `postgres:18` container | `users` DB — `users(id, email, password_hash, created_at)` | auth-service | REST (`/me`, login response); userId travels in JWT claims |
| `postgres:18` container | `orders` DB — `orders(id, user_id, status, total_cents, currency, created_at)` + `order_items(order_id, product_id, name_snapshot, unit_price_cents, qty)` | order-service | REST (`GET /orders`, `/orders/{id}`); `order.created` event carries item snapshots |
| `mongo:8.0` | `products` collection | catalog-service | REST (list/search/get/batch); price/name snapshots embedded in cart items and order items |
| `redis:8` | `cart:{userId}` hash/string + TTL | cart-service | REST (`GET /carts/{userId}` used by order at checkout) |
| Kafka log | `order.created`, `payment.completed` | producers per topic | consumer groups (append-only, replayable) |

One Postgres *container* hosting two logical databases (`users`, `orders`) with **separate DB user accounts and grants** (auth-role sees only `users`; order-role sees only `orders`) is the correct v1 posture: Richardson's pattern explicitly ranks private-database-per-service on a shared server as a valid isolation tier, and recommends credential barriers precisely because "without some kind of barrier… developers will always be tempted to bypass a service's API." Splitting into two containers is trivial later (change JDBC URL, nothing else).

### Why cross-service access goes through APIs, never shared connections

Verified against the canonical pattern source (microservices.io, "Database per service"):

1. **Schema-migration coupling** — a column change in `users` would silently break any service querying it directly; via API, only the contract version matters.
2. **Load coupling** — another service's full-scan becomes your latency spike; datastore stays tuned to its single owner's access pattern.
3. **Polyglot persistence is the point** — this project intentionally exercises document (products), relational-ACID (users/orders), and TTL-key-value (carts) models matched to workload. Shared access would erase the boundary the heterogeneity is meant to teach.
4. **Independent deployability** — the eventual Kubernetes target scales/restarts datastores per-owner without cross-service blast radius.

### How every "but service X needs Y's data" case resolves

| Tempting shortcut | Correct resolution |
|---|---|
| Order shows product names/prices | **Snapshot at write time**: cart items carry `priceAtAdd` (validated against catalog); order_items persist `name_snapshot`, `unit_price_cents` from the cart at checkout. Orders never query Mongo — historical orders stay immutable even if products change. |
| Order page shows customer email/name | Read from JWT claims (`email`) at render time in the frontend; order rows store only `user_id`. If admin views ever need other users' emails → API composition (call auth's future admin endpoint), still not a DB join. |
| Cart needs current prices | Internal REST call (#4 above) with batch endpoint + short-TTL cache of existence checks; never a Mongo connection from cart. |
| Checkout needs cart contents | order → cart REST (#5); cart remains sole Redis reader. |
| Notification greets the user | `order.created` payload includes `userEmail` (denormalized deliberately — events are messages, not normalized relations). |

---

## Event Flow: The Order–Payment Saga

### Shape: choreography (no orchestrator)

With exactly two participating steps plus observers, choreography is the right call — an orchestrator would be a whole extra service managing a two-step flow. The tradeoff is accepted consciously: saga state is implicit (order.status *is* the saga state), which is visible enough for v1 and debuggable via Kafka UI. Revisit orchestration only when a third+ transactional participant (inventory, shipping) appears.

```
 order-service          Kafka                     payment-service            notification
     │                    │                             │                        │
 POST /orders            │                             │                        │
 1. validate + persist   │                             │                        │
    Order{PENDING}       │                             │                        │
 2. produce ─────────────┼─► order.created ────────────► consume                 │
 3. respond 201          │   key=orderId               │ 3a. dedup: orderId seen?
    {orderId,PENDING}    │   partitions=3              │ 3b. mock authorize     │
                         │                             │ 3c. produce ───────────┼──► (same group
                         │◄─ payment.completed ◄───────┼──── payment.completed  │     sees both
 4. consume ─────────────┼   key=orderId               │    (commit offset      │     topics)
    guard: only          │   outcome=APPROVED/DECLINED │     AFTER produce)     ▼
    PENDING→terminal     │                             │                   email via
 5. update status        │                             │                   Mailpit
    PAID | PAYMENT_FAILED│                             │
```

### Topic contracts (to be frozen in contracts phase — `docs/kafka-topics.md`)

| Field | `order.created` | `payment.completed` |
|---|---|---|
| Producer | order-service | payment-service |
| Consumers (groups) | payment-service; notification-service | order-service; notification-service |
| Key | `orderId` (string) — guarantees per-order ordering within partition | `orderId` |
| Partitions | 3 (declared now; enables scaling consumers later; auto-create disabled) | 3 |
| Payload | `eventId`(uuid), `orderId`(string), `userId`(string), `userEmail`, `items[] {productId, nameSnapshot, unitPriceCents, quantity}`, `totalCents`(int minor units), `currency`(ISO 4217), `createdAt`(ISO-8601 ms UTC) | `eventId`(uuid), `orderId`, `outcome`: `"APPROVED"\|"DECLINED"`, `reason?`(string, present when DECLINED), `processedAt` |
| Dedup key (consumer contract) | payment: `orderId` skip-if-authorized; notification: `eventId` | order: `orderId` + state-machine guard; notification: `eventId` |
| Delivery semantics | at-least-once; consumers idempotent | at-least-once; consumers idempotent |

Contract decisions worth locking now: **one** `payment.completed` topic carrying an explicit `outcome` field (rather than separate success/failure topics) — matches the two-topic plan pin, lets notification branch on outcome from a single subscription, and keeps the order consumer's routing trivial. All IDs are strings; money is integer cents; timestamps ISO-8601 millisecond UTC (PITFALLS #5 interop rules).

### Order status state machine (order-service owns it)

| From | Event | Guard | To |
|------|-------|-------|----|
| *(none)* | POST /orders (valid cart) | always | `PENDING` |
| `PENDING` | `payment.completed{APPROVED}` | transition allowed | `PAID` ✅ terminal |
| `PENDING` | `payment.completed{DECLINED}` | transition allowed | `PAYMENT_FAILED` ✅ terminal |
| `PENDING` | duplicate `payment.completed` (redelivery) | **guard rejects** — log & ack | unchanged |
| `PAID`/`PAYMENT_FAILED` | any further event | **guard rejects** — terminal states immutable | unchanged |

Optional v1.1: user-initiated `CANCELLED` from `PENDING` only (would require a compensation story with payment — out of scope while payment is a mock).

The state-machine guard **is** the idempotency mechanism for order-service (natural upsert pattern — verified as the recommended approach for state-replacement events). Payment-service uses an explicit `orderId`-seen check; notification dedupes on `eventId` (in-memory LRU suffices for v1 since it has no store).

### Consumer group layout

```
topic order.created      p0 p1 p2     topic payment.completed   p0 p1 p2
        │                                      │
group payment-service ──── all ────           │
group notification-service (subscribed to BOTH topics, one group)
group order-service ────────────────────────── all
```

Rules: **one group per consuming service** so every subscriber receives its own copy; `auto.offset.reset=earliest` (first-run groups don't skip pre-existing events); enable.auto.commit **off** everywhere — process → produce (payment) → commit, so a crash between authorize and produce loses nothing and a crash after produce merely redelivers (idempotent receivers absorb it). Single instance per group in v1; the 3-partition layout means adding a second payment/notification instance later requires zero topic changes.

### Failure modes the design absorbs

| Failure | System behavior |
|---|---|
| Payment service down when order placed | Order stays `PENDING`; events accumulate in partition; on restart the group resumes → saga completes late. Checkout UX shows honest "processing payment" state (poll order status). |
| Payment killed mid-processing (the Phase-5 verify test) | Redelivery on rebalance → dedup on `orderId` → exactly-one `payment.completed` effect. |
| Duplicate `order.created` (producer retry) | Payment skips already-authorized orders. |
| Notification processes `payment.completed` before seeing `order.created` | Allowed by design; notification renders from the completed-event payload alone and does not assume cross-topic ordering. |
| Declined payment | `PAYMENT_FAILED` order persists (history shows it); notification sends decline email. |

---

## Authentication Flow

### Sequence

```
Browser                 Next.js (:3000)            Gateway (:8080)           auth (:8081)
   │  POST /api/auth/login    │                          │                       │
   ├─────────────────────────►│  forward (no cookie yet) │  route /auth/**       │
   │                          ├─────────────────────────►├──────────────────────►│ verify bcrypt
   │                          │                          │◄─── 200 {accessToken, user}
   │                          │ set-cookie:              │                       │
   │◄── 200 {user},           │ SESSION=httpOnly,Lax,    │                       │
   │    Set-Cookie applied    │ Path=/, Max-Age≈3600     │                       │
   │                          │                          │                       │
   │  GET /api/orders         │ attach Authorization:    │  validate sig(HS256)+ │
   ├─────────────────────────►│ Bearer <jwt> (from       │  iss+aud+exp LOCALLY  │
   │                          │ cookie via cookies())    │  ── no auth call ──   │
   │                          ├─────────────────────────►├── forward w/ header ─►(order svc reads
   │◄── order JSON            │                          │                       │ sub=user_id)
```

1. **Login**: `POST /api/auth/login` hits the Next.js route handler → gateway routes (public, allowlisted) → auth verifies credentials, mints JWT (HS256, ~1 h TTL) returning `{accessToken, user}` in the body. **The frontend proxy sets the httpOnly cookie** and never relays the raw token to browser JS. Rationale: keeps auth-service a clean Bearer API (cookie policy is a presentation-layer concern), puts all cookie logic in one file, and sidesteps gateway `Set-Cookie`+CORS fragility (PITFALLS #9).
2. **Subsequent requests**: browser attaches cookie automatically (same-origin). Route handlers/server components read it via `cookies()`/`NextRequest.cookies` and attach `Authorization: Bearer …` toward the gateway.
3. **Gateway validation**: enforced by Spring Security resource-server filter chain *inside* SCG — verified against current Spring Security docs: `issuer-uri` alone is **not usable** here (it demands an OIDC discovery endpoint our auth-service won't have). Instead define a `JwtDecoder` bean via `NimbusJwtDecoder.withSecretKey(...)`, pin the algorithm (default trust is RS256-only — HS256 must be explicit, never header-derived), and add validators for `iss` + `aud` (Boot's `audiences:` property or `JwtValidators.createDefaultWithIssuer`). ~60 s clock-skew leeway. Public paths (`/auth/signup`, `/auth/login`, `/catalog/**` reads) bypass the filter.
4. **Downstream trust model** (three tiers, documented in contracts):
   - **Network perimeter**: services bind inside the Compose network only; nothing but gateway (and frontend) publishes ports. This is the primary v1 boundary.
   - **Gateway = policy enforcement point**: signature, expiry, issuer, audience checked exactly once, centrally. Downstream services stay dependency-free regarding auth.
   - **Defense-in-depth claim extraction (optional but cheap)**: downstream services parse the *forwarded* `Authorization` header to extract `sub`/`email` claims (they never trust `userId` from request bodies or query params). They may re-verify signatures later without architecture change.

### JWT claims contract (frozen in contracts phase)

| Claim | Value | Notes |
|---|---|---|
| `sub` | userId (**string**) | the only identity downstream services rely on |
| `email` | user email | denormalized convenience for UI/notification |
| `roles` | `["ROLE_CUSTOMER"]` | array, room for admins later |
| `iss` | `ecommerce-auth` | asserted by gateway validator |
| `aud` | `ecommerce-api` | asserted by gateway validator |
| `iat`/`exp` | epoch seconds | TTL ≈ 3600 s; skew ±60 s |

Secret hygiene (from PITFALLS #8, restated as architecture): CSPRNG-generated ≥32-byte secret; **exactly two holders** (auth, gateway) injected via Compose env; startup assertion fails fast on short secrets; forged-token (`alg:none`, tampered signature) contract tests live in the gateway phase.

---

## Frontend Integration

### Pattern: same-origin proxy (eliminates CORS entirely)

All browser API traffic goes to the Next.js origin; one catch-all route handler forwards to the gateway over the Compose network:

```typescript
// frontend/app/api/[...path]/route.ts  (verified pattern: catch-all dynamic segment)
import { cookies } from 'next/headers';

const GATEWAY = process.env.GATEWAY_URL; // http://gateway:8080 (inside Compose)

async function proxy(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get('SESSION')?.value;
  const headers = new Headers(req.headers);
  headers.delete('cookie');                       // strip browser cookies
  if (token) headers.set('authorization', `Bearer ${token}`);
  const upstream = await fetch(`${GATEWAY}/${path.join('/')}`, {
    method: req.method, headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
  });
  return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
```

Why this beats direct browser→gateway calls (per PITFALLS #9 analysis): no CORS configuration anywhere (browser sees one origin), cookies are first-party (`SameSite=Lax` works over plain-http localhost), XSS cannot reach the token (httpOnly), and SSR fetch chains work because *we* forward the header explicitly instead of hoping `Set-Cookie` propagates.

### Supporting rules

- **Server components** fetch data server-side (products listing, order history) using the same lib/client with the token attached; **client components** call relative `/api/*` URLs for mutations (add-to-cart, checkout).
- **Route protection**: Next 16's proxy convention (`proxy.ts`, the renamed middleware) redirects unauthenticated deep-links (`/orders`, `/checkout`) to `/login?next=…` based on cookie presence — coarse gate only; the gateway remains the real enforcement point.
- **Checkout UX**: `POST /api/orders` returns `201 {orderId, status: PENDING}` immediately; UI then polls `GET /api/orders/{id}` until `PAID`/`PAYMENT_FAILED`. Never block checkout on the async saga.
- **401 handling**: on gateway 401, clear the dead cookie, redirect to login preserving the return path; preserve cart view state (cart lives server-side in Redis anyway).
- Cookie attributes locked: `httpOnly; SameSite=Lax; Path=/; Secure` (Secure only when HTTPS), `Max-Age` ≤ token TTL.

---

## Build Order Analysis (validation of the proposed sequencing)

Proposed: **contracts → auth → catalog → cart → order+payment → notification → gateway → frontend → orchestration → docs**

### Dependency DAG

```
contracts ──────────────────────────────────────────────► (everything)
auth ──────────────► gateway ────────► frontend ────────► orchestration ──► docs
catalog ──► cart ──► order+payment ──► notification ──┘        ▲
   └───────────┘        (kafka enters Compose)                 │
                                    (all services join Compose incrementally)
```

Hard edges: catalog→cart (price validation), cart→order (checkout source), auth→gateway (claims/secret contract), order+payment→notification (both topics), gateway→frontend (single ingress assumption), everything→orchestration (E2E smoke).

### Verdict per phase

| Phase | Verdict | Notes |
|---|---|---|
| 1 contracts | ✅ **VALIDATE — widen slightly** | Add: repo scaffolding (`.gitattributes`/`.editorconfig` — Windows CRLF guard must precede first Java commit), JSON interop style guide (IDs-as-strings, int cents, ISO-ms dates), Kafka dedup keys in topic contracts, drift-check script skeleton (`scripts/check-contracts.sh`). |
| 2 auth | ✅ **VALIDATE — first** | No runtime deps; highest-risk runtime family (JVM-in-Docker: OOM flags, mvnw-in-build-stage, PG-18 volume layout) gets proven first and its Dockerfile/compose template is copied by order + gateway. Emits the JWT claims contract consumed by phases 7–8. |
| 3 catalog | ✅ **VALIDATE** | Required by cart; seeds the data every later smoke test needs. Independent of auth — safe to parallelize with phase 2 if roadmap wants waves. |
| 4 cart | ✅ **VALIDATE** | First internal service-to-service REST call (batch-validate against catalog) + first TTL datastore. Depends on 2 only via the claims contract (userId comes from gateway header later; standalone testing uses a dev header). |
| 5 order+payment | ✅ **VALIDATE as an inseparable pair** | Splitting them is impossible to verify: the message round-trip and the kill/restart redelivery test need both endpoints alive. Kafka + dual-listener config enters Compose here; pre-create topics (3 partitions, auto-create off). |
| 6 notification | ✅ **VALIDATE** | Third consumer group; re-validates idempotency under kafkajs's different timeout model. Depends only on phase 5 — **parallelizable with phase 7**. |
| 7 gateway | ✅ **VALIDATE position** | Must precede frontend (hard dependency). Late placement is deliberate and correct: phases 2–6 prove each service standalone via temporary published ports; this phase *revokes* those publications, making the gateway the sole ingress — the isolation verify step is literally "service ports stop responding from the host." Includes JWT forgery tests + CORS decision (likely "none needed" under full proxy). |
| 8 frontend | ✅ **VALIDATE** | Consumes every REST surface at once; last functional piece. |
| 9 orchestration | ⚠️ **VALIDATE with reframing** | Not "wire everything up" (PROJECT.md's incremental-compose rule already integrates each service on arrival). Its true scope: cold-start reproducibility (`down -v && up` → healthy → scripted E2E passes with zero manual steps), aggregate memory-budget audit, healthcheck matrix review, reset-script finalization. Roadmap should word the goal accordingly so planners don't defer integration work here. |
| 10 docs | ✅ **VALIDATE** | Runbook content accretes from earlier phases' verify notes; final phase freezes specs/diagram. |

**Challenges considered and rejected:** gateway-second (destroys the standalone-smoke-test pedagogy and forces every service milestone to share mutable gateway config); order-before-payment as separate phases (unverifiable half-sagas); notification-before-gateway swap (no dependency benefit — notification has no HTTP surface). **Net: the proposed order stands**, with the contracts-phase widening and the orchestration reframing above.

---

## Recommended Project Structure (monorepo conventions)

```
ecommerce-microservices/
├── services/
│   ├── api-gateway/            # Java · Maven · single module
│   │   ├── mvnw  mvnw.cmd  pom.xml  Dockerfile
│   │   └── src/main/java/com/ecommerce/gateway/
│   ├── auth-service/           # Java · Maven
│   ├── order-service/          # Java · Maven
│   ├── catalog-service/        # Python · FastAPI · uv/pip
│   ├── payment-service/        # Python · FastAPI
│   ├── cart-service/           # Node · Express (ESM)
│   └── notification-service/   # Node · kafkajs worker
├── frontend/                   # Next.js 16 (App Router, TS)
├── docker-compose.yml
├── docker-compose.override.yml # dev: polling reload mounts (Windows!)
├── scripts/                    # smoke-e2e.sh, check-contracts.sh, reset-all.sh, reset-keep-data.sh
├── docs/
│   ├── architecture.md
│   ├── api-contracts/          # auth.yaml catalog.yaml cart.yaml orders.yaml (+shared style-guide.md)
│   └── kafka-topics.md
├── .env.example  .gitattributes  .editorconfig  .gitignore
└── README.md
```

No cross-service parent POM and no shared code package: with three languages, the OpenAPI/Kafka contracts are the only shared artifact, and a shared Java parent would couple independently-shipped milestones (the exact drift the contracts phase exists to prevent).

### Java services (Maven convention — identical shape ×3)

```
services/order-service/
├── pom.xml                      # spring-boot-starter-parent; java 21; wrapper committed
├── Dockerfile                   # maven:3.9-temurin-21 build stage → temurin-21-jre runtime
└── src/
    ├── main/java/com/ecommerce/order/
    │   ├── OrderApplication.java
    │   ├── config/              # SecurityConfig, KafkaProducer/ConsumerConfig
    │   ├── api/                 # @RestController + request/response DTOs (contract-shaped)
    │   ├── domain/              # JPA entities + enums (OrderStatus) + repository/
    │   ├── service/             # business logic; saga handlers
    │   └── exception/           # @RestControllerAdvice error mapping
    ├── main/resources/
    │   ├── application.yml      # env-overridable; no secrets inline
    │   └── db/migration/        # Flyway V1__init.sql (immutable files!)
    └── test/java/…              # mirrors main; Testcontainers-friendly slices
```

Rationale: package-by-feature-of-layer is the Spring ecosystem default; keeping DTOs in `api/` makes the "does live code match the committed spec?" diff mechanical. Flyway over `schema.sql` for the two DB-backed services (orders will evolve).

### Python services (FastAPI convention — identical shape ×2)

```
services/payment-service/
├── pyproject.toml  uv.lock  Dockerfile  .env.example
├── scripts/seed.py              # catalog only: idempotent 20-product seeder
├── app/
│   ├── main.py                  # create_app() factory; uvicorn target
│   ├── core/config.py           # pydantic-settings BaseSettings
│   ├── routers/                 # one router per resource; prefix per contract
│   ├── models/                  # Pydantic v2 request/response schemas (= contract)
│   ├── db.py                    # catalog: AsyncMongoClient; payment: none
│   ├── kafka/                   # payment: consumer loop + producer (aiokafka)
│   └── health.py                # GET /health (compose healthcheck target)
└── tests/                       # pytest + pytest-asyncio; httpx TestClient
```

Flat `app/` package (not `src/` layout) — conventional for FastAPI services this size; `create_app()` factory keeps the ASGI app importable for tests. Models are hand-written *once* against the contract and checked by the drift script (generation round-trip optional).

### Node services (Express/worker convention — cart & notification)

```
services/cart-service/             # "type":"module" (ESM — greenfield on Node 24)
├── package.json  package-lock.json  Dockerfile  .env.example
├── healthcheck.cjs               # node:http probe for BusyBox-alpine images
└── src/
    ├── index.js                  # bootstrap: env, redis, listen
    ├── app.js                    # express() factory (supertest-importable)
    ├── routes/cart.routes.js     # route defs per contract
    ├── controllers/cart.controller.js
    ├── middleware/errors.js      # Express 5: rejected promises land here
    ├── clients/catalog.client.js # batch-validate + tiny TTL cache
    └── lib/redis.js              # ioredis; cart:{userId}; touch-TTL helper
services/notification-service/src/
    ├── index.js                  # kafkajs consumer, group 'notification-service'
    ├── handlers/orderCreated.js  paymentCompleted.js
    └── mailer.js                 # nodemailer → mailpit:1025
```

ESM over CJS for new 2026 Node code (top-level await, native modules support mature on Node 24). The `app.js`/factory split exists specifically so per-phase Verify can run HTTP tests without booting a listener.

---

## Patterns to Follow

### Pattern 1: Gateway as central policy-enforcement point (JWT decode bean)

**What:** All authentication decisions happen once, at the edge, in a declarative Spring Security filter chain — never scattered across services.
**When:** Any gateway-fronted microservice system without an OIDC provider (this project).
**Trade-offs:** Central chokepoint (mitigated: it's Netty/reactive and stateless); downstream claim-parsing must agree on claim names (mitigated: claims frozen in contracts).

```java
@Bean
SecurityFilterChain gatewayChain(ServerHttpSecurity http) {
  return http
    .csrf(ServerHttpSecurity.CsrfSpec::disable)
    .authorizeExchange(ex -> ex
        .pathMatchers("/auth/signup", "/auth/login", "/catalog/**").permitAll()
        .anyExchange().authenticated())
    .oauth2ResourceServer(rs -> rs.jwt(jwt -> jwt.decoder(hs256Decoder())))
    .build();
}

@Bean
JwtDecoder hs256Decoder() {
  var key = new SecretKeySpec(Base64.getDecoder().decode(jwtSecret), "HmacSHA256");
  NimbusJwtDecoder d = NimbusJwtDecoder.withSecretKey(key).build(); // pins MAC algos; RS256 default avoided
  d.setJwtValidator(new JwtTimestampValidator(Duration.ofSeconds(60))
      .andThen(new JwtIssuerValidator("ecommerce-auth"))
      .andThen(new JwtClaimValidator<List<?>>("aud",
          aud -> aud != null && aud.contains("ecommerce-api"))));
  return d;
}
```

### Pattern 2: Idempotent consumer + state-machine guard (every Kafka consumer)

**What:** Treat every delivery as possibly-a-repeat. Payment keys dedup on `orderId`; order gates transitions on current status; notification dedupes on `eventId`.
**When:** Always, under at-least-once delivery (which Kafka gives you by default).
**Example (aiokafka, payment-service):**

```python
async def consume(msg: ConsumerRecord):
    evt = OrderCreated.model_validate_json(msg.value)      # pydantic v2, ignore-on-input
    if await seen_recently(evt.orderId):                   # dedup guard (in-mem dict OK for v1)
        return                                             # ack by committing below
    outcome = mock_authorize(evt.totalCents, evt.currency) # amount>0 validated first
    await produce(PaymentCompleted(eventId=new_uuid(), orderId=evt.orderId,
                                  outcome=outcome, processedAt=utcnow_ms()))
    await consumer.commit()                                # commit ONLY after produce
```

### Pattern 3: Snapshot-on-write across service boundaries

**What:** When data crosses an ownership boundary into something long-lived (cart items, order lines, event payloads), copy the values you'll need forever — never store a foreign key you'd have to resolve later via another service's live state.
**When:** Any cross-service reference destined for persistent storage or display-after-the-fact.
**Trade-offs:** Denormalization/staleness (acceptable: prices legitimately change; old orders *should* show old prices) vs. runtime coupling to catalog forever (unacceptable).
**Embodiments:** cart item `{productId, nameSnapshot, priceAtAdd}`; `order_items.name_snapshot/unit_price_cents`; `order.created.userEmail`.

---

## Anti-Patterns

### Anti-Pattern 1: Shared database connections across services
**What people do:** Order service connects to the `users` DB "just to look up an email"; one Postgres superuser credential reused everywhere.
**Why it's wrong:** Schema changes break remote services silently; load couples; makes the polyglot-persistence lesson vacuous; blocks the future K8s split.
**Instead:** Ownership table above is law; separate logical DBs + separate credentials as the enforcement barrier; cross-service reads via APIs/events.

### Anti-Pattern 2: Synchronous checkout chain (order → payment → await result)
**What people do:** `POST /orders` internally calls payment and blocks until authorized.
**Why it's wrong:** Converts the event bus into expensive RPC; checkout latency and availability become payment's; kills the saga/redelivery learning goals.
**Instead:** Persist `PENDING`, emit, return 202-style `201 {status: PENDING}`; UI polls; async UX pitfalls handled in frontend (PITFALLS UX table).

### Anti-Pattern 3: Trusting the client (or the previous service) for identity and prices
**What people do:** Accepting `userId` from a request body; trusting cart-supplied totals in `POST /orders`.
**Why it's wrong:** Trivial privilege spoofing; totals tampering.
**Instead:** Identity exclusively from verified JWT claims server-side; totals recomputed server-side from snapshotted cart items at order creation.

### Anti-Pattern 4: Distributed monolith (N×M sync mesh)
**What people do:** Adding more sync calls "while we're here" — notification fetching user profiles, payment calling order back.
**Why it's wrong:** One service down cascades everywhere; deploys must be coordinated; the bus exists precisely to prevent this.
**Instead:** New cross-service reactions become new topic subscriptions, not HTTP calls. Audit: the only allowed sync service-to-service edges are #4 and #5 in the edge table.

### Anti-Pattern 5: Auto-commit offsets / non-idempotent consumers
**What people do:** Default consumer configs, "it worked in the demo."
**Why it's wrong:** At-least-once becomes unexplainable duplicates/drops; the mandated kill-and-restart verification becomes meaningless.
**Instead:** Commit-after-process; dedup/state guards per Pattern 2.

### Anti-Pattern 6: Publishing every service port "for debugging"
**What people do:** Leaving `ports:` mappings on auth/catalog/etc. after the gateway ships.
**Why it's wrong:** The gateway JWT filter becomes decorative — anyone on the host bypasses it.
**Instead:** After gateway phase, published set is exactly: frontend, gateway, operator UIs, host Kafka listener. Debug via `docker exec` / Kafka UI.

---

## Integration Points

### Internal boundaries

| Boundary | Mechanism | Notes / gotchas |
|---|---|---|
| gateway ⇄ each service | SCG routes: `/auth/**→auth:8081`, `/catalog/**→catalog:8000`, `/cart/**→cart:3001`, `/orders/**→order:8082` | Strip-hop: gateway forwards Authorization header; set `trusted-proxies` if forwarded-header behavior matters later |
| cart ⇄ catalog | REST batch endpoint; 1 req/cart-op; short TTL existence cache | Batch once per request, not per item (perf trap); catalog outage ⇒ 503 add-to-cart, graceful copy |
| order ⇄ cart | REST read at checkout; snapshot then clear cart **after** order row commits | Clear-cart failure is benign (TTL eventually cleans; stale cart yields duplicate-order risk → idempotency key on POST /orders) |
| order ⇄ payment ⇄ order | Kafka saga per §Event Flow | Dedup keys in contract; commit-after-process; earliest reset |
| notification ⇄ both topics | One group, both subscriptions | No cross-topic order assumption |
| frontend ⇄ gateway | Catch-all route-handler proxy; cookie⇄Bearer translation | Server components must attach token explicitly (SSR fetch ≠ browser) |
| services ⇄ datastores | Owner-only creds: `auth_svc`→users, `order_svc`→orders, `catalog_svc`→mongo, `cart_svc`→redis | Grants enforce ownership (Richardson barrier principle) |
| all ⇄ Kafka | Dual-listener: containers `kafka:19092`, host tools `localhost:9092` | PITFALLS #1 verbatim block; single-broker RF=1 overrides |

### External services

None real by design (mock payment, mock SMTP). Mailpit's REST API is the programmatic assertion point for the E2E smoke test.

---

## Scaling Considerations (informational — v1 is single-instance local)

| Concern | Today (dev) | First bottleneck | Fix already enabled by design |
|---|---|---|---|
| Kafka throughput | 1 broker, 3-partition topics | single broker disk/IO | partitions exist; K8s arc adds brokers/RF≥2 |
| Consumer throughput | 1 instance/group | slow handler stalls group (timeout knobs!) | scale = start more instances per group (partitions allow 3) |
| JVM memory | explicit `mem_limit` + `MaxRAMPercentage=75` | Docker Desktop budget (sum limits ≤75%) | horizontal pods in follow-on arc |
| Gateway | 1 SCG instance | connection count | stateless — replicate freely |
| Datastores | single nodes, named volumes | IO on shared VM | managed/independent nodes later; ownership boundaries make this a config change, not a rewrite |
| Sync fan-out | cart→catalog batched | catalog RTT under burst | TTL cache already specced; CDN/read-model later |

---

## Implications for Roadmap (summary for planner)

1. **Eleven phases stand as ordered**; apply two edits: contracts phase additionally owns repo scaffolding + JSON style guide + drift script; orchestration phase is a *cold-start reproducibility audit*, not initial wiring.
2. **Parallelization opportunity:** catalog ∥ auth (independent); notification ∥ gateway (disjoint deps). Everything else is serial.
3. **Contracts are load-bearing** beyond API shapes: JWT claims, Kafka dedup keys/outcome field, JSON interop rules, and route/port map all freeze here — planners of later phases read them, not each other.
4. **Each service phase ships its compose entry + healthcheck** (incremental integration rule); the gateway phase *removes* temporary port publications; orchestration audits the whole.
5. **Verification artifacts per phase** follow from this doc's tables: edge-list curl checks (phases 2–6), message round-trip + kill/restart redelivery (5), both-topic coverage (6), forgery tokens + isolation check (7), journey E2E (8–9).

## Confidence Assessment

| Area | Confidence | Basis |
|---|---|---|
| Component boundaries / edge list | MEDIUM-HIGH | Direct consequence of fixed plan components; topology follows standard gateway+saga layouts corroborated across sources |
| Data ownership rationale | MEDIUM | Canonical microservices.io pattern page + multiple independent 2026 treatments concur |
| Saga/event-flow shape | MEDIUM | Microservices.io saga pattern + several independent order/payment Kafka implementations (2024–2026) show identical shape; specifics (outcome-field topic) are this project's contract decision |
| JWT flow specifics | MEDIUM | Official Spring Security resource-server docs (issuer-uri limitation, withSecretKey builder, algorithm pinning, audiences) + PITFALLS #8 cross-check |
| Frontend proxy pattern | MEDIUM | Official Next.js 16 route-handler/proxy docs + PITFALLS #9 cross-check |
| Build order | MEDIUM | Dependency analysis of fixed components; ordering originates from the source build plan and survives challenge |
| Monorepo conventions | MEDIUM | Mainstream per-language conventions (Maven standard layout, FastAPI app pattern, ESM Node); low-risk stylistic domain |

## Sources

- microservices.io — *Pattern: Database per service* / *Shared database* / *Saga* (Chris Richardson) — canonical data-ownership & cross-service transaction/query patterns — MEDIUM (multi-source corroborated)
- Spring Security reference — *OAuth 2.0 Resource Server JWT* (docs.spring.io, fetched 2026-08-24): issuer-uri discovery requirement, `NimbusJwtDecoder.withSecretKey`, RS256 default & `jws-algorithms` override, `audiences` property, validators — MEDIUM (official docs; cross-checked vs PITFALLS #8)
- Next.js official docs v16.3.2 — *Route Handlers* (`route.js` reference): catch-all `[...slug]` params-as-Promise, `cookies()`/`NextRequest.cookies`, Proxy file convention — MEDIUM (official docs; cross-checked vs PITFALLS #9)
- Choreography-saga implementations & analyses (cscode.io Spring saga guide, heyytechy.com June 2026, martinuke0.github.io May 2026, Abhinav3205/order-payment-saga, AlanKalbermatter/event-saga-kafka): order.created→payment.completed shape, PENDING→CONFIRMED/FAILED machines, idempotent consumers, one-group-per-service — MEDIUM (multiple independents)
- Conduktor — *Build Idempotent Kafka Consumers* (2024): dedup-store atomicity, natural-upsert for state replacement, commit-after-process — MEDIUM
- Sibling research: `.planning/research/PITFALLS.md` (esp. pitfalls 1–5, 8, 9 — listener layout, KRaft storage, idempotency, contract drift, JWT boundary, cookie/CORS), `.planning/research/STACK.md` (pinned versions referenced throughout)

---
*Architecture research for: Ecommerce Microservices Platform*
*Researched: 2026-08-24*
