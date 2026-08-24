# Ecommerce Microservices Platform

A production-grade e-commerce platform built as seven independently containerizable microservices — Java/Spring Boot (api-gateway, auth-service, order-service), Python/FastAPI (catalog-service, payment-service), and Node.js/Express (cart-service) plus a Node/kafkajs notification worker — communicating through a Spring Cloud Gateway and a Kafka event bus over PostgreSQL, MongoDB, and Redis, with a Next.js frontend. The system delivers one complete end-to-end purchase journey: signup → browse products → add to cart → checkout → payment → order status update → email notification.

## Architecture

Full architecture documentation lives in [`docs/`](./docs/) (contracts and docs land during Phase 1): OpenAPI specs per REST service, Kafka topic schemas, JSON interop rules, a single pinned version manifest, and the service-interaction map that every implementation copies from.

## Contracts-first policy

This project follows a contracts-first workflow: **committed specifications are the source of truth.** Service code implements the contracts — never the other way around. Any behavior change starts in `docs/` contract files and only then propagates to implementations; if code and contract disagree, the contract wins and the code is fixed.

## Repository layout

```
services/
  api-gateway/            Spring Cloud Gateway — routing + JWT verification
  auth-service/           Signup/login, JWT issuing (Java/Spring Boot + PostgreSQL)
  catalog-service/        Product browse/search (Python/FastAPI + MongoDB)
  cart-service/           Shopping cart with TTL (Node.js/Express + Redis)
  order-service/          Orders + payment saga state machine (Java/Spring Boot + Kafka)
  payment-service/        Mock payment authorization (Python/FastAPI + Kafka)
  notification-service/   Email worker (Node.js/kafkajs → Mailpit)
docs/                     Contracts-first specs, version manifest, architecture
docker-compose.yml        Local orchestration — grows incrementally per phase
.env.example              Environment variable template (names are contractual)
```

## Quick start

Run `docker compose up` to bring up the full stack once services land. The compose file **grows incrementally starting Phase 2** — infrastructure first (Kafka KRaft, PostgreSQL, MongoDB, Redis, Mailpit), then each service as its phase ships, until one command runs the whole system plus a scripted end-to-end smoke test.

For local configuration: copy `.env.example` to `.env` and fill real values there. Never commit `.env`.

## Contributor notes

- **Line endings are governed.** `.gitattributes` normalizes every text file to LF in the repo and the working tree on all platforms, with deliberate CRLF exceptions for `*.bat`/`*.cmd`. Do NOT override it via `.git/info/attributes`, per-path attributes, or local `core.autocrlf` tricks — fresh clones on Windows must yield LF everywhere governed.
- **Environment variable names are contractual.** Later phases add variables to `.env.example`; they never rename or repurpose existing ones.
