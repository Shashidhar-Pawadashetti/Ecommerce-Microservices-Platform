# Phase 04: Cart Service - Research

**Researched:** 2026-08-27
**Domain:** Node.js/Express 5 + Redis cart store with server-side totals via synchronous Catalog call (first service-to-service trust boundary)
**Confidence:** HIGH (specs, sibling-service code, JWT config, and version pins all read this session)

## Summary

Phase 04 delivers the Cart Service: a Node.js/Express 5 service backed by Redis that lets logged-in users maintain a persistent, server-priced cart. This is the platform's first **synchronous service-to-service trust boundary** — every cart read recomputes line and grand totals from live Catalog prices by calling `POST /catalog/products/batch` (network-internal, inside the compose network). The cart itself stores only `{ productId, quantity }` pairs; money is never client-supplied (threat T-04-02). Identity is derived exclusively from the verified JWT `sub` claim on every user-facing operation (threat T-04-01).

The authoritative contract is `docs/api-contracts/cart-service.openapi.yaml` (read this session), which is canonical and must not be reverse-engineered from code. The shared error envelope and bearer scheme live in `_shared.yaml`. The Catalog batch edge contract and JWT claim rules are taken from `catalog-service.openapi.yaml` and `docs/json-interop.md` respectively (both read this session). JWT verification must mirror `services/catalog-service/app/security.py` and the issuer `config.py`, which in turn match the auth-service `JwtConfig.java` signer exactly (base64 `JWT_SECRET`, HS256, `iss=ecommerce-auth`, `aud=ecommerce-api`, ±60s skew).

