---
phase: 02-auth-service
verified: 2026-08-25T19:24:59Z
status: passed
score: 5/6 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps: []
behavior_unverified_items:

  - truth: "Duplicate detection is race-safe: a unique-index violation slipping past the pre-check is translated by the DataIntegrityViolationException handler into the same 409 DUPLICATE_EMAIL envelope (plan 02-02 must-have truth #4, executor coverage item D5 human_judgment)"
    test: "Drive a real users_email_uniq violation through the live handler — e.g. a transactional race harness, or a slice test that saves past the pre-check window — and observe the response"
    expected: "409 with body {\"code\":\"DUPLICATE_EMAIL\",\"message\":\"An account with this email already exists.\"} (byte-identical to the fast-path envelope), never a 500"
    why_human: "The handler is present and wired into @RestControllerAdvice and the index exists in the Flyway-managed schema, but no automated test forces a constraint violation past the findByEmail pre-check; a deterministic race harness is non-trivial to automate, so the transition itself is unexercised. Presence checks cannot see whether the advice engages on the live path."
next_action: "Resolve the single behavior-unverified item (race-backstop translation) via human verification or an accepted override; optionally schedule review warnings WR-01..WR-04 as hardening backlog. No code gaps block the phase goal."
next_command: "/gsd-verify-work 02"
---

# Phase 2: Auth Service Verification Report

**Phase Goal:** Users can securely register, log in, and prove who they are via JWT — and the riskiest runtime family (JVM-in-Docker: multi-stage build, memory flags, PG18 volume mount) is proven first, producing templates the order service and gateway copy.
**Verified:** 2026-08-25T19:24:59Z
**Status:** human_needed (0 gaps; 1 behavior-unverified truth routed to human)
**Re-verification:** No — initial verification

## Verification Method & Evidence Freshness

Adversarial stance applied: SUMMARY claims were treated as unproven until cross-checked against source.

- **Freshness proof:** surefire reports (`target/surefire-reports/*.txt`, 20/20 tests, 0 failures, timestamps 2026-08-26 00:14:59/00:15:13 +0530) post-date the final commit touching auth source and smoke script (`9962ea1` at 00:14:37 +0530), and `git status --porcelain services/auth-service/src` is empty — the green suite ran against exactly the committed code.
- **Independent reproduction:** verifier re-ran one named behavior-dependent test (`AuthFlowIntegrationTests#validSignupReturns201WithContractUserShape`) with Docker up → exit 0; full chain observed live (context boot, Testcontainers postgres:18.6, Flyway apply, JwtSecretAssertion logging length-only "37 decoded bytes", contract-shape assertions).
- **Independent gate re-runs:** `bash scripts/check-contracts.sh` → exit 0 (all five stages incl. auth signup/login/getMe operationIds); LF audit → 0 `i/crlf` rows outside `*.bat/*.cmd`.
- All 12 commits claimed across summaries exist in git (`f1b66fd`, `94be959`, `934aedc`, `692e761`, `75e69dd`, `75b9631`, `0528819`, `f8de8ca`, `ebe719f`, `be02220`, `64f0aea`, `9962ea1`).

## Goal Achievement

### Observable Truths

