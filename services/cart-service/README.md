# Cart Service

Node.js/Express 5 shopping-cart service for the Ecommerce Microservices Platform.
Backed by Redis, it lets a logged-in user maintain a persistent, server-priced
cart. Every read recomputes line and grand totals from live Catalog prices via
the network-internal `POST /catalog/products/batch` edge, so the cart blob
never stores money (threat T-04-02). Identity is derived exclusively from the
verified JWT `sub` claim on every user-facing operation (threat T-04-01).

**Stack:** Node.js 24 LTS + Express 5.2.1 + ioredis 6.0.0 + jsonwebtoken 9.0.3,
containerized via `node:24-alpine`.

## Endpoints

| Method | Path                     | Auth        | Purpose                                              |
|--------|--------------------------|-------------|------------------------------------------------------|
| GET    | `/cart`                  | bearer (HS256) | Caller's cart with live-priced totals             |
| DELETE | `/cart`                  | bearer (HS256) | Empty the entire cart (resets TTL)                |
| POST   | `/cart/items`            | bearer (HS256) | Add a product line (additive quantity)            |
| PATCH  | `/cart/items/{productId}`| bearer (HS256) | Set a line's absolute quantity                    |
| DELETE | `/cart/items/{productId}`| bearer (HS256) | Remove a cart line (idempotent)                    |
| GET    | `/cart/{userId}`         | bearer (HS256, network-int) | Checkout snapshot read (internal)        |
| GET    | `/health`                | network-int | Liveness probe (`{"status":"ok"}`)                  |

The full contract is canonical in `docs/api-contracts/cart-service.openapi.yaml`.
Routes are owned by plan 04-02; the store/config layer is owned by 04-03.

## Persistence & TTL contract (CART-03 / CART-04)

- **Key:** the cart for a user lives at `cart:{userId}` as a JSON blob
  `{ "items": [{ "productId", "quantity" }], "updatedAt": <ISO-8601> }`.
- **TTL resets on every mutation:** `addItem`, `updateQty`, `removeItem`, and
  `clearCart` all route through the single `writeCart()` chokepoint, which
  always re-`SET`s the blob with `EX CART_TTL_SECONDS`. Reads (`readCart`) do
  **not** touch the TTL, so an unmutated cart still ages out — abandoned carts
  expire after the window instead of living forever.
- **Observable expiry:** `readTtl(userId)` returns the remaining TTL in seconds
  (`-1` = key present but no expiry, `-2` = key absent). This is what the
  CART-04 integration test asserts against.
- **Configurable window:** `CART_TTL_SECONDS` (default `1209600` = 14 days)
  is validated at startup — it must be an integer `>= 1` or the service
  refuses to boot.

## Environment

Variable names are contractual (shared with root `.env`). See `.env.example`.

| Variable           | Default                        | Description                                  |
|--------------------|--------------------------------|----------------------------------------------|
| `JWT_SECRET`       | (base64, ≥32 decoded B)        | HS256 signing secret (base64-encoded)         |
| `JWT_ISSUER`       | `ecommerce-auth`               | Expected JWT issuer claim                     |
| `JWT_AUDIENCE`     | `ecommerce-api`                | Expected JWT audience claim                   |
| `JWT_TTL_SECONDS`  | `3600`                         | Token TTL hint                                |
| `REDIS_URL`        | `redis://redis:6379/0`         | Redis connection URI                          |
| `CATALOG_URL`      | `http://catalog-service:8000`  | Network-internal catalog base URL             |
| `CART_TTL_SECONDS` | `1209600` (14 days)            | Abandoned-cart expiry window (integer ≥ 1)    |
| `PORT`             | `3001`                         | HTTP listen port                              |

## Run with Docker Compose (whole platform)

From the repo root:

```bash
docker compose up -d redis cart-service
curl -s localhost:3001/health        # {"status":"ok"}
```

## Notes

- **Interop contract:** timestamps are ISO-8601 with millisecond precision in
  UTC (e.g. `2026-08-24T12:30:00.000Z`); money is integer `priceCents` (floats
  never travel on the wire or in the cart blob); ids are strings; optional
  fields are omitted (never null); receivers tolerate unknown fields. Totals
  are computed **server-side only** from live catalog data — client-supplied
  price/identity fields are ignored (T-04-01 / T-04-02).
- **v1 JWT holder deviation:** cart-service is a transitional `JWT_SECRET`
  holder (with auth-service and the gateway). Like catalog-service's DOCS-02
  deviation, the cart self-verifies HS256 with the shared secret in Phase 4 as
  defense-in-depth; the deviation is recorded in `docs/runbook.md`. In Phase 7
  the api-gateway becomes the **sole** verifier and this self-verify path is
  cleanly removed. The secret is only ever validated by decoded byte length; it
  is never logged.

## Testing

The service ships a container-free logic suite plus one real-Redis integration
test that proves observable TTL expiry.

- **Container-free logic suite (default):**

  ```bash
  npm test
  ```

  Runs `node --test` over `tests/test_auth.js`, `test_add.js`,
  `test_update_remove.js`, `test_totals.js`, `test_persist.js`,
  `test_internal.js`, and `test_ttl.js`. The TTL file is **skipped** unless
  `RUN_REDIS_TTL=1` is set, so the default run needs no Redis.

  How it stays container-free:
  - `tests/_loader.mjs` (registered via `--import ./tests/loader-register.mjs`)
    aliases the `ioredis` specifier to `ioredis-mock` at module-resolution time,
    so the cart store hits an in-memory Redis. The alias is disabled when
    `RUN_REDIS_TTL=1`, so the TTL test talks to a real server instead.
  - `tests/conftest.js` intercepts the global `fetch` used by the catalog client,
    returning an in-memory fake catalog (`prod-1001`, `prod-1002`). Unknown ids
    are omitted, mirroring the contract's UNKNOWN_PRODUCT behavior, so no running
    catalog-service is required.

- **Observable TTL expiry (real Redis, CART-04):** ioredis-mock TTL eviction is
  unreliable (research Assumption A5), so the TTL test must run against a live
  Redis:

  ```bash
  RUN_REDIS_TTL=1 CART_TTL_SECONDS=2 REDIS_URL=redis://localhost:6379/1 npm test
  ```

  or just the TTL file:

  ```bash
  RUN_REDIS_TTL=1 CART_TTL_SECONDS=2 REDIS_URL=redis://localhost:6379/1 \
    node --import ./tests/loader-register.mjs --test tests/test_ttl.js
  ```

  It asserts: after an add the `cart:{userId}` key exists with a positive TTL
  near `CART_TTL_SECONDS`; a second mutation resets the TTL anchor; after the
  window elapses the key is gone (`readTtl == -2`) and `GET /cart` returns an
  empty items array (abandoned-cart expiry).
