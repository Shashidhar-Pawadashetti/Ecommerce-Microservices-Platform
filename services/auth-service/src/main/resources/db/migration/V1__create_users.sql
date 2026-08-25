-- V1__create_users.sql
-- OWNED BY FLYWAY: shipped V-named migrations are append-only and are NEVER
-- edited after landing. order-service copies this migration pattern in Phase 5.
--
-- Schema per locked decisions D-04/D-05/D-06:
--   id          : app-generated UUID (D-05), native Postgres uuid column
--   roles       : native text[] array (D-06); v1 always populates {customer}
--   email       : uniqueness enforced by the users_email_uniq index below --
--                 the index is the atomic duplicate guard; no select-then-insert
--                 anywhere, ever.

CREATE TABLE users (
    id            uuid PRIMARY KEY,
    email         varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    roles         text[] NOT NULL DEFAULT '{customer}',
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_uniq ON users (email);
