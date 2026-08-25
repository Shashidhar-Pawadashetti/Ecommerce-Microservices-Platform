---
phase: 02-auth-service
plan: 03
subsystem: auth
tags: [spring-security-6.5, nimbus-jwt, hs256, resource-server, anti-enumeration, testcontainers]

# Dependency graph
requires:
  - phase: 02-auth-service
    plan: 02
    provides: signup vertical seams — UserService.signup slice, AuthController skeleton, BCryptPasswordEncoder(12) bean, ApiError envelope + GlobalExceptionHandler, AuthFlowIntegrationTests Testcontainers slice (surefire UTC pin)
provides:
  - HS256 token plane: JwtConfig NimbusJwtEncoder bean + MAC-restricted NimbusJwtDecoder with ±60s-skew/issuer/audience validator chain (T-02-01 mitigation)
  - POST /auth/login → 200 AccessTokenPair with canonical claims (sub/email/roles/iss/aud/exp-iat=3600) or byte-identical 401 UNAUTHORIZED envelopes for wrong-password AND unknown-email (dummy-hash equal-cost compare, T-02-02)
  - JwtSecretAssertion ApplicationRunner — boot aborts below 32 decoded bytes; logs length only (T-02-04/T-02-05)
  - GET /auth/me behind finalized stateless chain — identity exclusively from verified sub; seven behaviors green incl foreign-signed, expired+61s skew boundary, RS256 swap, alg=none (AUTH-03)
  - RestAuthenticationEntryPoint single-source 401 envelope shared by filter-chain and controller failure paths
affects: [02-04 smoke script (login/me curls assert these exact envelopes live; logout-absence probe), phase-07 api-gateway (verifies these tokens with same secret/claims law)]

actuals:
  tokens: 12773
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - Spring Security 6.5 modern JWT API: JwsHeader.with(MacAlgorithm.HS256) over nimbus OctetSequenceKey (research-era JWSHeader/OctetSequenceJWK shapes do not exist in this dependency set)
    - Custom AuthenticationEntryPoint rides the oauth2ResourceServer customizer — BearerTokenAuthenticationFilter invokes it directly, bypassing generic exceptionHandling wiring
    - Anti-enumeration posture: instance-generated dummy bcrypt hash burned on unknown-email logins equalizes cost; both failure modes render ONE shared envelope constant
    - Weak-secret boot test via SpringApplicationBuilder.run(command-line args) — args outrank application.yml defaults (.properties() sets defaults that lose)

key-files:
  created:
    - services/auth-service/src/main/java/com/ecommerce/auth/config/JwtConfig.java
    - services/auth-service/src/main/java/com/ecommerce/auth/config/JwtSecretAssertion.java
    - services/auth-service/src/main/java/com/ecommerce/auth/security/RestAuthenticationEntryPoint.java
    - services/auth-service/src/main/java/com/ecommerce/auth/web/dto/LoginRequest.java
    - services/auth-service/src/main/java/com/ecommerce/auth/web/dto/AccessTokenPairResponse.java
  modified:
    - services/auth-service/src/main/resources/application.yml
    - services/auth-service/src/main/java/com/ecommerce/auth/user/UserService.java
    - services/auth-service/src/main/java/com/ecommerce/auth/web/AuthController.java
    - services/auth-service/src/main/java/com/ecommerce/auth/config/SecurityConfig.java
    - services/auth-service/src/test/java/com/ecommerce/auth/web/AuthFlowIntegrationTests.java
    - services/auth-service/src/test/java/com/ecommerce/auth/user/UserServiceTests.java

key-decisions:
  - "Spring Security 6.5 modern JWT API adopted after javap ground-truthing the resolved jars: JwsHeader.with(MacAlgorithm.HS256), OctetSequenceKey.Builder, validators in org.springframework.security.oauth2.core"
  - "Entry point wired on oauth2ResourceServer customizer, not exceptionHandling — decode-failure 401s would otherwise carry empty bodies (caught by the garbage/expired/foreign-signed tests)"
  - "application.yml dev/test-only default jwt.secret (37 decoded bytes): host-driven test JVMs boot without env setup; compose always overrides via JWT_SECRET passthrough; JwtSecretAssertion enforces >=32 bytes either way"
  - "UserService constructor grew JWT deps (encoder/issuer/audience/ttl); unit slice constructs a real NimbusJwtEncoder over a local test secret so issueToken stays exercisable without Spring"

patterns-established:
  - "Token-crafting test recipe: injected JwtEncoder for expired/ghost-subject tokens, locally-built NimbusJwtEncoder for foreign-signed, raw nimbus RSASSASigner/PlainJWT for alg-swap and unsigned variants"
  - "Byte-exact 401 law: RestAuthenticationEntryPoint.UNAUTHORIZED_ENVELOPE is the single source both the filter chain and controller failure paths reuse"

