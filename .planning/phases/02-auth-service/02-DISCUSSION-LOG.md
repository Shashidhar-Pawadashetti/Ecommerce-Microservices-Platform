# Phase 2: Auth Service - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 2-Auth Service
**Areas discussed:** Compose scope, Schema management, Test depth, Port & smoke shape

---

## Compose scope

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres + auth only | Matches roadmap's incremental reframe; stale header corrected; infra arrives with first consumer (Kafka→Ph5, Mongo→Ph3, Redis→Ph4, Mailpit→Ph6) | ✓ |
| Full shared infra now | Follows original build-plan §4 literally: all datastores + broker + Mailpit + Kafka UI land now, mostly idle; heavier dev-machine load | |

| Option | Description | Selected |
|--------|-------------|----------|
| One PG, two DBs | One postgres:18 container hosting `users` (now) and `orders` (Ph5); fewer containers/RAM, one volume to reset | ✓ |
| PG per service | Separate containers per Java service; stronger isolation but +1 container and RAM | |

| Option | Description | Selected |
|--------|-------------|----------|
| RAMPercentage + mem_limit | `-XX:MaxRAMPercentage=75` + compose `mem_limit`; container-aware, template for other JVM services, avoids OOMKill (ORCH-02) | ✓ |
| Fixed heap flags | Hard-coded `-Xmx512m -Xms256m`; predictable but needs editing per service | |

**User's choice:** Recommended options — minimal Compose footprint now, shared PG instance, container-aware memory posture.
**Notes:** User flagged the conflict between the compose header comment and the roadmap reframe as worth discussing; resolution: roadmap wins, header gets corrected.

## Schema management

| Option | Description | Selected |
|--------|-------------|----------|
| Flyway | V1__create_users.sql committed in service; versioned evolution from day one; research-recommended | ✓ |
| Hibernate auto-ddl | ddl-auto=update; zero migration files but no history, unsafe across changes | |
| schema.sql init | Spring SQL init; simple/explicit but no incremental evolution | |

| Option | Description | Selected |
|--------|-------------|----------|
| App-side UUID | JPA generates uuid client-side; native PG uuid column; string on wire per interop rules | ✓ |
| DB-generated | gen_random_uuid() DDL default; ID known only after insert | |
| Bigint sequence | bigserial stringified; smallest storage but enumerable IDs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres text[] | Native array column mapped by Hibernate; matches contract array shape without joins | ✓ |
| Scalar role column | Single varchar ('customer'); simplest but diverges from contract shape | |
| Join table | user_roles join table; canonical RBAC but a join for data always ['customer'] in v1 | |

**User's choice:** All recommended — Flyway, app-side UUIDs, text[] roles.
**Notes:** None.

## Test depth

| Option | Description | Selected |
|--------|-------------|----------|
| Unit + Testcontainers | Service-layer unit tests + @SpringBootTest against Testcontainers postgres:18; validates Flyway migration and real PG dialect | ✓ |
| Unit only | Pure Mockito-style; fast but nothing proves migration/queries run on PG18 | |
| Unit + H2 | In-memory H2 in PG mode; no Docker dep but diverges exactly where schema is unusual (uuid, arrays) | |

| Option | Description | Selected |
|--------|-------------|----------|
| Host Maven | ./mvnw test with local JDK 21; Testcontainers drives Docker Desktop; standard workflow | ✓ |
| Container-only | Tests inside multi-stage docker build; no local JDK but slow inner loop on Windows/OneDrive | |

**User's choice:** Recommended — real-PG integration tests via host Maven.
**Notes:** None.

## Port & smoke shape

| Option | Description | Selected |
|--------|-------------|----------|
| Temp port now, revoke Ph7 | 8081:8081 published with explicit transitional comment; Phase 7 revokes it (GTWY-04); mirrors gateway's planned revoke-later pattern | ✓ |
| Never published | Smoke test curls from inside network via compose exec; purest end-state but exec ceremony + Windows quoting pain every phase | |

| Option | Description | Selected |
|--------|-------------|----------|
| Committed script | scripts/smoke-auth.sh (signup → login → /me, status assertions); siblings in later phases; Phase 9 chains into zero-manual-steps E2E | ✓ |
| Documented curls | Curl sequence in README/docs run by hand; zero maintenance but manual steps contradict scripted-verify trajectory | |

**User's choice:** Recommended — temporary port with explicit Phase 7 revocation, committed smoke script.
**Notes:** None.

---

## Agent's Discretion

No "you decide" selections were made; all choices explicit. Researcher/planner retain discretion over: healthcheck endpoint specifics, email normalization, bcrypt cost factor, error-body details (follow _shared.yaml), Spring Security config style, package structure.

## Deferred Ideas

None — discussion stayed within phase scope.