Consolidated from ROADMAP SC-1..SC-5 (contract) merged with plan must_haves (plans add detail, subtract nothing).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1: Signup with email/password works; duplicate emails rejected; passwords hashed (bcrypt), not recoverable | ✓ VERIFIED | `validSignupReturns201WithContractUserShape` (**independently re-run by verifier**, exit 0); `duplicateEmailReturnsExact409ConflictEnvelope`; `storedCredentialIsBcryptHashNeverPlaintext` (real DB row asserts `$2a$` prefix, rejects plaintext equality); smoke steps 1–2 ALL PASS ×2 (executor e2e). bcrypt(12) is one-way; plaintext reaches entity only via encoder (UserService.java:95) |
| 2 | Plan 02-02 deep invariant: duplicate detection race-safe — unique index is authoritative detector; pre-check only a fast signal, never sole guard | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Structure verified: `users_email_uniq` in V1 migration (applied in every container/test run), pre-check raises `DuplicateEmailException` before insert (unit-tested InOrder, conflict-without-insert), handler wired in `@RestControllerAdvice`. **Not proven:** a real constraint violation flowing through the live handler → 409. No test exercises that transition (executor's own D5 human_judgment flag agrees). See Human Verification #1 |
| 3 | SC-2: Valid credentials → signed HS256 JWT; invalid refused | ✓ VERIFIED | `loginReturnsThreeSegmentHs256TokenWithCanonicalClaims` (in-test Base64 payload decode: sub=user-id string, iss=ecommerce-auth, aud∋ecommerce-api, exp−iat=3600, JOSE header pinned HS256); `wrongPasswordAndUnknownEmailReturnByteIdentical401Envelopes` (full-body equality + equal-cost dummy bcrypt compare); decoder MAC-restricted via `withSecretKey`; smoke steps 3–4 |
| 4 | SC-3: `/me` with valid JWT → own profile; without valid JWT → rejected | ✓ VERIFIED | `meWithFreshBearerTokenReturnsSameUserShapeAsLogin` + six rejection tests (missing header, garbage bearer, foreign-signed, expired+61s skew boundary, RS256 swap / alg=none, ghost-subject→401-not-404); identity exclusively from verified sub (`AuthController.me` → `UUID.fromString(authentication.getName())`); entry point rides oauth2ResourceServer customizer; smoke steps 5–6. Advisory edge: WR-01 notes a validly-signed token with non-UUID `sub` crashes to a bare 500 — fail-closed, no access granted; does not defeat this truth |
| 5 | SC-4: Logout = documented client-side token discard, no server revocation v1, stated in service docs | ✓ VERIFIED | README dedicated statement citing contract `info.description` ("there is NO logout endpoint…", openapi.yaml lines 36-38); controller defines no logout mapping (source-verified); runtime absence enforced: smoke step 7 asserts 404 with valid bearer + `unmappedRouteWithValidBearerTokenAnswersTrue404` regression locks true-404 semantics post ERROR-dispatch fix |
| 6 | SC-5: Multi-stage Dockerfile; own compose entry w/ passing healthcheck; standalone curl smoke signup→login→/me passes | ✓ VERIFIED | Source-verified: two-stage temurin alpine Dockerfile (21-jdk build → 21-jre non-root runtime, MaxRAMPercentage=75); compose entries for postgres:18 (pgdata at `/var/lib/postgresql` root, no host ports, pg_isready healthcheck) + auth-service (transitional :8081 marker D-09, mem_limit 512m, depends_on service_healthy, wget healthcheck start_period 60s). Executor e2e documented twice: rebuild healthy via bounded poll, smoke ALL PASS 7/7, docker inspect Memory=536870912. Verifier independently reproduced app-boot-and-serve against real PG18 (named test above). Sources unchanged since those runs (clean tree) |

**Score:** 5/6 truths verified (1 present, behavior-unverified)

### Deferred Items

Design decisions recorded this phase whose work belongs to later phases — not gaps.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Credential-stuffing throttling absent at service level | Phase 7 | GTWY-05 gateway rate limiting; residual risk documented in README §Residual risks |
| 2 | Transitional host port `8081:8081` still published | Phase 7 | GTWY-04 revocation; explicit comment at docker-compose.yml line 45-46 (D-09) |
| 3 | Orders database not yet created in shared postgres container | Phase 5 | D-02 honored literally; Phase-5 initdb.d backfill obligation recorded in compose comment lines 26-29 |

### Required Artifacts

All artifacts verified at three levels (exists / substantive / wired).

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/auth-service/pom.xml` | Boot 3.5.16 parent-BOM-only build | ✓ VERIFIED | Only `<version>` literals are parent 3.5.16 + project 0.0.1-SNAPSHOT; flyway-database-postgresql present alongside flyway-core; Testcontainers test scope |
| `services/auth-service/mvnw` + wrapper props | Committed wrapper, pinned distribution | ✓ VERIFIED | Maven 3.9.12 pinned (no SHA-256 sum — advisory IN-06) |
| `src/main/java/.../AuthServiceApplication.java` | Boot entrypoint | ✓ VERIFIED | Standard main class |
| `config/SecurityConfig.java` | Finalized stateless chain + bcrypt(12) bean | ✓ VERIFIED | CSRF off, STATELESS, exactly three permitAll matchers (+ERROR dispatch), `/auth/**` authenticated, denyAll default, jwt(withDefaults()) + entry point on resource-server customizer |
| `config/JwtConfig.java` | HS256 encoder + MAC-restricted decoder w/ validators | ✓ VERIFIED | OctetSequenceKey HS256 JWK; SecretKeySpec HMACSHA256 decoder; DelegatingValidator(skew 60s, default-with-issuer, audience-contains) |
| `config/JwtSecretAssertion.java` | ≥32-byte fail-fast gate, length-only logging | ✓ VERIFIED | ApplicationRunner throws IllegalStateException <32 bytes; log emits byte count only (observed live in verifier's test run) |
| `security/RestAuthenticationEntryPoint.java` | Single-source 401 envelope | ✓ VERIFIED | Public constant reused by controller failure path — byte-identical bodies guaranteed |
| `web/AuthController.java` | signup/login/me mappings, NO logout | ✓ VERIFIED | Three contracted operations; explicit no-logout javadoc; delegates to UserService primitives |
| `user/User.java` + `UserRepository.java` + `UserService.java` | Entity/repository/domain core | ✓ VERIFIED | @UuidGenerator app-side UUID, text[] roles via @JdbcTypeCode, password_hash column mapping matches V1 verbatim (ddl-auto validate enforces) |
| `web/dto/*` records | Contract-mirror DTOs | ✓ VERIFIED | SignupRequest/LoginRequest bind exactly two fields (mass-assignment safe); UserResponse millisecond-Z @JsonFormat |
| `support/ApiError.java` + `web/GlobalExceptionHandler.java` | Unified envelope + translators | ✓ VERIFIED | 400 VALIDATION_FAILED / fast-path 409 / integrity-violation 409; exact `_shared.yaml` strings (byte-match asserted by tests) |
| `application.yml` | Port/env bindings/ddl-auto/jwt.* | ✓ VERIFIED | ddl-auto: validate; health-only exposure; jwt.* bound from contractual JWT_* env names with documented dev-only default |
| `db/migration/V1__create_users.sql` | users table + unique email index | ✓ VERIFIED | uuid PK, varchar(255) email/password_hash, text[] roles default {customer}, timestamptz, `users_email_uniq`; append-only header law; directory holds ONLY V1 |
| `services/auth-service/Dockerfile` | Multi-stage template | ✓ VERIFIED | 21-jdk-alpine build → 21-jre-alpine non-root runtime; go-offline layer cache tolerated; MaxRAMPercentage=75 baked |
| `docker-compose.yml` | postgres + auth-service pair | ✓ VERIFIED | Growth-policy header (D-01); PG18 root volume mount; no datastore ports; transitional-port comment; mem_limit 512m; full env passthrough |
| `scripts/smoke-auth.sh` | Standalone 7-step live gate | ✓ VERIFIED | jq-free pure-curl status assertions matching claims exactly; AUTH_BASE_URL override; fail-fast labeled FAIL; statuses only, never tokens |
| `services/auth-service/README.md` | Logout policy + operator docs | ✓ VERIFIED | Endpoint table, explicit no-server-logout statement citing contract, env-var names table, memory posture, run instructions, residual-risk note |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| compose auth-service | compose postgres | `depends_on: condition: service_healthy` | WIRED | docker-compose.yml lines 59-61 |
| auth-service | postgres users DB | `SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/users` | WIRED | compose line 51 → application.yml relaxed binding; Flyway applies on boot (proven in every container run) |
| compose | container env | JWT_SECRET/ISSUER/AUDIENCE/TTL_SECONDS passthrough | WIRED | compose lines 54-57 → application.yml jwt.* properties → JwtConfig/@Value consumers |
| AuthController | UserService | constructor injection, primitive delegation | WIRED | signup/login/me all delegate; no logic in controller beyond mapping |
| SecurityConfig | JwtConfig decoder | `oauth2ResourceServer.jwt(withDefaults())` | WIRED | Bean pulled into filter chain; decode failures hit custom entry point |
| RestAuthenticationEntryPoint | login failure path | shared public constant | WIRED | `AuthController.unauthorized()` reuses `UNAUTHORIZED_ENVELOPE` — anti-drift by construction |
| smoke-auth.sh | transitional :8081 | `BASE=${AUTH_BASE_URL:-http://localhost:8081}` | WIRED | Matches compose port mapping; Phase-7 override path documented |
| GlobalExceptionHandler | unique-index violations | DataIntegrityViolationException → 409 | PARTIAL (wired, transition unexercised) | Handler compiled into advice chain; no test drives a real violation through it — Truth #2 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| GET /auth/me response | User profile | `userRepository.findById(sub)` → PG18 users row | Yes (live query; ghost-subject test proves miss path too) | ✓ FLOWING |
| POST /auth/signup response | UserResponse | persisted entity returned from `userRepository.save()` | Yes | ✓ FLOWING |
| POST /auth/login response | Session(user, accessToken) | `findByEmail` row + NimbusJwtEncoder over env secret | Yes | ✓ FLOWING |
| Smoke script token | accessToken lifted via sed from live login body | Real HTTP response | Yes | ✓ FLOWING |

No static returns, hardcoded literals, or mock-backed production paths found.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Signup contract shape end-to-end (SC-1 core chain) | `./mvnw -q -B test -Dtest='AuthFlowIntegrationTests#validSignupReturns201WithContractUserShape'` | exit 0; context boot + Testcontainers postgres:18.6 + secret-gate log observed | ✓ PASS (verifier-run) |
| Contracts conformance gate | `bash scripts/check-contracts.sh` | exit 0; Spectral clean; topic schemas ok; LF law ok; version manifest complete (21 pins); auth signup/login/getMe operationIds present | ✓ PASS (verifier-run) |
| LF hygiene under repo-law semantics | `git ls-files --eol \| grep i/crlf \| grep -vE '\.(bat\|cmd)$' \| wc -l` | 0 | ✓ PASS (verifier-run) |
| Full suite (unit 4 + integration 16) | surefire reports vs last source commit | 20 run, 0 failures/errors/skipped; reports post-date final commit; working tree clean | ✓ PASS (executor-run, freshness-verified by verifier) |
| Live-stack smoke (signup→dup→login→me→logout-absence) | `bash scripts/smoke-auth.sh` against rebuilt compose stack | ALL PASS 7/7, run twice per summary | ✓ PASS (executor-documented e2e; not re-run — requires live compose stack) |
| Container memory posture | `docker inspect … .HostConfig.Memory` | 536870912 (512m effective) | ✓ PASS (executor-documented) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repo. The phase's declared probe equivalents are `scripts/check-contracts.sh` (re-run by verifier, PASS) and `scripts/smoke-auth.sh` (live-stack gate; executor-documented PASS ×2, freshness-consistent with committed sources). No MISSING_PROBE items.

### Requirements Coverage

REQUIREMENTS.md traceability maps exactly AUTH-01..AUTH-04 to Phase 2 (all marked Complete); no orphaned phase-2 requirements exist.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-02 | Sign up with email/password (unique email enforced, password stored hashed) | ✓ SATISFIED | Truths #1/#2; 4 unit + 4 signup integration tests green; smoke steps 1–2; bcrypt-only storage test against real DB row |
| AUTH-02 | 02-03 | Log in with valid credentials, receive signed JWT | ✓ SATISFIED | Truth #3; claims-decode test, byte-identical anti-enumeration 401s, weak-secret boot abort test; smoke steps 3–4 |
| AUTH-03 | 03 | Authenticated user retrieves own profile via /me | ✓ SATISFIED | Truth #4; seven /me behaviors green (success + six rejections); smoke steps 5–6 |
| AUTH-04 | 04 | Logout as client-side token discard; no server revocation v1 | ✓ SATISFIED | Truth #5; README policy statement + contract citation + runtime absence assertion (smoke step 7 + true-404 regression) |
| SC-5 (roadmap criterion, claimed by plans 01+04) | 01, 04 | Multi-stage build, compose entry w/ healthcheck, standalone curl smoke | ✓ SATISFIED | Truth #6; Dockerfile/compose sources + documented healthy runs + Memory=512Mi inspect + smoke ALL PASS |

Phase-1 carry-over note: prior phase's human_needed items concern contract-sufficiency judgments owned by Phase 1 — deliberately excluded from this verdict.

### Anti-Patterns Found

Debt-marker scan over all phase-touched files: zero TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER hits; zero empty-return/console-log-only implementations. Code-review findings disposition (`.planning/phases/02-auth-service/02-REVIEW.md`, 0 critical / 4 warning / 7 info) — **none defeat a must-have truth; all advisory**:

| File | Finding | Severity | Disposition |
|------|---------|----------|-------------|
| `GlobalExceptionHandler.java` | WR-01: malformed JSON (`HttpMessageNotReadableException`) and unexpected exceptions (e.g. non-UUID `sub` → `IllegalArgumentException`) escape the ApiError envelope | ⚠️ Warning | Advisory hardening. Fail-closed (no access granted); contracted behaviors for well-formed-invalid input are tested and correct. Recommend backlog: add the two handlers + malformed-JSON test |
| `GlobalExceptionHandler.java:49` | WR-02: over-broad DataIntegrityViolation mapping (over-length email → 409 DUPLICATE_EMAIL mislabel) | ⚠️ Warning | Advisory. Edge-case status semantics; duplicates themselves are correctly rejected either way. Fix pairs with WR-01 catch-all |
| `JwtSecretAssertion.java` | WR-03: ApplicationRunner gate runs after Tomcat listens — brief weak-secret serving window before abort | ⚠️ Warning | Advisory. Local-dev-only exposure (:8081 transitional); boot does abort. Move check into bean creation per review fix |
| `SignupRequest.java:16` / `LoginRequest.java:13` | WR-04: unbounded password length; bcrypt 72-byte silent truncation | ⚠️ Warning | Advisory semantics nit; `@Size(min=8, max=72)` quick win |
| `application.yml:28` | IN-01 known dev-default secret | ℹ️ Info | Documented DEV/TEST-only; compose overrides; acceptable v1 |
| `JwtConfig.java` / IN-02 redundant skew validator, dead base64 branch | ℹ️ Info | Harmless duplication; fold into WR-03 fix |
| `RestAuthenticationEntryPoint.java` IN-03 missing WWW-Authenticate header | ℹ️ Info | RFC 6750 nicety; no functional impact locally |
| `V1__create_users.sql:20` IN-04 case-sensitive unique index | ℹ️ Info | Invariant held by app-side Locale.ROOT normalization on all write paths; document or CITEXT later |
| `UserService.java:42` IN-05 PII email in DEBUG log | ℹ️ Info | Wire output safe; minor log-hygiene |
| `maven-wrapper.properties` IN-06 no distribution checksum | ℹ️ Info | Cheap supply-chain hardening when next touched |
| `AuthFlowIntegrationTests.java` IN-07 two missing boundary tests (inclusive-skew positive; case-insensitive login e2e) | ℹ️ Info | Normalization unit-proven; nice-to-have additions |
| Race-backstop translation unexercised (02-02 D5) | ⚠️ Coverage | Promoted to Truth #2 PRESENT_BEHAVIOR_UNVERIFIED → Human Verification #1 |

### Human Verification Required

### 1. Race-backstop duplicate translation produces the contracted 409 (Truth #2)

**Test:** Force a genuine `users_email_uniq` violation past the `findByEmail` pre-check on a running service — e.g., a transactional race harness (hold a transaction holding the pre-check open, commit a conflicting insert from another connection, release the save), or a focused slice test that raises `DataIntegrityViolationException` through `@RestControllerAdvice`.
**Expected:** HTTP 409 with byte-exact body `{"code":"DUPLICATE_EMAIL","message":"An account with this email already exists."}` — identical to the fast-path envelope; never a 500.
**Why human:** The handler and index are provably present and wired, but no automated test drives a real constraint violation through the live path; presence checks cannot confirm the advice engages under Spring's runtime exception translation. Alternatively, accept structurally via an override in this file's frontmatter.

### 2. (Optional) README operator readability skim (plan 02-04 D5 human_judgment)

**Test:** Skim `services/auth-service/README.md` as a new operator.
**Expected:** Endpoint table, logout-policy statement, env-var table, memory posture, and run instructions read coherently.
**Why human:** Documentation tone/clarity is reader judgment; all mechanical content criteria are already verified above.

## Gaps Summary

No gaps. Every roadmap success criterion (SC-1..SC-5) and every mapped requirement (AUTH-01..AUTH-04) is satisfied with behavioral evidence: 19 of 20 suite tests fresh-verified against final HEAD, one core-chain test independently reproduced by this verifier, contracts and LF gates independently re-run green, and the live-stack smoke documented passing twice against rebuilt images with sources unchanged since. The JVM-in-Docker template family (multi-stage build, memory-flag pairing, PG18 root-volume mount, healthcheck chain, smoke-script shape) exists in committed, copy-ready form for Phases 5/7.

The phase is held at **human_needed** solely for one defense-in-depth invariant whose final runtime transition (unique-index violation → contracted 409 through the exception translator) is unexercised by automation — flagged honestly by the executor itself (coverage D5). Zero critical review findings; the four warnings are advisory hardening that do not undermine any must-have.

---

_Verified: 2026-08-25T19:24:59Z_
_Verifier: the agent (gsd-verifier)_
