---
phase: 02-auth-service
plan: 02
subsystem: auth
tags: [spring-boot, jpa, hibernate-6, bcrypt, flyway, testcontainers, postgres, mockmvc]

# Dependency graph
requires:
  - phase: 02-auth-service
    plan: 01
    provides: Boot 3.5.16 Maven project (committed wrapper), Flyway V1 users schema (uuid PK, text[] roles, users_email_uniq), minimal SecurityConfig chain, Testcontainers test deps in pom
provides:
  - Signup vertical end-to-end: POST /auth/signup → 201 User JSON per frozen contract (AUTH-01)
  - User entity (@UuidGenerator app-side UUID PK, text[] roles) + UserRepository.findByEmail
  - UserService.signup slice with Locale.ROOT lowercase normalization and two-layer race-safe duplicate detection (fast DuplicateEmailException signal + users_email_uniq backstop)
  - BCryptPasswordEncoder(12) bean — raw "$2a$" bcrypt column representation (Q3/A3)
  - Unified ApiError {code,message} envelope + GlobalExceptionHandler (400 VALIDATION_FAILED / 409 DUPLICATE_EMAIL, exact _shared.yaml strings)
  - web.dto SignupRequest/UserResponse records — mass-assignment-safe binding, string UUID ids (Rule 3), millisecond-Z createdAt (Rule 1)
  - Surefire UTC pin (-Duser.timezone=UTC) making host-driven Testcontainers slices portable — template for every later JVM service slice
affects: [02-03 token plane (login/me extend UserService + AuthController + AuthFlowIntegrationTests seams), 02-04 smoke script (asserts signup shapes live), phase-05 order-service (copies entity/migration/Testcontainers patterns)]

