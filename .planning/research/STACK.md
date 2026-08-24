# Stack Research

**Domain:** Polyglot e-commerce microservices platform (Java/Spring + Python/FastAPI + Node/Express, Kafka event bus, Next.js frontend, Docker Compose local orchestration)
**Researched:** 2026-08-24
**Confidence:** MEDIUM (all version pins verified Aug 2026 against npm registry JSON, PyPI release pages, spring.io/GitHub release pages, Docker Hub official image tags; per source-hierarchy seam these cross-verified web findings cap at MEDIUM)

> **Context for this pin set:** The project pins Spring Boot 3.x + Maven (api-gateway, auth-service, order-service), FastAPI + Pydantic v2 (catalog, payment), Express (cart) and kafkajs (notification), Kafka KRaft single-broker, Postgres/MongoDB/Redis, Next.js frontend, Mailhog→SMTP mock. Versions below are **latest stable as of 2026-08-24** within those pins, verified against primary sources.

---

## Recommended Stack

### Core Technologies — Java services (api-gateway, auth-service, order-service)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Spring Boot | **3.5.16** | App framework for all three Java services | Latest release of the pinned 3.x line (2026-06-25). ⚠️ See compatibility warning: 3.5.x OSS support ended 2026-06-30 — acceptable for a local learning target, but know the upgrade path (below). | MEDIUM |
| Spring Cloud | **2025.0.3** ("Northfields" BOM) | Dependency alignment for gateway | The release train that matches Boot 3.5.x exactly. Import `spring-cloud-dependencies:2025.0.3` BOM; never mix trains. | MEDIUM |
| Spring Cloud Gateway | **4.3.x** (via Northfields BOM) | API Gateway, routing, JWT filter | Correct starter artifact is now `spring-cloud-starter-gateway-server-webflux` (old `spring-cloud-starter-gateway` is deprecated and logs warnings since 2025.0). Properties moved to `spring.cloud.gateway.server.webflux.*`. | MEDIUM |
| JDK | **21 (LTS)** | Language/runtime level | Boot 3.5 supports JDK 17–25; 21 is the conservative sweet spot: LTS through ~2028+, virtual threads GA (`spring.threads.virtual.enabled=true` works from Boot 3.2 on 21+), widest third-party library/tooling support. JDK 25 LTS (GA Sep 2025) is fully supported by Spring Framework 6.2 and a valid alternative if you want the longest window. Do not use 17 (Premier support ends Sep 2026). | MEDIUM |
| Maven | **3.9.x** via Maven Wrapper (`./mvnw`) | Build tool | Project decision already locked Maven. Use the wrapper committed per service so every fresh-context milestone builds identically without a local Maven install. | MEDIUM |
| Spring Kafka | **3.3.x** (managed by Boot 3.5 → kafka-clients 3.8/3.9) | order-service producer/consumer | Boot 3.5's dependency management picks a compatible spring-kafka automatically. kafka-clients 3.9 speaks to a Kafka 4.2 broker fine (brokers are backward-compatible with older clients). Do **not** manually bump `kafka.version` to 4.x while on Boot 3.5/spring-kafka 3.3. | MEDIUM |
| Spring Security OAuth2 Resource Server | managed by Boot 3.5 | JWT issue (auth-service) & verify (gateway) | Uses nimbus-jose-jwt under the hood, version-managed by Boot — zero extra version pins, standard industry pattern, HS256 or RS256 both supported. Prefer this over hand-rolled jjwt wiring. | MEDIUM |

