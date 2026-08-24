# Version Manifest — Single Source of Truth

This file is the **single source of truth** for every pinned version in this repository.
`pom.xml`, `package.json`, `pyproject.toml`, and `docker-compose.yml` image tags COPY from
here — they never invent versions. Do not create per-service version files; per-service
VERSION files recreate the drift this manifest exists to kill. Fresh-context agents read
this file FIRST, before writing any build file.

Rows below are copied mechanically from the verified stack table (`AGENTS.md` → embedded
STACK.md). No independent version research happens at build time.

| Component | Exact pin | Kind | Consumed by | Note |
|-----------|-----------|------|-------------|------|
| Spring Boot | 3.5.16 | framework | api-gateway, auth-service, order-service | Parent `spring-boot-starter-parent:3.5.16`. OSS support ended 2026-06-30 — accepted posture per D-07 (local learning target); upgrade path (Boot 4.0.x + Spring Cloud 2025.1) noted for the Phase 10 runbook. |
| Spring Cloud BOM | 2025.0.3 ("Northfields") | BOM | api-gateway | Import `spring-cloud-dependencies:2025.0.3`; never mix release trains. Gateway starter artifact is `spring-cloud-starter-gateway-server-webflux` ONLY — the pre-2025.0 predecessor artifact name is deprecated; Phase 7 must not use it. Properties live under `spring.cloud.gateway.server.webflux.*`. |
| JDK | 21 (LTS) | runtime | all Java services | `<maven.compiler.release>21</maven.compiler.release>`; virtual threads available (`spring.threads.virtual.enabled=true`). |
| FastAPI | 0.141.1 installed as `fastapi[standard]` | framework | catalog-service, payment-service | Extras bundle uvicorn[standard], fastapi-cli, httpx. Do not pin uvicorn separately. |
| Pydantic | 2.13.4 (+ pydantic-settings) | schema/config | catalog-service, payment-service | v2 line; request/response models must match the OpenAPI contracts exactly. |
| Python | 3.13 on base image `python:3.13-slim` | runtime | catalog-service, payment-service | Longest real-world wheel mileage; 3.14 supported but not chosen. |
| Node.js | 24 LTS "Krypton" (24.19.x line) | runtime | cart-service, notification-service, frontend tooling | Active LTS through Apr 2028; satisfies Next.js ≥20.9 requirement. |
| Express | 5.2.1 | framework | cart-service | Express 5 default since Mar 2025; mind wildcard-route syntax changes vs Express 4 tutorials. |
| ioredis | 6.0.0 | library | cart-service | TTL carts: `set(key, val, 'EX', ttl)`. |
| kafkajs | 2.2.4 | library | notification-service | Pure JS (zero native deps). Maintenance status acknowledged per research (last release 2023); documented migration path exists if ever needed. |
| nodemailer | 9.0.5 | library | notification-service | SMTP sender to Mailpit (:1025). |
| aiokafka | 0.14.0 | library | payment-service | asyncio-native producer/consumer; tested against Kafka 4.x fetch APIs. |
| pymongo | >=4.9 using `AsyncMongoClient` | library | catalog-service | Native asyncio API from PyMongo 4.9+; supports MongoDB 8.0. Deprecated third-party async wrappers are FORBIDDEN — use the official PyMongo asyncio client only. This is the one open floor in the manifest (STACK.md records it as >=4.9; pin current 4.x ~4.15+ at implementation time). |
| apache/kafka | 4.2.1 image, KRaft combined broker+controller | infrastructure image | event bus (order.created, payment.completed) | KRaft mode only — NO ZooKeeper service exists in this platform. Single broker per project constraints. |
| postgres | 18 image (currently 18.6) | datastore image | users + orders databases | PG18 layout change: mount named volumes at `/var/lib/postgresql` — NOT `/var/lib/postgresql/data`. |
| mongo | 8.0 image (long-support line, currently 8.0.29) | datastore image | products collection | Even-numbered minor = long-support line; avoid rapid minors (8.1–8.3). |
| redis | 8-alpine line (`redis:8-alpine`) | datastore image | carts (+ TTL) | Redis tri-license resolved upstream; no Valkey fork needed locally. |
| Next.js | 16.3.2 with React 19 peer | framework | frontend | App Router, Turbopack default; JWT arrives via httpOnly cookie from the gateway. |
| Mailpit | `axllent/mailpit:latest` (floating tag by design) | dev infrastructure image | mock SMTP :1025 + web UI :8025 | REST API `/api/v1/messages` is the Phase 9 smoke-test assertion surface for email content. Approved replacement per D-07 (drop-in on same ports). |
| eclipse-temurin | 21-jre base images — alpine and noble variants | container base | Java service runtimes | Multi-stage Docker builds compile with a JDK stage, run on 21-jre. |

**Verified 2026-08-24 against registry dist-tags / npm view / PyPI pages (per STACK.md sources).**
Re-verify pins at each consuming phase regardless of this date.