actuals:
  tokens: 7102
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - Two-layer duplicate detection: unit-testable findByEmail fast signal backed by the unique-index DataIntegrityViolationException translation (never pre-check-as-sole-guard)
    - DTO records mirror contract schemas verbatim; identity/roles/timestamps server-assigned only (T-02-mass mitigation)
    - @JsonFormat(pattern="yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone="UTC") on Instant wire fields for interop Rule 1
    - Mocked-repo unit slice (no Spring/Docker) beneath @ServiceConnection Testcontainers slice (D-07 layering)

key-files:
  created:
    - services/auth-service/src/main/java/com/ecommerce/auth/user/User.java
    - services/auth-service/src/main/java/com/ecommerce/auth/user/UserRepository.java
    - services/auth-service/src/main/java/com/ecommerce/auth/user/UserService.java
    - services/auth-service/src/main/java/com/ecommerce/auth/web/dto/SignupRequest.java
    - services/auth-service/src/main/java/com/ecommerce/auth/web/dto/UserResponse.java
    - services/auth-service/src/main/java/com/ecommerce/auth/support/ApiError.java
    - services/auth-service/src/main/java/com/ecommerce/auth/web/GlobalExceptionHandler.java
    - services/auth-service/src/main/java/com/ecommerce/auth/web/AuthController.java
    - services/auth-service/src/test/java/com/ecommerce/auth/user/UserServiceTests.java
    - services/auth-service/src/test/java/com/ecommerce/auth/web/AuthFlowIntegrationTests.java
  modified:
    - services/auth-service/src/main/java/com/ecommerce/auth/config/SecurityConfig.java
    - services/auth-service/pom.xml

key-decisions:
  - "Surefire argLine pins -Duser.timezone=UTC: pgjdbc transmits the host TZ at connect and postgres:18 tzdata rejects legacy zone names (Asia/Calcutta FATAL) — UTC also matches interop Rule 1"
  - "DuplicateEmailException nested in UserService (keeps files_modified scope); handler trio in GlobalExceptionHandler gives fast-path and race-backstop identical 409 envelopes"
  - "DTO records public: artifact spec places them in the web.dto subpackage, so cross-package controller access requires public types"

patterns-established:
  - "GSD TDD rhythm for this repo: test(02-xx) RED commit then feat(02-xx) GREEN commit per task"
  - "@JdbcTypeCode(SqlTypes.ARRAY) + columnDefinition text[] recipe for List<String> on PG (Hibernate 6.6) — order-service copies in Phase 5"
  - "Byte-exact error-envelope assertions via content().string(equalTo(...)) against _shared.yaml example strings"

requirements-completed: [AUTH-01]

coverage:
  - id: D1
    description: "Signup domain core: lowercase normalization ordering, conflict-signal-without-insert, [customer] roles, app-generated UUID, non-null createdAt"
    requirement: AUTH-01
    verification:
      - kind: tests
        ref: "tests/com.ecommerce.auth.user.UserServiceTests#signupNormalizesEmailToLowercaseBeforeLookupAndSave+3 more (4/4 pass, mocked repo, no Docker)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signup wire contract: 201 User shape with string UUID id, lowercased email, roles=[customer], millisecond-Z createdAt regex"
    requirement: AUTH-01
    verification:
      - kind: tests
        ref: "tests/com.ecommerce.auth.web.AuthFlowIntegrationTests#validSignupReturns201WithContractUserShape (Testcontainers postgres:18)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exact contracted error envelopes: 409 DUPLICATE_EMAIL and 400 VALIDATION_FAILED byte-match _shared.yaml example strings"
    requirement: AUTH-01
    verification:
      - kind: tests
        ref: "tests/AuthFlowIntegrationTests#duplicateEmailReturnsExact409ConflictEnvelope + malformedEmail/shortPassword methods (content().string(equalTo(...)))"
        status: pass
    human_judgment: false
  - id: D4
    description: "Credential material stored bcrypt-only: $2a$ prefix, never plaintext/reversible (AUTH-01 core truth)"
    requirement: AUTH-01
    verification:
      - kind: tests
        ref: "tests/AuthFlowIntegrationTests#storedCredentialIsBcryptHashNeverPlaintext (real DB row via repository)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Race-safe duplicate backstop: DataIntegrityViolationException translated to the same 409 DUPLICATE_EMAIL envelope"
    requirement: AUTH-01
    verification: []
    human_judgment: true
    rationale: "Handler is wired into the @RestControllerAdvice and compiles into the advice chain, but no automated test forces a unique-index violation past the pre-check; verifier can exercise by inserting a row directly then re-signing-up"

duration: 15min
completed: 2026-08-25
status: complete
---

# Phase 2 Plan 2: Signup Vertical Summary

**Bcrypt-only email/password signup on the Wave-1 skeleton: POST /auth/signup persists app-generated UUID identities under the Flyway-managed PG18 schema, rejects duplicates and malformed input with byte-exact contracted envelopes, proven by a mocked-repo unit slice plus a Testcontainers postgres:18 integration suite (AUTH-01)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-25T17:19:34Z
- **Completed:** 2026-08-25T17:34:07Z
- **Tasks:** 2 (each RED→GREEN)
- **Files modified:** 12

## Accomplishments

- Signup persistence core green at unit level without Docker: lowercase normalization proven BEFORE lookup-and-save via InOrder verification, conflict signal raised with zero insert attempts, saved entities carry `[customer]` roles + non-null createdAt + bcrypt-only credential material
- `POST /auth/signup` live through the full filter chain on ephemeral postgres:18 (`@ServiceConnection`, D-07): 201 body carries a string UUID id, normalized email, `roles:["customer"]`, and createdAt matching the `\d{4}-…\.d{3}Z` millisecond law (interop Rule 1 / Pitfall 3 guard)
- Duplicate re-submission answers the exact `_shared.yaml` Conflict envelope byte-for-byte; malformed email and sub-8 passwords answer the exact ValidationError envelope — asserted with `content().string(equalTo(...))`
- Race safety built to spec: `UserService.signup` consults `findByEmail` as a fast unit-testable signal while the `users_email_uniq` unique index remains the authoritative backstop, translated by `DataIntegrityViolationException` handling to the identical 409 envelope
- Mass assignment impossible by construction: `SignupRequest` binds exactly two fields; identity, roles, and timestamps are server-assigned (threat T-02-mass mitigated)
- Full plan verification green: `./mvnw test` 9/9 across both slices, `scripts/check-contracts.sh` passes (operationIds intact), zero new env var names

## Task Commits

Each task followed the RED→GREEN TDD flow:

1. **Task 1 (Persistence slice):** `934aedc` (test RED) → `692e761` (feat GREEN)
   User entity (@UuidGenerator, text[] roles), UserRepository.findByEmail, UserService.signup with DuplicateEmailException, SecurityConfig BCryptPasswordEncoder(12) bean
2. **Task 2 (Signup web contract):** `75e69dd` (test RED, incl. Rule-3 pom fix) → `75b9631` (feat GREEN)
   DTOs, ApiError, GlobalExceptionHandler, AuthController, `/auth/signup` permitAll matcher

## Files Created/Modified

- `user/User.java` — @Entity mapping V1 verbatim: uuid PK generated app-side (D-05), `password_hash`, text[] roles via @JdbcTypeCode(SqlTypes.ARRAY) (D-06), updatable=false created_at with @PrePersist guard
- `user/UserRepository.java` — JpaRepository + Optional<User> findByEmail(String)
- `user/UserService.java` — signup(email,password) primitives; Locale.ROOT normalization; bcrypt-only credential entry; nested DuplicateEmailException
- `web/dto/SignupRequest.java` · `web/dto/UserResponse.java` — contract-mirror records (public, subpackage layout per artifact spec); UserResponse carries the millisecond-Z @JsonFormat
- `support/ApiError.java` — unified {code,message} envelope record
- `web/GlobalExceptionHandler.java` — validation → 400, duplicate fast-path AND integrity violations → identical 409; internals logged server-side only
- `web/AuthController.java` — single write operation [operationId signup]; NO logout mapping (frozen D-03)
- `config/SecurityConfig.java` — encoder bean + `/auth/signup` permitAll beside actuator health; anyRequest().denyAll() retained
- `pom.xml` — surefire `-Duser.timezone=UTC` (Rule-3 blocker fix, see Deviations)

## Decisions Made

- **Surefire UTC pin** (Rule 3): pgjdbc transmits the JVM default TimeZone during connect; this host's `Asia/Calcutta` is a legacy zone name absent from postgres:18's tzdata, producing `FATAL: invalid value for parameter "TimeZone"` before Flyway could run. Pinning test JVMs to UTC fixes the blocker AND encodes the platform's UTC law (json-interop Rule 1). This travels as the Testcontainers template for order-service (Phase 5).
- **Third exception handler** (Rule 2): the plan specified two handlers, but Task 1's mandated fast conflict signal would surface as 500 without explicit translation. Added `@ExceptionHandler(UserService.DuplicateEmailException.class)` emitting the identical DUPLICATE_EMAIL envelope as the constraint-violation backstop.
- **Public DTO records** (Rule 3): artifact spec locates DTOs in the `web.dto` subpackage; cross-package access from `AuthController` requires public types. First package-private attempt failed compilation.
- **Mock emulates @UuidGenerator**: the unit slice's mocked `save()` assigns a random UUID, modeling persist-time generation so "app-generated UUID id" is assertable below the integration seam.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Host timezone broke Testcontainers boot**
- **Found during:** Task 2 RED run
- **Issue:** `FATAL: invalid value for parameter "TimeZone": "Asia/Calcutta"` — ApplicationContext failed to load; pgjdbc sends the host TZ GUC and postgres:18 tzdata lacks legacy zone names
- **Fix:** surefire argLine `-Duser.timezone=UTC` in pom.xml
- **Files modified:** services/auth-service/pom.xml
- **Verification:** context boots, Flyway applies, all assertions execute
- **Commit:** 75e69dd

**2. [Rule 2 - Missing critical] Fast-path duplicate signal had no translator**
- **Found during:** Task 2 GREEN implementation
- **Issue:** Plan's GlobalExceptionHandler listed two handlers; the service-level DuplicateEmailException would otherwise escape as 500, violating the contracted 409 behavior
- **Fix:** third handler mapping the signal to the identical DUPLICATE_EMAIL envelope
- **Files modified:** services/auth-service/src/main/java/com/ecommerce/auth/web/GlobalExceptionHandler.java
- **Verification:** duplicateEmailReturnsExact409ConflictEnvelope green (fast path exercised)
- **Commit:** 75b9631

**3. [Rule 3 - Blocking] Package-private DTOs unreachable cross-package**
- **Found during:** Task 2 GREEN compile
- **Issue:** records in `web.dto` were package-private per research house style; `AuthController` in `web` cannot access them
- **Fix:** made both records (and `UserResponse.from`) public
- **Files modified:** SignupRequest.java, UserResponse.java
- **Verification:** full compile + suite green
- **Commit:** 75b9631

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing-critical).
**Impact on plan:** None on behavior or contracts — all fixes bring the implementation INTO contract compliance; flagged assumption A3 (bcrypt cost 12) implemented as planned.