### Core Technologies — Python services (catalog-service, payment-service)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| FastAPI | **0.141.1** | Web framework (catalog CRUD/search, payment REST surface) | Current latest (2026-07-29). Install with extras: `fastapi[standard]` (bundles uvicorn[standard], fastapi-cli, httpx for tests). Supports Python 3.10–3.14. | MEDIUM |
| Pydantic | **2.13.4** (+ pydantic-settings) | Request/response models matching OpenAPI contracts; config | Latest v2 line (2026-05-06). Pydantic v2 was already a project pin; this is its current patch line. | MEDIUM |
| Python | **3.13** | Runtime for catalog/payment | Safest current stable: mature wheel coverage for pydantic-core etc.; 3.14 is supported by FastAPI/Pydantic but 3.13 has the longest real-world mileage. Base image `python:3.13-slim`. | MEDIUM |
| PyMongo (AsyncMongoClient) | **≥4.9**, pin current 4.x (~4.15+) | MongoDB access from catalog-service | ⚠️ **Do NOT use Motor** — deprecated by MongoDB since 2025-05-14, EOL'd 2026-05-14 (critical fixes only until 2027). The native asyncio API `pymongo.AsyncMongoClient` (PyMongo ≥4.9) is the official replacement, supports MongoDB 8.0, and needs no extra dependency. This supersedes the build plan's "Motor/PyMongo". | MEDIUM |
| aiokafka | **0.14.0** | Kafka consumer/producer in payment-service (asyncio-native) | Active (2026-04-29 release), fits FastAPI's event loop naturally, supports Kafka 4.x brokers. Matches the PROJECT.md pin. Alternative below if you prefer librdkafka. | MEDIUM |
| confluent-kafka-python | **2.15.0** | Alternative Kafka client (librdkafka binding) | Very active (2026-06-30), best when you want sync APIs or Schema Registry later. Heavier container dep (native librdkafka wheels exist for glibc manylinux). Choose aiokafka for this project's async style. | MEDIUM |

### Core Technologies — Node.js services (cart-service, notification-service)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | **24 LTS "Krypton"** (24.19.x) | Runtime for cart-service + notification-worker | Active LTS since 2025-10-28 (EOL Apr 2028); 22 is now Maintenance-only (EOL Apr 2027). New greenfield Node work should start on 24. All project deps (express, kafkajs, ioredis, nodemailer) support it. | MEDIUM |
| Express | **5.2.1** | cart-service HTTP API | Current `latest` tag; Express 5 has been the default since Mar 2025. Start on 5 directly — note breaking changes vs tutorials written for Express 4 (route wildcard syntax changed to named wildcards like `/*splat`; rejected promises auto-forward to error middleware). | MEDIUM |
| kafkajs | **2.2.4** | notification-service Kafka consumer group | Last release ever (Feb 2023) and **unmaintained since Aug 2024** — flagged, see What NOT to Use / alternatives. Still the pragmatic pick here because it's pure JS (zero native deps → tiniest alpine image), protocol-compatible with KRaft-era brokers, and matches the plan's pin. Documented migration path exists if you change your mind. | MEDIUM |
| ioredis | **6.0.0** | Redis client for cart-service (get/set/TTL) | Freshly released v6 (Node ≥20), extremely stable well-known API, ideal ergonomics for TTL carts (`set(key, val, 'EX', ttl)`). Official node-redis 6.2.1 is a solid alternative if you prefer the first-party client. | MEDIUM |
| nodemailer | **9.0.5** | SMTP sender to Mailpit from notification-service | Current latest; MIT-0 license; trivial usage against an unauthenticated dev SMTP relay. | MEDIUM |