requirements-completed: [AUTH-02, AUTH-03]

coverage:
  - id: D1
    description: "HS256 issuance with canonical claims (AUTH-02): three-segment token, sub=user-id string, iss=ecommerce-auth, aud carries ecommerce-api, exp-iat=3600"
    requirement: AUTH-02
    verification:
      - kind: tests
        ref: "tests/com.ecommerce.auth.web.AuthFlowIntegrationTests#loginReturnsThreeSegmentHs256TokenWithCanonicalClaims (Base64 URL payload decode in-test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Anti-enumeration uniform failures (AUTH-02/T-02-02): wrong-password and unknown-email return byte-identical 401 bodies matching _shared.yaml example"
    requirement: AUTH-02
    verification:
      - kind: tests
        ref: "tests/AuthFlowIntegrationTests#wrongPasswordAndUnknownEmailReturnByteIdentical401Envelopes (full-body string equality)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Weak-secret fail-fast startup (T-02-04): sub-32-byte decoded secret aborts boot with IllegalStateException from JwtSecretAssertion"
    requirement: AUTH-02
    verification:
      - kind: tests
        ref: "tests/AuthFlowIntegrationTests#weakSecretRefusesBootViaStartupAssertion (13-byte secret boots a full second context against the ephemeral PG)"
        status: pass
    human_judgment: false
  - id: D4
    description: "/me returns the SAME user object as login (AUTH-03): fresh bearer token -> 200 with identical id/email/roles/createdAt"
    requirement: AUTH-03
    verification:
      - kind: tests
        ref: "tests/AuthFlowIntegrationTests#meWithFreshBearerTokenReturnsSameUserShapeAsLogin"
        status: pass
    human_judgment: false
  - id: D5
    description: "Strict validation collapse (AUTH-03/T-02-01): missing header, garbage bearer, foreign-signed, expired+61s-past-skew, RS256 swap, alg=none, and valid-token-with-ghost-subject ALL answer the one UNAUTHORIZED envelope"
    requirement: AUTH-03
    verification:
      - kind: tests
        ref: "tests/AuthFlowIntegrationTests#meWithoutAuthorizationHeaderReturnsExact401Envelope + meWithGarbageBearer… + meWithForeignSignedTokenReturns401 + meWithExpiredToken61SecondsPastSkewReturns401 + meWithNonHs256OrUnsignedTokenReturns401 + meWithTokenWhoseSubjectHasNoUserRowReturns401Not404"
        status: pass
    human_judgment: false
  - id: D6
    description: "Timing-profile symmetry of the unknown-email dummy-hash compare (Pitfall 4 posture)"
    requirement: AUTH-02
    verification: []
    human_judgment: true
    rationale: "Equal cost is guaranteed by construction (one bcrypt cost-12 operation either way) but no automated timing assertion exists; verifier can sample response latencies of the two failure modes against a loaded box if desired"

duration: 28min
completed: 2026-08-25
status: complete
---

# Phase 2 Plan 3: JWT Token Plane & Authenticated Profile Summary

**HS256 login issuing canonically-claimed access tokens with byte-identical anti-enumeration 401s, plus GET /auth/me behind a hardened stateless chain rejecting every malformed/foreign/expired/algo-swapped token into one shared envelope — proven by a 19-test suite on Testcontainers postgres:18**

## Performance

- **Duration:** 28 min
- **Started:** 2026-08-25T17:49:29Z
- **Completed:** 2026-08-25T18:17:59Z
- **Tasks:** 2 (each RED→GREEN)
- **Files modified:** 11

## Accomplishments

- `POST /auth/login` exchanges credentials for a three-segment HS256 token whose decoded payload matches the json-interop canonical table exactly — `sub` = user-id string, `iss` = `ecommerce-auth`, `aud` carrying `ecommerce-api`, `exp − iat = 3600`, algorithm pinned in the JOSE header (A1/Pitfall 2 guard)
- Anti-enumeration proven at the wire level: wrong-password and unknown-email responses are **byte-identical full JSON strings**, equal also to the `_shared.yaml` Unauthorized example; unknown accounts burn an equal-cost bcrypt compare through an instance-generated dummy hash
- Weak secrets cannot boot: a 13-byte decoded secret aborts a full context start with `IllegalStateException("jwt.secret too short: 13 bytes decoded; minimum 32")`; normal boots log the secret's LENGTH only
- `GET /auth/me` returns the same user object as login, deriving identity EXCLUSIVELY from the verified `sub` claim (`Authentication#getName()` → UUID → server-side lookup)
- Seven `/me` rejection behaviors all collapse into one envelope: missing header, garbage bearer, foreign-signed (different secret), correctly-signed-but-expired-61s (±60s skew boundary proof), RS256 algorithm swap, unsigned `alg=none`, and valid-token-whose-subject-has-no-row (401 not 404 — contract exposes no 404)
- Decoder is MAC-restricted by construction (`withSecretKey`) plus explicit skew/issuer/audience validators — no algorithm negotiation surface survives (T-02-01)
- Full plan verification green: `./mvnw test` 19/19, `scripts/check-contracts.sh` pass (signup/login/getMe operationIds intact), zero new env var names

