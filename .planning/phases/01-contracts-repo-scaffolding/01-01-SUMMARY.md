---
phase: 01-contracts-repo-scaffolding
plan: 01
subsystem: infra
tags: [gitattributes, monorepo-scaffolding, env-template, docker-compose, repo-hygiene]

requires:
  - phase: none
    provides: greenfield repo — only planning-artifact commits precede this plan
provides:
  - ".gitattributes LF law (text=auto eol=lf catch-all, *.bat/*.cmd crlf, binary exceptions)"
  - ".editorconfig (UTF-8, LF, per-language indent)"
  - "Extended .gitignore (.env hygiene, polyglot build artifacts, research cache)"
  - "Seven-service monorepo skeleton under services/"
  - "Root README with contracts-first policy"
  - "docker-compose.yml placeholder header"
  - ".env.example with contractual variable names, placeholder-only values"
affects: [02-tooling-gates, 03-version-manifest-docs, 04-rest-contracts, 05-kafka-topics-contracts, all service phases 2-9]

tech-stack:
  added: []
  patterns:
    - "Contracts-first policy: committed specs are source of truth"
    - "Line-ending law: .gitattributes committed before any content file"

key-files:
  created:
    - .gitattributes
    - .editorconfig
    - README.md
    - docker-compose.yml
    - .env.example
    - services/api-gateway/.gitkeep
    - services/auth-service/.gitkeep
    - services/catalog-service/.gitkeep
    - services/cart-service/.gitkeep
    - services/order-service/.gitkeep
    - services/payment-service/.gitkeep
    - services/notification-service/.gitkeep
  modified:
    - .gitignore

key-decisions:
  - "D-07 APPROVED (all three): MailHog→Mailpit (axllent/mailpit); Motor→PyMongo AsyncMongoClient (pymongo >=4.9); Spring Boot pinned 3.5.16 + Spring Cloud 2025.0.3 despite OSS EOL"

requirements-completed: [CONTR-04]

duration: TBDmin
completed: 2026-08-24
status: complete
---

# Phase 1 Plan 01: Repo Hygiene Law & Monorepo Skeleton Summary

**D-07 sign-offs recorded (Mailpit / PyMongo AsyncMongoClient / Boot 3.5.16 pin), LF-only .gitattributes law committed ahead of all content, seven-service monorepo skeleton scaffolded with placeholder-values-only .env.example**

## Decisions

### D-07 — Pre-freeze stakeholder sign-off on research deviations (checkpoint:decision)

**Outcome: `approve-all` — all three deviations approved as researched (recorded 2026-08-24).**

1. **MailHog → Mailpit (`axllent/mailpit`) — APPROVED.**
   Drop-in replacement on the same ports (SMTP :1025, web UI :8025); actively maintained vs MailHog unmaintained since ~2020. Mailpit's REST API `/api/v1/messages` becomes the Phase 9 smoke-test assertion surface for email-content contracts. Later plans (01-03 versions manifest, 01-05 kafka-topics.md) reference Mailpit by name.
2. **Motor → PyMongo AsyncMongoClient (`pymongo >=4.9`) — APPROVED.**
   Motor was deprecated 2025-05-14 (EOL 2026-05-14); the native asyncio API `pymongo.AsyncMongoClient` is the official replacement and supports MongoDB 8.0. Referenced by name in the versions manifest and catalog-service plans.
3. **Spring Boot pinned at 3.5.16 + Spring Cloud 2025.0.3 (Northfields) despite OSS support ending 2026-06-30 — APPROVED.**
   Acceptable for a local learning target; upgrade path (Boot 4.0.x + Spring Cloud 2025.1 Oakwood) noted for the Phase 10 runbook. All three Java services (api-gateway, auth-service, order-service) inherit this pin.

**Effect:** Contracts freeze unblocked — Plans 03–05 copy these values mechanically into the frozen manifests and docs without replanning.

---

*(Tasks 2–3 records finalized below after execution.)*