### Core Technologies — Event bus, datastores, frontend

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Apache Kafka | **4.2.1** (broker, KRaft, single combined broker+controller) | Event bus: `order.created`, `payment.completed` | Latest verified stable release (2026-05-30). Kafka 4.x is KRaft-only (ZooKeeper removed entirely) — exactly what the plan wants, no legacy mode needed. Official image `apache/kafka:4.2.1` supports full env-var KRaft config (`KAFKA_NODE_ID`, `KAFKA_PROCESS_ROLES`, `KAFKA_LISTENERS`…). Note: 4.3 docs are already published upstream — re-check downloads page when you scaffold Phase 5. | MEDIUM |
| PostgreSQL | **18** (`postgres:18`, currently 18.6) | users + orders databases | PG 18 GA Sep 2025, current point 18.6. ⚠️ Image layout changed in 18: `PGDATA` is version-specific (`/var/lib/postgresql/18/docker`) and the declared VOLUME is `/var/lib/postgresql` — mount **named volumes at `/var/lib/postgresql`**, not `/var/lib/postgresql/data`. | MEDIUM |
| MongoDB | **8.0** (`mongo:8.0`, currently 8.0.29) | products collection | Even-numbered minors are MongoDB's long-support lines; 8.1–8.3 are short-lived rapid releases (newest tag is 8.3.8 — avoid for stability). Fully supported by PyMongo ≥4.9. | MEDIUM |
| Redis | **8.x** (`redis:8-alpine`, currently 8.2.8-alpine line / 8.10 trixie line) | cart storage + TTL | Redis relicensed open-source-friendly (tri-license incl. AGPLv3, May 2025) so official images are unproblematic again. Valkey fork unnecessary for local dev. | MEDIUM |
| Next.js | **16.3.2** | Frontend (App Router, server components/API routes) | Current latest; requires Node ≥20.9 (satisfies our Node 24 pin); React 19 peer. Turbopack is default in 16. JWT lands in an httpOnly cookie via the gateway. | MEDIUM |
| Mailpit (`axllent/mailpit`) | latest | Mock SMTP (:1025) + web UI (:8025) | ⚠️ **Swap MailHog → Mailpit**: MailHog is unmaintained (last release 2020, maintainers confirmed inactive, no arm64). Mailpit is drop-in compatible on the same ports, actively maintained, multi-arch, and its REST API lets your Phase 9 smoke test *assert* email delivery programmatically. Deviation from the original build plan — flag it to stakeholders. | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| spring-boot-starter-data-jpa + postgresql driver | managed by Boot 3.5 | auth-service & order-service persistence | Always for the two Java DB services; Flyway (managed by Boot) recommended over raw schema.sql for orders evolution. |
| spring-boot-starter-actuator | managed by Boot 3.5 | `/actuator/health` liveness/readiness for Compose healthchecks | Every Java service; pair `healthcheck: test: ["CMD-SHELL", "wget -qO- http://localhost:8080/actuator/health"]` with generous `start_period`. |
| httpx | bundled via fastapi[standard] | catalog-service internal calls / FastAPI TestClient | Cart→Catalog price validation is Node-side; Python side uses httpx mainly in tests. |
| pytest + pytest-asyncio | latest | Python service tests | Both FastAPI services. |
| uvicorn[standard] | via fastapi[standard] | ASGI server | Don't pin separately; let fastapi[standard] manage it. |
| connect-redis / express-session | n/a | — | NOT needed: carts are explicit `cart:{userId}` keys, not sessions. Listed only to prevent scope creep. |
| Kafka UI (Redpanda Console or provectuslabs/kafka-ui or Kafdrop) | latest | Inspect topics/consumer lag in Phase 5+ verification | Plan mentions Kafdrop/Redpanda Console; any one is fine — verify chosen image supports Kafka 4.x at build time. Confidence LOW on specific UI-version compat. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker Compose (v2 CLI plugin) | Local orchestration of all 12+ containers | `docker compose up`; use `docker-compose.override.yml` for hot-reload mounts. |
| Maven Wrapper (`./mvnw`) per Java service | Reproducible builds | Commit wrapper jar/scripts; avoids host Maven installs across fresh-context milestones. |
| uv (or pip + lockfile) | Python dependency management | Build plan says poetry/pip; `uv` is the 2026 de-facto fast standard and exports pip-compatible requirements. Any is fine — pick ONE and use it for both Python services. |
| npm ci + lockfiles | Node reproducible builds | One package-lock.json per service; `npm ci --omit=dev` in production stage. |

---

## Installation

```bash
# ── api-gateway / auth-service / order-service (pom.xml snippets) ──
# parent: spring-boot-starter-parent 3.5.16 ; java.version=21 ; maven wrapper committed
<properties><java.version>21</java.version></properties>
# BOM import: org.springframework.cloud:spring-cloud-dependencies:2025.0.3
# api-gateway deps:
#   org.springframework.cloud:spring-cloud-starter-gateway-server-webflux   (NEW name!)
#   org.springframework.boot:spring-boot-starter-security
#   org.springframework.boot:spring-boot-starter-oauth2-resource-server     (JWT verify)
#   org.springframework.boot:spring-boot-starter-actuator
# auth-service deps: starter-web, starter-data-jpa, starter-security,
#   starter-oauth2-resource-server (JWT issue), postgresql (runtime), flyway-core, actuator
# order-service deps: starter-web, starter-data-jpa, spring-kafka, postgresql, actuator

# ── catalog-service / payment-service (pyproject.toml) ──
uv add "fastapi[standard]==0.141.1" "pydantic==2.13.4" "pydantic-settings"
# catalog-service additionally:
uv add "pymongo>=4.9,<5"          # AsyncMongoClient — NOT motor
# payment-service additionally:
uv add "aiokafka==0.14.0"

# ── cart-service / notification-service ──
npm install express@5.2.1 ioredis@6.0.0            # cart-service
npm install kafkajs@2.2.4 nodemailer@9.0.5          # notification-service

# ── frontend ──
npx create-next-app@16.3.2 frontend                 # React 19, App Router, TS

# ── docker-compose.yml service images (pin exact!) ──
# apache/kafka:4.2.1        (KRaft combined mode; NO zookeeper service)
# postgres:18               (volume at /var/lib/postgresql)
# mongo:8.0
# redis:8-alpine
# axllent/mailpit           (SMTP :1025, UI :8025)
```