**Primary recommendation:** Build a thin Express 5 service: a JWT-verify middleware (jsonwebtoken, shared `JWT_SECRET`), a Redis cart store (`cart:{userId}` JSON blob + per-mutation TTL refresh via ioredis), and a Catalog client that validates product IDs and supplies live prices. Keep the cart payload price-free; compute all totals at read time. Use `node:test` + `supertest`; make TTL expiry observable with a real Redis integration test at a tiny TTL.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Identity / authz (token verify) | API / Backend (cart-service) | (gateway in Phase 7) | Every operation verifies its own HS256 bearer until the gateway owns verification in Phase 7 (transitional, mirrors catalog-service DOCS-02). |
| Cart persistence | Database / Storage (Redis) | — | `cart:{userId}` JSON blob with TTL is the system of record for cart lines. |
| Product price source of truth | API / Backend (catalog-service) | — | Catalog owns prices; cart only reads them via batch edge. Cart never stores price. |
| Total computation | API / Backend (cart-service) | — | Server-side math from catalog response; client cannot influence. |
| Transport / routing | API / Backend (cart-service) + gateway (Phase 7) | — | Express 5 exposes REST; gateway proxies `/cart` in Phase 7. |
| Health probe | API / Backend | — | `GET /health` returns `{status:"ok"}`, probed by compose. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | **24 LTS "Krypton"** (24.18.x) | Runtime | [VERIFIED: AGENTS.md research/STACK.md] Active LTS since 2025-10-28; all deps support it. `node --version` here = v24.18.0. |
| Express | **5.2.1** | HTTP framework | [VERIFIED: AGENTS.md] + [VERIFIED: npm registry, 5.2.1] Express 5 is `latest` since Mar 2025. |
| ioredis | **6.0.0** | Redis client (get/set/expire TTL) | [VERIFIED: AGENTS.md] + [VERIFIED: npm registry, 6.0.0]. Project-pinned; native `EX`/`expire` ergonomics. |
| jsonwebtoken | **9.0.3** | HS256 bearer verification | [VERIFIED: npm registry, 9.0.3] (legitimacy gate: OK). Matches PyJWT semantics; pin `algorithms:["HS256"]`. |
| redis (server) | **8-alpine** (`redis:8-alpine`) | Cart datastore | [VERIFIED: AGENTS.md] Redis relicensed open-source-friendly; official image. Network-internal, no host port. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| supertest | **7.2.2** | HTTP assertions in tests | [VERIFIED: npm registry, 7.2.2] (OK). Pair with `node:test`. |
| ioredis-mock | **8.13.1** | In-memory Redis for fast unit tests | [VERIFIED: npm registry, 8.13.1] (OK). Logic tests without a container. |
| testcontainers (node) | latest | Real Redis for TTL-expiry integration test | Only for the CART-04 observable-expiry test; keeps CI deterministic. |
| zod (optional) | **4.4.3** | Request body validation | [VERIFIED: npm registry, 4.4.3] Alternative to manual checks for `AddItem`/`UpdateQuantity` (schemas are 2 fields — manual is also fine, see Don't Hand-Roll). |
| dotenv | **17.4.2** | Load `.env` in local dev | [VERIFIED: npm registry, 17.4.2] Dev convenience; compose injects env directly in prod. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsonwebtoken | jose (6.2.10) | jose is WebCrypto-based and excellent, but the legitimacy gate flags it `SUS` (too-new). Prefer jsonwebtoken (OK) unless the team wants jose's API. |
| ioredis | node-redis (`redis` 6.2.1) | First-party client; equivalent for get/set/expire. Project already pinned ioredis 6.0.0 — keep it. |
| Manual validation | express-validator / zod | Schemas are trivial (2 fields each); a 5-line manual check avoids a dependency. Use zod if consistent validation across services is desired. |
| ioredis-mock for TTL | real Redis only | ioredis-mock TTL eviction is not reliable for real-time expiry; use real Redis for the one CART-04 test. |

**Installation:**
```bash
npm init -y
npm pkg set type="module"          # ESM (Node 24 default style; matches async/await ergonomics)
npm install express@5.2.1 ioredis@6.0.0 jsonwebtoken@9.0.3
npm install -D supertest@7.2.2 ioredis-mock@8.13.1
npm install -D testcontainers     # only if using containerized Redis for TTL test
```

**Version verification:** All versions above confirmed via `npm view <pkg> version` this session (express 5.2.1, ioredis 6.0.0, jsonwebtoken 9.0.3, supertest 7.2.2, ioredis-mock 8.13.1, zod 4.4.3, dotenv 17.4.2). Node is v24.18.0 locally.

## Package Legitimacy Audit

> Gate run via `gsd_run query package-legitimacy check --ecosystem npm`.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| express | npm | 2025-12-01 | 132M/wk | github.com/expressjs/express | OK | Approved |
| ioredis | npm | 2026-07-31 | 27.5M/wk | github.com/redis/ioredis | SUS (too-new) | Already project-pinned in AGENTS.md STACK (locked decision) — keep; no extra checkpoint needed beyond acknowledging the pin. |
| jsonwebtoken | npm | 2025-12-04 | 56M/wk | github.com/auth0/node-jsonwebtoken | OK | Approved (primary JWT lib) |
| jose | npm | 2026-08-21 | 125M/wk | github.com/panva/jose | SUS (too-new) | Alternative only; prefer jsonwebtoken (OK). |
| supertest | npm | 2026-01-06 | 17M/wk | github.com/ladjs/supertest | OK | Approved (test) |
| ioredis-mock | npm | 2025-10-29 | 2M/wk | github.com/stipsan/ioredis-mock | OK | Approved (test) |
| zod | npm | — | — | github.com/colinhacks/zod | OK (registry) | Optional; 4.x major — pin explicitly if used. |
| dotenv | npm | — | — | github.com/motdotla/dotenv | OK (registry) | Optional dev convenience. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** ioredis (project-pinned, keep), jose (avoid — use jsonwebtoken).

*No postinstall scripts detected on any package (low supply-chain risk).*

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────┐      Bearer <token>        ┌─────────────────────────┐
│  Browser /   │ ──── POST /cart/items ───▶ │   cart-service :3001    │
│  Shopper     │ ◀── 200 CartView ───────── │  (Express 5)            │
│  (via gateway│      (totals server-side)  │                         │
│   in Ph7)    │                            │ 1. verify JWT (sub)     │
└──────────────┘                            │ 2. call catalog batch   │
                                           │ 3. read/write Redis     │
              order-service (Phase 5)       │                         │
              Bearer <token>                │                         │
┌──────────────┐ GET /cart/{userId} ───────▶│ 4. compute totals       │
│ order-service│ ◀── 200 CartView ───────── │                         │
└──────────────┘ (internal, network-only)   └───────────┬─────────────┘
                                                       │  POST /catalog/products/batch
                                                       │  (HTTP, network-internal, NO bearer)
                                                       ▼
                                           ┌─────────────────────────┐
                                           │ catalog-service :8000   │
                                           │ returns {productId,     │
                                           │  name, priceCents}      │
                                           │ (omits unknown IDs)     │
                                           └───────────┬─────────────┘
                                                       │  Mongo read
                                                       ▼
                                           ┌─────────────────────────┐
                                           │   MongoDB (products)    │
                                           └─────────────────────────┘
                  cart-service ◀─── Redis GET/SET/EXPIRE ───▶ redis:8 (network-internal)
```

### Recommended Project Structure
```
services/cart-service/
├── Dockerfile                 # node:24-alpine multi-stage, non-root
├── package.json               # type:module, scripts: dev/start/test
├── .dockerignore
├── src/
│   ├── index.js               # app bootstrap, listen on PORT
│   ├── app.js                 # express app + middleware + routes (exported for supertest)
│   ├── config.js              # env binding (JWT_*, REDIS_URL, CATALOG_URL, CART_TTL_SECONDS)
│   ├── auth/
│   │   └── verifyToken.js     # HS256 verify middleware -> req.user = { sub, ... }
│   ├── store/
│   │   └── cartStore.js       # ioredis wrapper: getCart/setCart/addItem/updateQty/removeItem/clearCart (TTL refresh)
│   ├── catalog/
│   │   └── catalogClient.js   # POST batch -> Map<productId,{name,priceCents}>; network-internal
│   ├── routes/
│   │   ├── cart.js            # GET /cart, DELETE /cart, POST /cart/items, PATCH+DELETE /cart/items/:productId
│   │   ├── internal.js        # GET /cart/:userId (checkout snapshot)
│   │   └── health.js          # GET /health -> {status:"ok"}
│   ├── totals.js              # compute lineTotalCents/grandTotalCents from catalog map
│   └── errors.js              # error classes + envelope serializer {code,message}
└── tests/
    ├── conftest.js            # build app, provide redis client (mock or real)
    ├── test_auth.js           # 401 missing/invalid/expired token
    ├── test_add.js            # CART-01 add, UNKNOWN_PRODUCT, VALIDATION_FAILED
    ├── test_update_remove.js  # CART-02 update/remove, LINE_NOT_IN_CART
    ├── test_totals.js         # CART-02 server-side totals from live prices
    ├── test_persist.js        # CART-03 key cart:{userId}
    └── test_ttl.js            # CART-04 observable expiry (real redis, tiny TTL)
```

### Pattern 1: JWT-verify middleware (identity from `sub` only)
**What:** Extract `Authorization: Bearer <token>`, verify HS256 with the base64-decoded `JWT_SECRET`, validate `iss`/`aud`/`exp` (±60s skew), attach `req.user = decoded`.
**When to use:** Every user-facing route, plus the internal checkout read (order-service presents its own token).
**Why:** Mirrors `services/catalog-service/app/security.py:39-47` (PyJWT `algorithms=["HS256"]`, `audience`, `issuer`, `leeway=60`) which mirrors `services/auth-service/.../JwtConfig.java:49-74` (base64 secret → HS256, issuer `ecommerce-auth`, audience contains `ecommerce-api`, 60s skew). One byte-identical 401 envelope for all failures (anti-enumeration), per `security.py:22-25`.

```javascript
// Source: docs/json-interop.md JWT Claims (lines 103-116) + catalog security.py:39-47
import jwt from 'jsonwebtoken';

const SECRET = Buffer.from(process.env.JWT_SECRET, 'base64'); // base64-decoded raw bytes, matches signer
const ISS = process.env.JWT_ISSUER || 'ecommerce-auth';
const AUD = process.env.JWT_AUDIENCE || 'ecommerce-api';

export function verifyBearer(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required or credentials invalid.');
  try {
    const claims = jwt.verify(token, SECRET, {
      algorithms: ['HS256'],          // pin alg; reject RS/none swaps
      issuer: ISS,
      audience: AUD,
      clockTolerance: 60,              // ±60s skew per interop §JWT Claims
    });
    req.user = claims;                 // identity derived EXCLUSIVELY from token
    next();
  } catch {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required or credentials invalid.');
  }
}
```
`[VERIFIED: docs/json-interop.md:103-116]` `[VERIFIED: services/catalog-service/app/security.py:39-47]` `[VERIFIED: services/auth-service/src/main/java/com/ecommerce/auth/config/JwtConfig.java:49-74]`

### Pattern 2: Cart store with per-mutation TTL refresh
**What:** `cart:{userId}` holds a JSON array of `{ productId, quantity }`. On EVERY mutation, re-`SET` with `EX` (or `EXPIRE`) so the abandoned-cart window resets. Reads do NOT refresh TTL (so an un-mutated cart still expires).
**Why:** Contract: "the cart TTL is touched on EVERY mutation" `[VERIFIED: docs/api-contracts/cart-service.openapi.yaml:21-27]`; CART-03/04.

```javascript
// Source: docs/api-contracts/cart-service.openapi.yaml:21-27, 380
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);
const TTL = parseInt(process.env.CART_TTL_SECONDS || '86400', 10);