## Task Commits

Each task followed the RED→GREEN TDD flow:

1. **Task 1 (Login issuance + anti-enumeration):** `0528819` (test RED) → `f8de8ca` (feat GREEN)
   JwtConfig encoder/decoder beans, JwtSecretAssertion, RestAuthenticationEntryPoint, LoginRequest/AccessTokenPairResponse DTOs, UserService.login/issueToken, /auth/login endpoint
2. **Task 2 (/me + hardened chain):** `ebe719f` (test RED) → `be02220` (feat GREEN)
   SecurityConfig finalization (three permitAll matchers, authenticated /auth/**, denyAll default, entry point on resource-server customizer), AuthController.getMe, UserService.profileOf

## Files Created/Modified

- `config/JwtConfig.java` — NimbusJwtEncoder over OctetSequenceJWK-set + NimbusJwtDecoder(withSecretKey) carrying DelegatingOAuth2TokenValidator(skew 60s, default-with-issuer, audience-contains)
- `config/JwtSecretAssertion.java` — ApplicationRunner fail-fast; base64 decode, ≥32 bytes or IllegalStateException; logs length only
- `security/RestAuthenticationEntryPoint.java` — writes exact `_shared.yaml` 401 envelope; public constant reused by the controller failure path
- `web/dto/LoginRequest.java` · `web/dto/AccessTokenPairResponse.java` — contract-mirror records (public per Wave-2 cross-package lesson)
- `user/UserService.java` — login(email,password)→Optional<Session> with dummy-hash equal-cost path; issueToken pins HS256 JwsHeader with issuer/aud/iat/exp/sub/email/roles; profileOf(UUID)→Optional<User>
- `web/AuthController.java` — @PostMapping("/auth/login") + @GetMapping("/auth/me"); shared unauthorized() helper; still NO logout mapping (frozen D-03)
- `config/SecurityConfig.java` — finalized stateless chain: CSRF off, STATELESS, permitAll(exactly signup/login/health), "/auth/**" authenticated, anyRequest().denyAll(), oauth2ResourceServer jwt(withDefaults()) + custom entry point
- `application.yml` — jwt.secret/issuer/audience/ttl-seconds bound from contractual JWT_* env names with a documented dev-only default secret
- `AuthFlowIntegrationTests.java` — +10 methods: login trio, weak-secret boot, seven /me behaviors; token crafting via injected encoder, local NimbusJwtEncoder, raw RSASSASigner/PlainJWT
- `UserServiceTests.java` — constructor arity update feeding a real test-secret encoder (Rule 3)

## Decisions Made

- **Spring Security 6.5 API ground-truthing** (Rule 3): research Pattern 1's `OctetSequenceJWK`/nimbus-`JWSHeader` shapes do not exist in the resolved Boot 3.5.16 dependency set (nimbus-jose-jwt 9.37.4, spring-security-oauth2-jose 6.5.11). Verified actual signatures via `javap` against the jars: `OctetSequenceKey.Builder(byte[])`, Spring's own `JwsHeader.with(MacAlgorithm.HS256)`, validators living in `org.springframework.security.oauth2.core`. Same intent, correct types.
- **Entry point rides oauth2ResourceServer** (Rule 1): `exceptionHandling().authenticationEntryPoint(...)` alone produced EMPTY-BODY 401s for decode failures — `BearerTokenAuthenticationFilter` invokes the resource-server-level entry point directly, bypassing the generic translation path. Wired `.authenticationEntryPoint(entryPoint)` inside the oauth2ResourceServer customizer; the four crafted-token tests now assert the full envelope body.
- **Dev-default jwt.secret in application.yml**: host-driven test JVMs don't load `.env`, and `${JWT_SECRET}` without a default fails placeholder resolution. A documented 37-byte dev-only default keeps `./mvnw test` self-sufficient; compose always overrides via the JWT_SECRET passthrough and JwtSecretAssertion enforces the ≥32-byte law regardless.
- **aud claim normalization**: RFC 7519 allows string-or-array audiences; the decoder validator accepts both while the issued token emits `["ecommerce-api"]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Research-pattern JWT classes absent from resolved dependencies**
- **Found during:** Task 1 GREEN compile
- **Issue:** `com.nimbusds.jose.jwk.OctetSequenceJWK`, nimbus `JWSHeader` in `JwtEncoderParameters.from(...)`, and `oauth2.jwt.OAuth2TokenValidator` imports do not exist in spring-security-oauth2-jose 6.5.11 / nimbus 9.37.4
- **Fix:** javap-verified replacements — `OctetSequenceKey.Builder`, `JwsHeader.with(MacAlgorithm.HS256)`, `org.springframework.security.oauth2.core.{OAuth2TokenValidator,DelegatingOAuth2TokenValidator}`
- **Files modified:** JwtConfig.java, UserService.java, UserServiceTests.java
- **Verification:** compile clean; claims assertions green
- **Commit:** f8de8ca

**2. [Rule 1 - Bug] Resource-server rejections returned empty 401 bodies**
- **Found during:** Task 2 GREEN run
- **Issue:** generic `exceptionHandling` entry point never sees BearerTokenAuthenticationFilter decode failures, so garbage/expired/foreign-signed requests got bare 401s
- **Fix:** custom entry point set on the oauth2ResourceServer customizer itself
- **Files modified:** SecurityConfig.java
- **Verification:** four crafted-token tests assert exact envelope bytes
- **Commit:** be02220

**3. [Rule 3 - Blocking] Unit slice broke on UserService constructor growth**
- **Found during:** Task 1 GREEN compile
- **Issue:** UserServiceTests constructed the old 2-arg UserService; new JWT deps made it uncompilable (file outside declared files_modified)
- **Fix:** minimal setup update constructing a real NimbusJwtEncoder over a local test secret
- **Files modified:** services/auth-service/src/test/java/com/ecommerce/auth/user/UserServiceTests.java
- **Verification:** unit slice 4/4 green
- **Commit:** f8de8ca

**4. [Rule 3 - Sequencing] /auth/login permitAll landed in Task 1**
- **Found during:** Task 1 RED diagnosis
- **Issue:** plan lists SecurityConfig under Task 2 only, but Task 1's login behavior is unreachable while denyAll holds
- **Fix:** added "/auth/login" beside "/auth/signup" permitAll during Task 1; Task 2 then finalized the chain in place
- **Files modified:** SecurityConfig.java
- **Verification:** login trio green before Task 2 began
- **Commit:** f8de8ca

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 bug, 1 sequencing).
**Impact on plan:** None on contracts or behaviors — every fix aligns implementation with the frozen contract; flagged assumption A1 (explicit HS256 header) implemented and falsified-safe by the first login test.

## Issues Encountered

- First RED batch contained a `ListAssert.contains(String)` generics-capture compile artifact; fixed before committing RED so the gate failed purely behaviorally. (Test-authoring detail, not a production deviation.)
- `SpringApplicationBuilder.properties()` sets DEFAULT properties that lose to application.yml — the weak-secret boot test originally connected to localhost:5432. Switched to command-line `run("--spring.datasource.url=…")` args which outrank YAML.
- The `aud` claim omission in the first issueToken draft was caught by the RED-derived claims test (canonical table requires it) and fixed pre-commit — TDD working as designed.

## Authentication Gates

None — no external credentials required. Docker daemon already running (29.4.0) for the Testcontainers slices.

## Known Stubs

None — every component fully wired: real encoder/decoder beans, real repository lookups, real filter chain; no placeholders, TODOs, or unwired paths.

## Next Phase Readiness

- Ready for Plan 02-04 (Docker/smoke layer): smoke-auth.sh can assert the exact login/me envelopes proven here byte-for-byte, plus the logout-absence probe (route answers 404/405 — controller defines no such mapping)
- AUTH-01..03 now all covered by the green integration suite; AUTH-04 lands with the Plan 02-04 README statement + smoke assertion
- Gateway (Phase 7) will verify these tokens with the same secret/claims law — claim fidelity locked by tests, not convention
- Copy-ready patterns for order-service (Phase 5): Testcontainers UTC slice, token-crafting recipes, envelope-single-source discipline

---
*Phase: 02-auth-service*
*Completed: 2026-08-25*

## Self-Check: PASSED

All 5 created files exist on disk; all 4 task commits (0528819, f8de8ca, ebe719f, be02220) present in git log. Plan-level verification re-run this session: `./mvnw test` 19/19 green (unit slice + Testcontainers integration covering AUTH-01/02/03), `scripts/check-contracts.sh` pass, no new env var names in application.yml.