## Issues Encountered

- Initial Task-2 RED authoring used `jsonPath(...).matches(regex)`, which does not exist on `JsonPathResultMatchers`; moved the millisecond-Z assertion onto an extracted value via AssertJ before the RED gate ran. (Test-authoring detail, not a production deviation.)
- Pre-existing dirty state unrelated to this plan was left untouched: `.planning/config.json` (modified), `.gsd/`, `.planning/milestone.lock` (untracked runtime artifacts).

## Authentication Gates

None — no external credentials required. Docker daemon was already running at start (29.4.0), satisfying Task 2's precondition without intervention.

## Known Stubs

None — every component is fully wired: real repository, real bcrypt encoder, real controller/advice chain; no placeholders, TODOs, or unwired data paths.

## Next Phase Readiness

- Ready for Plan 02-03 (token plane): login/me extend the deliberately-primitive seams left here — `UserService` gains login/profileOf/issueToken beside signup, `AuthController` gains the `/auth/login` permitAll matcher + authenticated routes, `AuthFlowIntegrationTests` extends again
- JWT_* env passthrough already wired in compose (Wave 1); JwtSecretAssertion/JwtConfig land next plan against those names
- The surefire UTC pin and the @ServiceConnection slice are copy-ready templates for Phase 5 order-service tests
- Smoke script (Plan 02-04) can assert the exact envelopes proven here byte-for-byte

---
*Phase: 02-auth-service*
*Completed: 2026-08-25*

## Self-Check: PASSED

All 10 created files exist on disk; all 5 commits (934aedc, 692e761, 75e69dd, 75b9631, 5772e9c) present in git log. Plan-level verification re-run this session: `./mvnw test` 9/9 green (unit slice Docker-free + Testcontainers postgres:18 integration), `scripts/check-contracts.sh` pass.