export async function readCart(userId) {
  const raw = await redis.get(`cart:${userId}`);
  return raw ? JSON.parse(raw) : [];   // [] => empty view, no expiry refresh
}
export async function writeCart(userId, lines) {
  await redis.set(`cart:${userId}`, JSON.stringify(lines), 'EX', TTL); // refresh window
}
// addItem / updateQty / removeItem / clearCart all call writeCart (=> TTL reset)
```

### Pattern 3: Catalog batch call + server-side totals
**What:** On any cart read or before accepting a mutation, POST the list of productIds to `catalog-service:8000/catalog/products/batch`. The response is an array of `{productId, name, priceCents}` — **unknown IDs are omitted** `[VERIFIED: docs/api-contracts/catalog-service.openapi.yaml:196-203]`. Build a `Map`, compute `lineTotalCents = quantity * priceCents`, `grandTotalCents = Σ lineTotalCents`. Never read price from the request body.
**Why:** T-04-02 mitigation — totals come solely from the live catalog response.

```javascript
// Source: docs/api-contracts/catalog-service.openapi.yaml:170-213 (BatchPricingRequest/Entry)
export async function priceCart(lines, catalogUrl) {
  if (lines.length === 0) return { items: [], grandTotalCents: 0 };
  const resp = await fetch(`${catalogUrl}/catalog/products/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productIds: lines.map(l => l.productId) }), // NO bearer — network-internal
  });
  if (!resp.ok) throw new CatalogUnavailable(); // -> 503 propagate (see Pitfalls)
  const entries = await resp.json();           // [{productId,name,priceCents}]
  const byId = new Map(entries.map(e => [e.productId, e]));
  const items = lines.map(l => {
    const p = byId.get(l.productId);
    if (!p) throw new UnknownProduct(l.productId); // absent => UNKNOWN_PRODUCT
    return {
      productId: l.productId, name: p.name, quantity: l.quantity,
      unitPriceCents: p.priceCents, lineTotalCents: p.priceCents * l.quantity,
    };
  });
  const grandTotalCents = items.reduce((s, i) => s + i.lineTotalCents, 0);
  return { items, grandTotalCents };
}
```

### Anti-Patterns to Avoid
- **Storing price in the cart:** defeats T-04-02 and drifts from live pricing. Cart holds only `{productId, quantity}`.
- **Deriving userId from a request path/body on user-facing ops:** violates T-04-01. Use `req.user.sub`.
- **Refreshing TTL on reads:** keeps abandoned carts alive forever; only mutations touch TTL.
- **Calling catalog batch with a bearer token:** it's network-internal & unauthenticated (`security: []`) `[VERIFIED: docs/api-contracts/catalog-service.openapi.yaml:174]`; sending a token is harmless but unnecessary.
- **Using `*` in a route path (Express 5):** invalid in path-to-regexp v8. Use middleware for 404 fallback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT HMAC verification | custom crypto/signature code | `jsonwebtoken` (pin `algorithms:["HS256"]`) | Alg-confusion, clock-skew, and claim-validation bugs are easy to get wrong; library matches the auth-service signer exactly. |
| Redis RESP client | raw socket/TCP protocol | `ioredis` | Connection pooling, reconnection, `EX`/`expire`, cluster support handled for you. |
| Money arithmetic with floats | `0.1+0.2` style math | **integer cents** (`priceCents * quantity`) | `[VERIFIED: docs/json-interop.md:34-46]` floats corrupt money in every runtime; integer cents are exact. No decimal library needed. |
| HTTP client to catalog | hand-rolled socket | global `fetch` (Node 24 has it) | Built-in, standards-compliant; no extra dep. |
| Error envelope | ad-hoc JSON shapes | shared `{code, message}` helper | Enforce `_shared.yaml` envelope uniformly; never leak internals. |

**Key insight:** The only "custom" logic here is cart business rules (merge/remove semantics, TTL refresh, total computation) — everything infrastructural (auth, redis, http, money) is library-backed.

## Runtime State Inventory

> Not applicable — Phase 04 is greenfield (new service + new Redis datastore). No rename/refactor/migration of existing runtime state. Redis is introduced fresh; no stored data, live-service config, OS-registered state, secrets, or build artifacts from prior phases are affected.

## Common Pitfalls

### Pitfall 1: Redis JSON serialization round-trip
**What goes wrong:** Storing JS objects directly, or `JSON.parse` on a missing key throwing.
**Why:** Redis stores strings; a missing key returns `null`.
**How to avoid:** Always `redis.get` → `raw ? JSON.parse(raw) : []`; `redis.set(key, JSON.stringify(lines), 'EX', ttl)`. Never store `undefined`.
**Warning signs:** `SyntaxError: Unexpected token u` on read.

### Pitfall 2: Forgetting TTL refresh on every mutation (CART-04 breaks)
**What goes wrong:** Cart added once, then only `SET` without `EX` on later updates → TTL from first write lingers, or no expiry at all.
**Why:** Contract requires the window to reset on each mutation `[VERIFIED: cart-service.openapi.yaml:21-27]`.
**How to avoid:** Centralize writes through `writeCart()` which always passes `EX TTL`. Add a test asserting `TTL` increases after an update.
**Warning signs:** Carts never expire, or expire too soon after later edits.

### Pitfall 3: Express 5 async errors & wildcard syntax
**What goes wrong:** (a) `*` in a route path throws at boot; (b) assuming a rejected promise in an async handler is swallowed.
**Why:** Express 5 uses path-to-regexp v8 (no bare `*`) and **auto-forwards rejected promises to error middleware** `[VERIFIED: AGENTS.md research/STACK.md "rejected promises auto-forward to error middleware"]`.
**How to avoid:** Use middleware (`app.use`) for 404 catch-all; named wildcards `/*splat` only when truly needed. You may still `try/catch` for explicit envelopes.
**Warning signs:** `TypeError: Invalid path` at startup; unhandled rejection crashing the process (if you forget the error middleware).

### Pitfall 4: Catalog call failure leaks / wrong status
**What goes wrong:** Catalog down → cart returns 500 with a raw stack trace, or hangs.
**Why:** Network-internal dependency must fail gracefully.
**How to avoid:** Wrap `fetch` in try/catch; on non-OK or throw, return `503` with the shared envelope (`code: SERVICE_UNAVAILABLE` or generic) — **never** the catalog's internals. Set a `fetch` timeout (AbortController, ~2s).
**Warning signs:** Cart endpoints 500 with Mongo/connection strings in body.

### Pitfall 5: 404 discrimination (LINE_NOT_IN_CART vs UNKNOWN_PRODUCT)
**What goes wrong:** Returning `UNKNOWN_PRODUCT` when the product exists but isn't in the cart, or vice-versa.
**Why:** Contract discriminates on `Error.code` `[VERIFIED: cart-service.openapi.yaml:207-221]`.
**How to avoid:** Order checks: (1) call catalog batch; if productId absent from response → `UNKNOWN_PRODUCT`. (2) else if line not present in cart → `LINE_NOT_IN_CART` (PATCH) or `204` (DELETE, idempotent).
**Warning signs:** Tests for "update item not in cart" expecting `LINE_NOT_IN_CART` get `UNKNOWN_PRODUCT`.

### Pitfall 6: Clock skew on JWT verification
**What goes wrong:** Valid tokens rejected intermittently across containers.
**Why:** Container clocks drift; contract allows ±60s `[VERIFIED: docs/json-interop.md:111]`.
**How to avoid:** Pass `clockTolerance: 60` (jsonwebtoken) — matches catalog/python `leeway=60` and auth `JwtTimestampValidator(Duration.ofSeconds(60))`.
**Warning signs:** 401 storms right at token issue/expiry boundaries.

### Pitfall 7: Client-supplied price/identity injection (T-04-01 / T-04-02)
**What goes wrong:** A client sends `{productId, quantity, unitPriceCents:1}` and the server accidentally uses it; or sends `{userId:"victim"}`.
**Why:** additionalProperties is `true` (ignored) but a careless destructuring could read them.
**How to avoid:** Destructure ONLY `productId`/`quantity` from the body; derive userId solely from `req.user.sub`. Never read `unitPriceCents` from input. The `AddItem`/`UpdateQuantity` schemas carry no price/identity fields `[VERIFIED: cart-service.openapi.yaml:312-334]`.

### Pitfall 8: Secret not base64-decoded (verify mismatch)
**What goes wrong:** Verifying with the raw base64 string instead of decoded bytes → signature never matches.
**Why:** auth-service signs with `Base64.getDecoder().decode(base64Secret)` `[VERIFIED: JwtConfig.java:50,61]`; catalog decodes too `[VERIFIED: config.py:34-37]`.
**How to avoid:** `Buffer.from(process.env.JWT_SECRET, 'base64')` (not the string itself).

## Code Examples

Verified patterns from official sources / project artifacts:

### JWT verification (see Pattern 1)
`[VERIFIED: docs/json-interop.md:103-116]` `[VERIFIED: services/catalog-service/app/security.py:39-47]`

### Cart store + TTL (see Pattern 2)
`[VERIFIED: docs/api-contracts/cart-service.openapi.yaml:21-27,380]`

### Catalog batch pricing (see Pattern 3)
`[VERIFIED: docs/api-contracts/catalog-service.openapi.yaml:170-213]`

### Express 5 error-handler tail (envelope)
```javascript
// Source: docs/api-contracts/_shared.yaml:69-88 (Error envelope required [code,message])
export function errorHandler(err, req, res, next) {
  if (err instanceof UnknownProduct) return sendError(res, 404, 'UNKNOWN_PRODUCT', 'Product not found.');
  if (err instanceof LineNotInCart) return sendError(res, 404, 'LINE_NOT_IN_CART', 'Cart line not found.');
  if (err instanceof CatalogUnavailable) return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Catalog unavailable.');
  if (err instanceof ValidationError) return sendError(res, 400, 'VALIDATION_FAILED', err.message);
  console.error(err); // log only; never echo to client
  return sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}
function sendError(res, status, code, message) {
  return res.status(status).json({ code, message }); // envelope: {code, message} ONLY
}
```
`[VERIFIED: docs/api-contracts/_shared.yaml:69-88, 93-119]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redis session store for carts | Explicit `cart:{userId}` keys (no sessions) | project decision | [VERIFIED: AGENTS.md STACK "connect-redis / express-session NOT needed"] |
| Express 4 wildcard `*` routes | Named wildcards `/*splat` / middleware fallback | Express 5 (Mar 2025) | [VERIFIED: AGENTS.md] |
| Manual promise `.catch(next)` | Auto-forward of rejected async handlers | Express 5 | Less boilerplate, but still need an error handler. |
| Storing price in cart | Price fetched live at read time | T-04-02 contract | Totals always reflect current catalog. |

**Deprecated/outdated:**
- Motor (Python) — not used here, but noted in STACK: deprecated; irrelevant to Node cart.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cart `add` is **additive** when the product already exists (increment quantity by requested) rather than replace. | Architecture Patterns / Open Questions | If contract intends replace-on-add, totals/tests differ. Needs confirmation (see Open Questions). |
| A2 | `GET /cart` for an empty/absent cart returns `updatedAt` = current ISO timestamp (schema requires it). | Architecture Patterns | Minor; only the value of one field. |
| A3 | jsonwebtoken `clockTolerance` (seconds) maps exactly to the 60s interop leeway. | Pitfall 6 | If units differ, borderline tokens rejected/accepted wrongly. Low risk (documented as seconds). |
| A4 | cart-service must hold `JWT_SECRET` to self-verify in Phase 4 (transitional), mirroring catalog-service DOCS-02 deviation from the "exactly two holders" rule. | Security Domain / Open Questions | If the team instead wants the gateway to verify now, cart can't self-verify pre-Phase-7. |
| A5 | ioredis-mock TTL eviction is unreliable, so the CART-04 test uses a real Redis. | Common Pitfalls / Testing | If ioredis-mock proves reliable, the test can stay mock-only (simpler). |

## Open Questions (RESOLVED by plan 04)

1. **Add semantics for existing line (A1).** **RESOLVED** — Planner adopted **additive** (increment) on `POST /cart/items` (04-01 step 5); `PATCH` remains the sole absolute quantity-setter (preserves D-04).

2. **JWT holder list (A4).** **RESOLVED** — cart-service self-verifies HS256 with the shared `JWT_SECRET` in Phase 4 as a transitional DOCS-02-style deviation (04-01 step 4, 04-03 README note); Phase 7 gateway becomes the sole verifier.

3. **Empty-cart `updatedAt` (A2).** **RESOLVED** — route substitutes current ISO-8601 timestamp when the blob lacks `updatedAt` (04-01 step 7).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24 | Runtime | ✓ | v24.18.0 | — |
| npm | Build | ✓ | 11.16.0 | — |
| Redis (server) | Cart store | ✗ (added in Phase 4) | — | `redis:8-alpine` container via compose (no host port). |
| Docker / Compose | Orchestration | ✓ (project uses it) | — | — |
| catalog-service | Batch pricing source | ✓ (Phase 3 built) | — | Network-internal `catalog-service:8000`. |
| MongoDB | (via catalog) | ✓ | — | — |

**Missing dependencies with no fallback:** none (Redis is introduced by this phase's compose addition).
**Missing dependencies with fallback:** none blocking.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` → this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 24) + supertest 7.2.2 |
| Config file | none (package.json `"test": "node --test"`) |
| Quick run command | `npm test` (or `node --test tests/`) |
| Full suite command | `npm test` (same; split later if slow) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CART-01 | Add item; unknown product → UNKNOWN_PRODUCT(404); invalid qty(<1)/missing → VALIDATION_FAILED(400) | unit | `node --test tests/test_add.js` | ❌ Wave 0 |
| CART-02 | Update qty (PATCH); remove (DELETE idempotent 204); server-side totals from live prices | unit | `node --test tests/test_update_remove.js tests/test_totals.js` | ❌ Wave 0 |
| CART-03 | Cart persists across sessions; key `cart:{userId}` | unit/integration | `node --test tests/test_persist.js` | ❌ Wave 0 |
| CART-04 | Abandoned cart expires via TTL; expiry observable | integration (real Redis) | `node --test tests/test_ttl.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/test_add.js` (fastest relevant file)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (incl. TTL test against real Redis) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `services/cart-service/package.json` — `type:module`, `test` script, deps.
- [ ] `services/cart-service/tests/conftest.js` — app factory + redis client injection (mock default, real for TTL).
- [ ] `tests/test_auth.js` — 401 without/with-bad token.
- [ ] `tests/test_add.js`, `test_update_remove.js`, `test_totals.js`, `test_persist.js`, `test_ttl.js`.
- [ ] Make TTL **observable**: in `test_ttl.js`, set `CART_TTL_SECONDS` to 1–2s (or pass a tiny TTL to the store), mutate, `await sleep(ttl*1000+margin)`, then assert `GET /cart` returns empty items / key gone, and assert `redis TTL cart:{userId}` decreases appropriately after a mutation. Use a real `redis:8-alpine` (testcontainers or a compose-side redis) because ioredis-mock eviction is unreliable (A5).

## Security Domain

> `security_enforcement` is `true` (ASVS L1) in config → required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | HS256 bearer verify (jsonwebtoken) with `sub` as identity; one byte-identical 401 envelope for all failures (anti-enumeration). |
| V3 Session Management | no | Stateless JWT; no server sessions (per STACK: sessions not used for carts). |
| V4 Access Control | yes | Identity from `req.user.sub` only; T-04-01 — no client-supplied userId on user-facing ops. Internal `/cart/{userId}` is network-only + still token-gated. |
| V5 Input Validation | yes | Manual (or zod) checks: `productId` non-empty string, `quantity` integer ≥ 1; reject extra/unknown fields per Rule 5; return `VALIDATION_FAILED` envelope. |
| V6 Cryptography | yes | HS256 with base64-decoded shared secret; alg pinned (`algorithms:["HS256"]`); never hand-roll. Secret from `JWT_SECRET` env, never logged. |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Algorithm confusion (RS/none swap) | Spoofing/Tampering | Pin `algorithms:["HS256"]`; secret is symmetric-only (matches auth `withSecretKey` MAC restriction `[VERIFIED: JwtConfig.java:62-64]`). |
| Token claim tampering (fake sub) | Spoofing | Verify signature + `iss`/`aud`/`exp`; never trust client identity fields. |
| Price injection (client sets unitPriceCents) | Tampering | T-04-02: totals computed only from catalog response; request body price fields never read `[VERIFIED: cart-service.openapi.yaml:33-37]`. |
| UserId injection (act as another user) | Elevation | T-04-01: userId from `req.user.sub` exclusively on user-facing ops `[VERIFIED: cart-service.openapi.yaml:28-31]`. |
| Info leakage in errors | Info Disclosure | Uniform `{code, message}` envelope; message is human-safe, no hostnames/stack/driver errors `[VERIFIED: _shared.yaml:83-87]`. |
| Internal endpoint exposed externally | Security Misconfig | `GET /cart/{userId}` excluded from gateway route table in Phase 7 (network-internal only) `[VERIFIED: cart-service.openapi.yaml:243-258]`. |

**Secret-holder note (A4):** `docs/json-interop.md:129` restricts JWT_SECRET holders to auth-service + gateway, but cart-service must self-verify in Phase 4 (transitional), exactly as catalog-service already does (DOCS-02). Add `JWT_SECRET` to cart-service env and record the deviation; Phase 7 gateway becomes the sole verifier.

## Sources

### Primary (HIGH confidence)
- `docs/api-contracts/cart-service.openapi.yaml` — read this session; canonical endpoints, schemas, threat mitigations T-04-01/04-02, decisions D-02/D-04.
- `docs/api-contracts/_shared.yaml` — read; Error envelope `{code,message}`, bearerAuth, response shapes.
- `docs/api-contracts/catalog-service.openapi.yaml` — read; `POST /catalog/products/batch` contract (request/response, unknown-ID omission, network-internal/unauthenticated).
- `docs/json-interop.md` — read; JWT Claims table (sub/iss/aud/±60s), Secret Handling, money/ID/date rules.
- `services/catalog-service/app/security.py` + `config.py` — read; exact verify params (HS256, iss, aud, leeway=60, base64 secret).
- `services/auth-service/src/main/java/com/ecommerce/auth/config/JwtConfig.java` — read; signer secret decoding + validator chain (iss/aud/60s skew, MAC-only).
- `AGENTS.md` (research/STACK.md) — read; pinned versions Node 24 / Express 5.2.1 / ioredis 6.0.0 / redis:8-alpine; Express 5 breaking changes.
- `docker-compose.yml` — read; service-entry pattern, env block, depends_on, healthcheck shape; Phase 4 adds Redis.

### Secondary (MEDIUM confidence)
- npm registry `npm view` (this session): express 5.2.1, ioredis 6.0.0, jsonwebtoken 9.0.3, supertest 7.2.2, ioredis-mock 8.13.1, zod 4.4.3, dotenv 17.4.2.
- Package legitimacy gate (`gsd_run query package-legitimacy check`): express/ioredis/jsonwebtoken/supertest/ioredis-mock OK or SUS-as-noted.

### Tertiary (LOW confidence)
- Express 5 path-to-regexp v8 wildcard mechanics beyond AGENTS.md note (marked `[ASSUMED]` where used).
- ioredis-mock TTL reliability (A5) — pending empirical check during execution.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry this session and match AGENTS.md pins; JWT verify mirrors read source files.
- Architecture: HIGH — derived from the canonical OpenAPI contract and sibling-service code read this session.
- Pitfalls: HIGH — each tied to a verbatim contract/source citation; Express 5 specifics grounded in AGENTS.md.

**Research date:** 2026-08-27
**Valid until:** 2026-09-26 (30 days; stable stack, but re-check Express 5 / ioredis patch notes if a new minor appears before execution).
