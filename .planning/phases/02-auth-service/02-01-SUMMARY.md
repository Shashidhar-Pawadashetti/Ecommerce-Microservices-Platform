---
phase: 02-auth-service
plan: 01
subsystem: auth
tags: [spring-boot, maven, flyway, postgres, docker, docker-compose, jwt-skeleton]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: pinned version manifest (docs/versions.md), .gitattributes LF law, .env.example variable contract, compose header convention
provides:
  - Buildable Spring Boot 3.5.16 Maven project for auth-service (committed wrapper, parent-BOM-only versions)
  - Flyway V1 users migration (uuid PK per D-05, text[] roles per D-06, unique index users_email_uniq)
  - Multi-stage alpine Dockerfile — the copy-template for order-service (Ph5) and api-gateway (Ph7)
  - docker-compose entries: postgres:18 (pgdata at /var/lib/postgresql root, no host ports) + auth-service (transitional :8081, mem_limit 512m)
  - Proven cold-start chain: Boot boot -> Flyway V1 on PG18 -> actuator health UP
affects: [02-02 tests (Testcontainers slice rides this pom), 02-03 JWT beans (consume JWT_* env passthrough), 02-04 smoke script (targets :8081), phase-05 order-service (migration+Dockerfile template)]

actuals:
  tokens: 8406
  tasks: 2
  commits: 2

tech-stack:
  added:
    - spring-boot-starter-parent 3.5.16 (parent BOM)
    - starters web/security/oauth2-resource-server/data-jpa/validation/actuator
    - flyway-core + flyway-database-postgresql (Flyway 10 module split)
    - org.postgresql:postgresql (runtime)
    - spring-boot-testcontainers + testcontainers postgresql/junit-jupiter (test)
    - Maven Wrapper 3.3.2 (only-script distribution)
  patterns:
    - Multi-stage Dockerfile: temurin 21-jdk-alpine build -> 21-jre-alpine non-root runtime with MaxRAMPercentage=75
    - Compose memory posture pairing: image ENV flag + mem_limit on service entry
    - Flyway owns schema; Hibernate ddl-auto=validate catches drift
    - Single-word SPRING_DATASOURCE_* env spellings via Boot relaxed binding

key-files:
  created:
    - services/auth-service/pom.xml
    - services/auth-service/mvnw
    - services/auth-service/mvnw.cmd
    - services/auth-service/.mvn/wrapper/maven-wrapper.properties
    - services/auth-service/Dockerfile
    - services/auth-service/src/main/java/com/ecommerce/auth/AuthServiceApplication.java
    - services/auth-service/src/main/java/com/ecommerce/auth/config/SecurityConfig.java
    - services/auth-service/src/main/resources/application.yml
    - services/auth-service/src/main/resources/db/migration/V1__create_users.sql
  modified:
    - docker-compose.yml

key-decisions:
  - "Wrapper obtained via host-installed Maven 3.9.12 wrapper-plugin (plan's first branch) rather than Initializr zip; only-script distribution type commits properties only"
  - "SPRING_DATASOURCE_* single-word env spellings used in compose (planned correction vs research Pattern 8 draft) — relaxed binding maps them onto spring.datasource.*"
  - "D-02 read literally: POSTGRES_DB=users only; Phase-5 initdb.d obligation recorded as a compose comment beside the key"

patterns-established:
  - "Flyway migration header comment law: append-only, never edited after landing (order-service copies in Phase 5)"
  - "JVM container template: non-root user spring, BusyBox-wget healthcheck, MaxRAMPercentage=75 + mem_limit pairing"
  - "Transitional host port comment pattern marking the Phase-7 revocation point (D-09)"

requirements-completed: [SC-5]

coverage:
  - id: D1
    description: "Maven project builds a runnable jar via committed wrapper with release-21 targeting and zero dependency-version literals outside the parent BOM"
    requirement: SC-5
    verification:
      - kind: e2e
        ref: "./mvnw -q -B -DskipTests package && ls target/*.jar (exactly one jar)"
        status: pass
      - kind: other
        ref: "grep pom.xml: parent 3.5.16 present; flyway-database-postgresql alongside flyway-core; no <version> inside any dependency"
        status: pass
    human_judgment: false
  - id: D2
    description: "Flyway V1 migration encodes D-05/D-06 schema exactly: uuid PK, text[] roles defaulting {customer}, unique index users_email_uniq"
    requirement: SC-5
    verification:
      - kind: integration
        ref: "docker compose exec postgres psql \\dt shows flyway_schema_history + users; roles column data_type=ARRAY"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cold-start healthy 2-container stack: compose up builds multi-stage image and reaches /actuator/health UP (implies Flyway V1 applied) with mem_limit effective and postgres network-internal"
    requirement: SC-5
    verification:
      - kind: e2e
        ref: "docker compose up -d --build -> curl :8081/actuator/health = UP; docker inspect Memory=536870912; postgres PortBindings={}; docker compose down clean"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-25
status: complete
---

# Phase 2 Plan 1: Auth Service Skeleton & JVM-in-Docker Proof Summary