**Dockerfile base images (verified tag families):**

```dockerfile
# Java multi-stage (each of api-gateway/auth/order):
FROM maven:3.9-eclipse-temurin-21 AS build
COPY . /app
RUN mvn -f /app/pom.xml clean package -DskipTests
FROM eclipse-temurin:21-jre-alpine          # or :21-jre-noble if you need glibc tooling
COPY --from=build /app/target/*.jar /app/app.jar
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-jar","/app/app.jar"]

# Python (catalog/payment):
FROM python:3.13-slim
# non-root user, install from exported requirements/lockfile, CMD uvicorn

# Node (cart/notification):
FROM node:24-alpine                          # pure-JS deps make alpine safe here
USER node
CMD ["node", "src/index.js"]
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Spring Boot 3.5.16 (project pin: 3.x) | Spring Boot 4.0.x (currently 4.0.8) + Spring Cloud 2025.1 "Oakwood" (gateway 5.0.x) | If you lift the 3.x pin and want the actively-OSS-supported line (3.5 OSS ended Jun 2026; Oakwood supported until Jul 2027). Requires migrating SCG artifacts/properties (already renamed) and re-checking tutorial drift. Most 2025-era tutorials still target 3.x. |
| JDK 21 | JDK 25 (LTS, GA Sep 2025) | If you prefer the newest LTS window (to ~2030) — Spring Framework 6.2 fully tests it; ensure compiler-plugin ≥3.14. Functionally equivalent for this project. |
| aiokafka 0.14.0 (payment) | confluent-kafka-python 2.15.0 | If you later add Schema Registry/Avro (out of scope v1) or prefer sync consumer loops. Native librdkafka = bigger images. |
| kafkajs 2.2.4 (notification) | @confluentinc/kafka-javascript 1.10.0 (maintained successor, KafkaJS-like promisified API; librdkafka-based → needs `node:24-slim`, not alpine) | If unmaintained-dependency risk outweighs simplicity, or you want vendor-supported clients from day one. Also viable: @platformatic/kafka. Avoid the Charon fork (@ousiaresearch/kafkajs) — beta-only releases, near-zero adoption. |
| ioredis 6.0.0 (cart) | node-redis (`redis` npm) 6.2.1 | If you want the first-party Redis Ltd client. Equivalent capability for get/set/expire; ioredis wins on API stability history and doc ubiquity. |
| mongo:8.0 (long-support line) | mongo:8.3.8 (rapid line, newest tag) | Only if you specifically need a rapid-release feature. Rapid minors have short support windows. |
| Mailpit | MailHog (as originally planned) | Never, for new work in 2026 — unmaintained since 2020, no arm64, no security fixes. Listed only because the build plan names it. |
| Spring Security OAuth2 Resource Server (JWT) | jjwt (io.jsonwebtoken) | Only if you want minimal dependencies without Security filters; costs you manual token parsing/validation code. Resource Server is the industry-standard route and version-managed by Boot. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Motor** (`motor` pip package) | Deprecated 2025-05-14 by MongoDB; passed EOL 2026-05-14 — bug-fixes only, no features, thread-pool-based (slower than native asyncio) | `pymongo>=4.9` → `from pymongo import AsyncMongoClient` |
| **MailHog** | Unmaintained since ~2020; last release 2020; no arm64/security updates | `axllent/mailpit` (same ports, REST API for smoke-test assertions) |
| **bitnami/kafka** (and other Bitnami images) | Broadcom's Aug 2025 Bitnami catalog restructuring moved most images to `bitnamilegacy` — unreliable supply going forward | `apache/kafka:4.2.1` official image |
| `spring-cloud-starter-gateway` (old artifact name) | Deprecated in Spring Cloud 2025.0; logs warnings; property prefix `spring.cloud.gateway.*` migrated to `spring.cloud.gateway.server.webflux.*` | `spring-cloud-starter-gateway-server-webflux` |
| kafka-clients 4.x overrides while on Boot 3.5 | spring-kafka 3.3.x is built/tested for kafka-clients 3.8–3.9; forcing 4.x clients breaks EmbeddedKafka and is unsupported territory | Let Boot manage it (3.9.x); broker 4.2 accepts 3.9 clients |
| Express 4.x | Two majors behind; new security/maintenance effort targets 5.x | express@5.2.1 (mind wildcard-route syntax changes vs old tutorials) |
| ZooKeeper container alongside Kafka | Kafka 4.x removed ZK mode entirely — a ZK container is dead weight and misleads learners | KRaft-only `apache/kafka` with `KAFKA_PROCESS_ROLES=broker,controller` |
| passlib (Python password hashing) | Effectively unmaintained; emits bcrypt-4.x compatibility warnings | `pwdlib` (FastAPI-ecosystem maintained) or `argon2-cffi` directly |

---

## Stack Patterns by Variant

**If staying strictly within the project's pinned stack (recommended default):**
- Spring Boot 3.5.16 + Spring Cloud 2025.0.3 + JDK 21 + kafkajs 2.2.4 + Mailpit.
- Accept that Boot 3.5 is past OSS EOL — acceptable for a local learning target; note it in the runbook.

**If you decide OSS-EOL matters (one-line upgrade path):**
- Bump all three Java services to Boot 4.0.x + Spring Cloud 2025.1 (Oakwood) + gateway 5.0.x starter; keep JDK 21 (or move to 25). Everything else unchanged.

**If Alpine base images cause friction (musl/glibc issues):**
- Swap `eclipse-temurin:21-jre-alpine` → `eclipse-temurin:21-jre-noble`, `python:3.13-slim` stays Debian-based already, `node:24-alpine` → `node:24-slim`.
- Required if you adopt @confluentinc/kafka-javascript (native librdkafka wants glibc).

**If Windows/macOS Docker Desktop bind-mount weirdness hits Postgres 18:**
- Use named volumes mounted at `/var/lib/postgresql` (the PG18 VOLUME root) rather than host bind-mounts; same advice applies to Mongo on macOS/Windows (memory-mapped files don't like bind mounts).

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Spring Boot 3.5.x | Spring Cloud **2025.0.x (Northfields)** ONLY | Mixing trains (e.g., 2025.1 Oakwood with Boot 3.5) is unsupported. Oakwood ⇔ Boot 4.0/4.1. |
| spring-cloud-gateway 4.3.x | Boot 3.5.x | Starter renamed `…gateway-server-webflux`; X-Forwarded-* handling disabled by default — behind Compose, set `spring.cloud.gateway.server.webflux.trusted-proxies` if the frontend relies on forwarded headers. |
| spring-kafka 3.3.x (Boot-managed) | kafka-clients 3.8–3.9 ⇔ **broker 4.2.1** ✅ | Clients older than broker = supported direction. Never bump `kafka.version` past 3.9 while on Boot 3.5. |
| kafkajs 2.2.4 ⇔ broker 4.2.1 | ✅ works | Protocol backward-compatible; KRaft is broker-side and irrelevant to clients. Risk is maintenance, not function. |
| aiokafka 0.14.0 ⇔ broker 4.2.1 | ✅ works | Explicitly tested against Kafka 4.x fetch APIs (rack-aware fetch needs Fetch v11 / Kafka 4+). |
| confluent-kafka-python 2.15.0 / @confluentinc/kafka-javascript 1.10.0 | librdkafka 2.15.0 | Same librdkafka generation as each other; both fine vs broker 4.2. |
| pymongo ≥4.9 (AsyncMongoClient) | MongoDB server 8.0 ✅ | PyMongo 4.9 added MongoDB 8.0 support; 4.17.x is current docs baseline. |
| FastAPI 0.141.1 | Python 3.10–3.14, Pydantic v2 (2.13.4) ✅ | Pin runtime to 3.13 for wheel maturity. |
| Next.js 16.3.2 | Node ≥20.9 ✅ (we run 24), React 19 | Turbopack default; fine for local dev. |
| Express 5.2.1 / ioredis 6.0.0 / nodemailer 9.0.5 | Node ≥20 (ioredis/nodemailer), ≥18 (express) | All satisfied by node:24-alpine. |
| postgres:18 image | Volume mount at `/var/lib/postgresql` | PGDATA is now version-nested; mounting `/var/lib/postgresql/data` (the pre-18 habit) silently misplaces data. |
| eclipse-temurin:21-jre-* | alpine (musl) and noble (glibc) variants both published | Verified: 21-jre-alpine, 21-jre-noble, 25-jre-alpine, 25-jre-noble all exist. |
| JDK 21 ⇔ maven-compiler-plugin | Any modern 3.13+; use ≥3.14 if targeting JDK 25 | Set `<maven.compiler.release>21</maven.compiler.release>`. |

---

## Sources

Verification performed 2026-08-24; every version below was checked against its primary distribution channel (registry JSON / release page / official image tags), then cross-checked against a second independent source:

- npm registry `latest` dist-tags (primary): express **5.2.1**, kafkajs **2.2.4**, next **16.3.2**, ioredis **6.0.0**, redis **6.2.1**, nodemailer **9.0.5** — HIGH reliability (authoritative registry data)
- PyPI project pages (primary): fastapi **0.141.1** (2026-07-29), pydantic **2.13.4** (2026-05-06)
- GitHub releases / spring.io blogs: spring-boot v3.5.16 (2026-06-25; also shows active v4.0.8/v4.1.1), confluent-kafka-python v2.15.0 (2026-06-30), aio-libs/aiokafka v0.14.0 (2026-04-29), Apache Kafka blog 4.2.1 (2026-05-30) + Downloads page (4.1.2/4.2.1 listed)
- spring.io/projects/spring-cloud + spring-cloud-release wiki "Supported Versions": train↔Boot matrix (2025.0 Northfields ⇔ 3.5.x, latest 2025.0.3; 2025.1 Oakwood ⇔ 4.0/4.1, latest 2025.1.3); endoflife.date/spring-cloud corroborates OSS EOL dates (Northfields OSS ended 2026-06-30)
- spring.io/projects/spring-kafka compatibility matrix: spring-kafka 3.3.x ⇔ kafka-clients 3.8.0–3.9.0 ⇔ Boot 3.4/3.5; 4.0.x ⇔ clients 4.1.2 ⇔ Boot 4.0 — MEDIUM
- Spring Cloud 2025.0.0 release notes + SCG 4.3 docs: starter rename to `spring-cloud-starter-gateway-server-webflux`, property-prefix migration, trusted-proxies/X-Forwarded defaults — MEDIUM
- mongodb.com/docs/drivers/motor + github.com/mongodb/motor deprecation banner: Motor deprecated 2025-05-14, EOL 2026-05-14 → PyMongo Async API — MEDIUM
- Docker Hub official image tag listings: postgres (18.6/18-alpine families; PGDATA/VOLUME change note), mongo (8.3.8-noble newest, 8.0.29 long-support), redis (8.10/8.2.8-alpine), eclipse-temurin (21/25 × jre/jdk × alpine/noble), axllent/mailpit — MEDIUM
- nodejs/Release GitHub repo + nodejs.org: v24 Krypton Active LTS (24.19.0, 2026-08-03), v22 Jod Maintenance LTS — MEDIUM
- github.com/tulios/kafkajs issue #1753 + Confluent blog/docs + Platformatic blog: kafkajs maintenance status (last release Feb 2023, maintainers stepped down Aug 2024) and successor landscape — MEDIUM
- OpenJDK/JDK guides (openjdk.org/projects/jdk/25, versions.dev, asymm.systems): JDK 21 vs 25 LTS positioning — MEDIUM

---
*Stack research for: Ecommerce Microservices Platform*
*Researched: 2026-08-24*
