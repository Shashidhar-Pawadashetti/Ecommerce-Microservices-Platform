# Phase 2: Auth Service - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Java/Spring Boot auth-service delivering signup / login / JWT issuance / `/me` on PostgreSQL (AUTH-01…AUTH-04), plus the first JVM-in-Docker proof: multi-stage Dockerfile, compose entry with passing healthcheck, tuned memory flags, and a standalone curl smoke test. The patterns produced here (Flyway migration, Testcontainers test setup, memory posture, smoke-script shape, temp-port transition) are templates that order-service, gateway, and later phases copy.

</domain>

<decisions>
## Implementation Decisions

### Docker Compose & Runtime Scope
- **D-01:** Phase 2 adds ONLY `postgres:18` + `auth-service` to docker-compose.yml. The stale Phase 1 header comment ("Phase 2 adds shared infrastructure") is corrected to state the incremental-growth policy: Mongo joins in Phase 3, Redis in Phase 4, Kafka in Phase 5, Mailpit in Phase 6 — each datastore/broker arrives with its first consuming service. Roadmap reframe wins over build-plan §4.
- **D-02:** ONE Postgres container hosting two databases: `users` created now; `orders` database added by order-service in Phase 5. Fewer containers/RAM on dev machines, single volume to reset.
- **D-03:** JVM memory posture: `-XX:MaxRAMPercentage=75` in the Dockerfile plus a `mem_limit` on the compose entry. This is the flag pattern all JVM services copy (ORCH-02 OOMKill concern).

### Persistence
- **D-04:** Schema managed by Flyway (`V1__create_users.sql` committed under the service); Boot-managed dependency, no extra version pins. Order-service reuses the migration pattern in Phase 5.
- **D-05:** User IDs generated app-side (JPA/Hibernate UUID), stored as native Postgres `uuid` column, stringified on the wire per interop rules — matches contract examples. — **Reversibility:** costly — user IDs become foreign references once cart (Phase 4) and order (Phase 5) store them; changing generation later means migrating the primary key AND every downstream reference.
- **D-06:** Roles stored as Postgres `text[]` mapped naturally by Hibernate; matches the contract's array shape without joins. v1 always populates `[customer]`.

### Testing
- **D-07:** Unit tests for service-layer logic PLUS a `@SpringBootTest` slice backed by Testcontainers `postgres:18` — validates the Flyway migration and real SQL dialect (uuid + array columns are exactly where H2 diverges).
- **D-08:** Tests run on host via `./mvnw test` with a local JDK 21 prerequisite; Testcontainers drives Docker Desktop. No local-Maven install needed (wrapper committed).

### Ports & Verification
- **D-09:** auth-service publishes temporary host port `8081:8081` in compose with an explicit comment marking it transitional; Phase 7 revokes it as part of GTWY-04 isolation verification. Same revoke-later pattern the gateway already plans.
- **D-10:** Standalone smoke test is a committed script `scripts/smoke-auth.sh`: signup → login → `/me` with status-code assertions. Later phases add sibling scripts; Phase 9 chains them into the zero-manual-steps E2E.

### Agent's Discretion
Standard implementation details left to researcher/planner: healthcheck endpoint specifics (actuator exposure breadth), email normalization rules, bcrypt cost factor, error-body shape (follow `docs/api-contracts/_shared.yaml` responses), Spring Security config style, package structure.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frozen Contracts
- `docs/api-contracts/auth-service.openapi.yaml` — Source of truth for all endpoints/shapes/errors; info.description freezes JWT conventions (D-JWT: HS256 pinned, iss/aud/TTL/skew) and logout policy (D-03: NO logout endpoint). API changes start here, never in code.
- `docs/api-contracts/_shared.yaml` — Shared components: bearerAuth scheme, Conflict (409 DUPLICATE_EMAIL), Unauthorized (401) response shapes.
- `docs/json-interop.md` — §JWT Claims (canonical claims table — single home, do not duplicate); §Secret Handling (CSPRNG ≥32 bytes, startup assertion, holders = auth-service + gateway only); cross-language JSON rules (ISO 8601, integer cents, string IDs, unknown-fields-ignored).

### Pinned Versions & Config
- `docs/versions.md` — Exact pins: Spring Boot 3.5.16, Spring Cloud 2025.0.3, JDK 21, eclipse-temurin 21-jre base, Postgres 18 (volume at `/var/lib/postgresql`, NOT `/data`). Boot 3.5 post-OSS-EOL posture accepted per D-07.
- `.env.example` — Contractual variable names this service consumes: `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_TTL_SECONDS`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.

### Workflow Rules
- `docker-compose.yml` — Growth policy header (to be corrected per D-01); values come from `.env`.
- `scripts/check-contracts.sh` — Must pass at Verify: diffs live springdoc output against the committed OpenAPI spec.
- `.planning/ROADMAP.md` §Phase 2 — Goal and 5 success criteria (signup/dup-email/hash, login/JWT, `/me` authz, documented client-side logout, multi-stage build + healthcheck + curl smoke test).
- `.gitattributes` — LF enforcement law; shell scripts must be LF.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/auth-service/` — empty scaffold dir (`.gitkeep`) awaiting Maven project; wrapper goes here.
- `scripts/check-contracts.sh` — existing verify gate wiring for contract conformance.
- `docs/_shared.yaml` component library — reuse response schemas instead of inventing new ones.
- `.env.example` — already defines every variable name this service needs; add nothing new.

### Established Patterns
- Contracts-first: OpenAPI file is edited before/with code; live output diffed at Verify (Phase 1 workflow, continues here).
- Monorepo layout: everything under `services/auth-service/`; root-level shared files only.
- Windows hygiene: `.gitattributes` LF enforcement applies to `scripts/smoke-auth.sh`.

### Integration Points
- Gateway (:8080) proxies `/auth/**` → auth-service (:8081) — server URL already declared in the OpenAPI spec; direct :8081 access is the Phase 2–6 reality until Phase 7.
- Issued JWTs are verified by api-gateway (Phase 7) and trusted by cart-service (Phase 4, `sub` claim) and order-service (Phase 5) — claim fidelity is cross-phase contract.
- Shared PG container must support a second database (`orders`) being added in Phase 5 without recreation.

</code_context>

<specifics>
## Specific Ideas

User consistently selected the option that maximizes reusability-as-template: memory flags, Flyway migration, Testcontainers setup, and smoke-script are all explicitly meant as copy-sources for later phases. Dev-machine friendliness mattered in each trade-off (fewer containers, mem_limit, host-driven tests).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Auth Service*
*Context gathered: 2026-08-25*