**Spring Boot 3.5.16 skeleton with committed Maven wrapper and Flyway V1 users schema, proven end-to-end through a multi-stage alpine Dockerfile to a cold-start-healthy postgres:18 + auth-service compose pair**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-25T16:42:30Z
- **Completed:** 2026-08-25T17:04:32Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Buildable Boot 3.5.16 Maven project: `./mvnw -B -DskipTests package` produces exactly one runnable jar using the committed wrapper, with every version inherited from the parent BOM (flyway-database-postgresql included per the Flyway 10 module split)
- Flyway V1 migration lands the D-04/D-05/D-06 users schema verbatim: `uuid` PK, `text[]` roles defaulting `{customer}`, `timestamptz created_at`, atomic-duplicate-guard unique index `users_email_uniq`
- Tracer proven from cold start: `docker compose up -d --build` → both containers `(healthy)` → `/actuator/health` UP → `users` + `flyway_schema_history` tables present in PG18 with `roles` typed ARRAY → `down` cleans up
- Runtime posture locked as the platform template: non-root `spring` user, `-XX:MaxRAMPercentage=75` baked into the image paired with `mem_limit: 512m` (verified `Memory=536870912`), wget-based healthcheck with `start_period: 60s`
- Compose growth-policy header corrected per D-01 (Mongo Ph3 / Redis Ph4 / Kafka Ph5 / Mailpit Ph6); transitional `8081:8081` mapping carries its explicit revoke-in-Phase-7 marker (D-09)

## Task Commits

Each task was committed atomically:

1. **Task 1: Maven scaffold — Boot 3.5.16 project, committed wrapper, Flyway V1 migration** - `f1b66fd` (feat)
2. **Task 2 (TRACER): JVM-in-Docker proof — image, compose pair, cold-start healthy** - `94be959` (feat)

## Files Created/Modified

- `services/auth-service/pom.xml` - Parent-BOM-only dependency set incl. Flyway PG companion + Testcontainers scope
- `services/auth-service/mvnw`, `mvnw.cmd`, `.mvn/wrapper/maven-wrapper.properties` - Committed wrapper (only-script distribution, Maven 3.9.12)
- `services/auth-service/src/main/java/com/ecommerce/auth/AuthServiceApplication.java` - Standard `@SpringBootApplication` entrypoint
- `services/auth-service/src/main/java/com/ecommerce/auth/config/SecurityConfig.java` - Minimal slice chain: CSRF off, STATELESS, permit `/actuator/health`, denyAll rest
- `services/auth-service/src/main/resources/application.yml` - Port 8081, env-bound datasource, `ddl-auto: validate`, health-only exposure
- `services/auth-service/src/main/resources/db/migration/V1__create_users.sql` - Users table + unique email index (append-only law stated in header)
- `services/auth-service/Dockerfile` - Multi-stage temurin alpine build/runtime (copy-template for order-service/gateway)
- `docker-compose.yml` - Growth-policy header rewrite + `postgres`/`auth-service` service keys + `pgdata` volume

## Decisions Made

- Wrapper generated via the plan's first branch (host Maven 3.9.12 detected → wrapper-plugin route) instead of downloading an Initializr zip; result is the modern only-script wrapper (properties committed, no wrapper jar)
- Applied the plan's deliberate correction to research Pattern 8: compose passes single-word `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` so Boot relaxed binding actually binds `spring.datasource.*`
- D-02 taken literally (`POSTGRES_DB: users` only); the Pitfall-8 obligation for Phase 5 (init-script backfill + one-time CREATE DATABASE for long-lived volumes) recorded in a comment beside the key
- Local `.env` generated agent-side (CSPRNG `openssl rand -base64 32` secret = 32 decoded bytes, generated DB password) — gitignored, never committed

## Deviations from Plan

None - plan executed exactly as written. Both task preconditions were satisfied at execution time (host JDK 23.0.1 present for the flagged A4 disposition; Docker daemon was down at start but brought up by launching Docker Desktop before Task 2 ran).

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. Flagged assumption A4 remains a documented deviation-from-D-08 (release-21 targeting on host JDK 23); A2 (mem_limit effective) and A5 (BusyBox `wget -qO-`) were both empirically confirmed by Task 2 verification.

## Issues Encountered

- First `./mvnw package` failed on a non-parseable POM: an XML comment contained `--` ("required -- omitting…"), which XML forbids. Reworded the comment; second build passed.
- Docker daemon was not running at executor start (research had flagged it down). Launched Docker Desktop programmatically; daemon reported server 29.4.0 within ~4 minutes, before Task 2 needed it.

## User Setup Required

None - no external service configuration required. (Local `.env` was generated automatically from `.env.example`; regenerate anytime with `cp .env.example .env` plus fresh `JWT_SECRET`.)

## Next Phase Readiness

- Ready for Plan 02-02 (entities/repository/service + unit & Testcontainers tests ride the committed pom)
- Plan 02-03 adds the JWT encoder/decoder beans consuming the `JWT_*` env passthrough wired here, plus resource-server customizer replacing the minimal security chain
- Plan 02-04's smoke script targets the transitional `:8081` mapping proven here
- Template obligations delivered: order-service (Phase 5) copies the Dockerfile/Flyway/compose patterns; note the Phase-5 initdb.d comment obligation before planning that phase

---
*Phase: 02-auth-service*
*Completed: 2026-08-25*

## Self-Check: PASSED

All 10 created/modified files exist on disk; all 3 commits (f1b66fd, 94be959, 1f5586a) present in git log. Plan-level verification re-confirmed: `./mvnw package` exit 0, cold-start compose healthy with Flyway-migrated schema, `scripts/check-contracts.sh` pass, all added files `i/lf`.
