-- V1__create_orders.sql
-- OWNED BY FLYWAY: shipped V-named migrations are append-only and are NEVER
-- edited after landing. order-service copies the auth-service migration pattern.
--
-- Schema per locked decisions D-01/D-05 and the orders OpenAPI contract:
--   order_id       : app-generated id (e.g. ord-<uuid>), unique
--   user_id        : the verified JWT sub of the checkout caller
--   status         : PENDING_PAYMENT | PAID | PAYMENT_FAILED (D-01)
--   total_cents    : integer minor units (interop Rule 2)
--   currency       : ISO 4217
--   items_json     : immutable purchase-time snapshot of cart contents, stored as
--                    JSON text (the OpenAPI OrderItem[] payload) so GET /orders/{id}
--                    can return the frozen snapshot without a join table.
--   created_at     : timestamptz default now()
--
-- idempotency_keys carries the (key -> order_id) mapping that makes POST /orders
-- idempotent under replay (ORDR-05). The unique PK on key is the race-safe
-- duplicate guard (mirrors users_email_uniq in auth-service).

CREATE TABLE orders (
    id            bigserial PRIMARY KEY,
    order_id      varchar(64) NOT NULL,
    user_id       varchar(64) NOT NULL,
    status        varchar(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
    total_cents   integer NOT NULL CHECK (total_cents >= 0),
    currency      varchar(3) NOT NULL DEFAULT 'USD',
    items_json    text NOT NULL DEFAULT '[]',
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX orders_order_id_uniq ON orders (order_id);

CREATE TABLE idempotency_keys (
    key          varchar(255) PRIMARY KEY,   -- Idempotency-Key header (16-255 enforced in app)
    order_id     varchar(64) NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
