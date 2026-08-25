---
phase: 02-auth-service
reviewed: 2026-08-25T19:11:08Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - docker-compose.yml
  - scripts/smoke-auth.sh
  - services/auth-service/.mvn/wrapper/maven-wrapper.properties
  - services/auth-service/Dockerfile
  - services/auth-service/README.md
  - services/auth-service/mvnw
  - services/auth-service/mvnw.cmd
  - services/auth-service/pom.xml
  - services/auth-service/src/main/java/com/ecommerce/auth/AuthServiceApplication.java
  - services/auth-service/src/main/java/com/ecommerce/auth/config/JwtConfig.java
  - services/auth-service/src/main/java/com/ecommerce/auth/config/JwtSecretAssertion.java
  - services/auth-service/src/main/java/com/ecommerce/auth/config/SecurityConfig.java
  - services/auth-service/src/main/java/com/ecommerce/auth/security/RestAuthenticationEntryPoint.java
  - services/auth-service/src/main/java/com/ecommerce/auth/support/ApiError.java
  - services/auth-service/src/main/java/com/ecommerce/auth/user/User.java
  - services/auth-service/src/main/java/com/ecommerce/auth/user/UserRepository.java
  - services/auth-service/src/main/java/com/ecommerce/auth/user/UserService.java
  - services/auth-service/src/main/java/com/ecommerce/auth/web/AuthController.java
  - services/auth-service/src/main/java/com/ecommerce/auth/web/GlobalExceptionHandler.java
  - services/auth-service/src/main/java/com/ecommerce/auth/web/dto/AccessTokenPairResponse.java
  - services/auth-service/src/main/java/com/ecommerce/auth/web/dto/LoginRequest.java
  - services/auth-service/src/main/java/com/ecommerce/auth/web/dto/SignupRequest.java
  - services/auth-service/src/main/java/com/ecommerce/auth/web/dto/UserResponse.java
  - services/auth-service/src/main/resources/application.yml
  - services/auth-service/src/main/resources/db/migration/V1__create_users.sql
  - services/auth-service/src/test/java/com/ecommerce/auth/user/UserServiceTests.java
  - services/auth-service/src/test/java/com/ecommerce/auth/web/AuthFlowIntegrationTests.java
findings:
  critical: 0
  warning: 4
  info: 7
  total: 11
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-25T19:11:08Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed all Phase 2 auth-service sources at standard depth, cross-referenced against `docs/api-contracts/_shared.yaml`, `docs/api-contracts/auth-service.openapi.yaml`, `.env.example`, and `.gitattributes` (verified: `.env` is gitignored; `smoke-auth.sh`/`mvnw` are LF in both index and worktree; the three error-envelope strings byte-match the shared contract).

The security core is genuinely solid: the JWT decoder is MAC-restricted (`withSecretKey`) so alg-swap/`none` attacks collapse before claim parsing (proven by tests), iss/aud/expiry are all validated with ±60s skew, the secret gate enforces ≥32 decoded bytes, login is anti-enumerated via equal-cost dummy bcrypt compares with byte-identical envelopes, passwords are stored only as bcrypt(12) hashes, DTOs are two-field records that make mass assignment impossible, and persistence is injection-safe derived queries behind a Flyway unique index backstop. No critical defects were provable.

Four warnings remain, all in robustness/consistency territory: two gaps in exception coverage that let non-contract response bodies escape the unified `ApiError` envelope, an over-broad integrity-violation mapping that can mislabel a too-long email as `409 DUPLICATE_EMAIL`, and a fail-fast ordering gap where the HTTP port opens before the JWT secret gate runs.

## Critical Issues

None found. The JWT plane, credential handling, filter chain, and persistence surface survived adversarial review without a provable blocker.

## Warnings

### WR-01: Incomplete exception coverage lets non-envelope bodies escape the unified ApiError contract

**File:** `services/auth-service/src/main/java/com/ecommerce/auth/web/GlobalExceptionHandler.java:20-59` (also `AuthController.java:74`)
**Issue:** The handler covers only `MethodArgumentNotValidException`, `DuplicateEmailException`, and `DataIntegrityViolationException`. Two reachable paths fall through to Boot's default `/error` rendering, which emits Boot's own JSON shape (`timestamp`/`status`/`error`/`path`) — violating the "clients branch on the machine-readable code" envelope law the class itself documents:

1. **Malformed JSON body** → `HttpMessageNotReadableException` has no handler. `POST /auth/signup` with `{invalid` returns a 400 whose body is not `{"code":"VALIDATION_FAILED",...}`. No test covers this (the integration suite only sends well-formed-but-invalid JSON).
2. **Unexpected exceptions** → no catch-all. Concrete instance: `AuthController.java:74` calls `UUID.fromString(authentication.getName())`; any validly-signed token whose `sub` is not a UUID crashes with a raw `IllegalArgumentException` → Boot-default 500 body leaking framework internals on the wire.

**Fix:**
```java
@ExceptionHandler(HttpMessageNotReadableException.class)
ResponseEntity<ApiError> unreadableBody(HttpMessageNotReadableException ignored) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ApiError("VALIDATION_FAILED",
                    "Request validation failed. Check field formats and limits."));
}

@ExceptionHandler(Exception.class) // last-resort: keep the wire shape contractual
ResponseEntity<ApiError> unexpected(Exception ex) {
    log.error("Unhandled failure suppressed from wire", ex);
    return ResponseEntity.internalServerError()
            .body(new ApiError("INTERNAL_ERROR", "Unexpected server error."));
}
```
Additionally guard `/me`: catch `IllegalArgumentException` around `UUID.fromString` (or resolve the subject defensively) so a malformed-but-validly-signed subject yields the shared 401 envelope instead of a crash. Add a malformed-JSON integration test asserting the exact `VALIDATION_FAILED` byte-match.

### WR-02: Over-broad DataIntegrityViolationException mapping mislabels non-duplicate integrity failures as 409 DUPLICATE_EMAIL

**File:** `services/auth-service/src/main/java/com/ecommerce/auth/web/GlobalExceptionHandler.java:49-53` (with `SignupRequest.java:15`, `V1__create_users.sql:14-15`)
**Issue:** Every `DataIntegrityViolationException` is translated to `409 DUPLICATE_EMAIL`, but that exception covers *all* integrity violations — not just `users_email_uniq`. Provable repro: bean validation imposes **no maximum length on email**, so a syntactically valid 300-character email passes `@Email`, reaches insert, and PostgreSQL raises `value too long for varying character varying(255)` on `users.email` (`V1__create_users.sql:14`) → client receives `409 DUPLICATE_EMAIL` ("account already exists") when nothing is duplicated. Wrong status semantics on contracted endpoints.

**Fix:** Constrain at the boundary and narrow at the translator:
```java
// SignupRequest / LoginRequest
@NotBlank @Email @Size(max = 255) String email,
```
and in the handler, only map to `DUPLICATE_EMAIL` when the cause chain names the `users_email_uniq` constraint; otherwise fall through to the generic 500 path (WR-01 fix). With both in place, the race backstop stays correct while other integrity errors stop masquerading as conflicts.

### WR-03: Secret gate runs after the web server is already listening — brief weak-secret serving window

**File:** `services/auth-service/src/main/java/com/ecommerce/auth/config/JwtSecretAssertion.java:29-43`
**Issue:** The ≥32-byte gate is an `ApplicationRunner`, which executes *after* context refresh completes — but Spring Boot's embedded Tomcat starts accepting connections during `finishRefresh()`, before runners run. In compose, `8081:8081` is published immediately, so there is a real (if brief) window where the service signs and verifies tokens with an under-strength or placeholder secret before aborting boot. This contradicts the documented "refuses boot" fail-fast posture; the check should complete before the port opens.

**Fix:** Move the assertion into bean creation, which happens during refresh *before* the server starts — e.g., perform the decode+length check inside `JwtConfig.jwtEncoder(...)`/`jwtDecoder(...)` (or a dedicated `@Bean` that both depend on), throwing `IllegalStateException` there. `JwtSecretAssertion` then becomes either unnecessary or a logging-only post-step. Keep the existing test — it already asserts boot aborts with the friendly message.

### WR-04: Password accepts unbounded length; bcrypt silently truncates beyond 72 bytes

**File:** `services/auth-service/src/main/java/com/ecommerce/auth/web/dto/SignupRequest.java:16` (same in `LoginRequest.java:13`)
**Issue:** `@Size(min = 8)` has no maximum. Spring Security's BCrypt hashes only the first **72 bytes** and silently ignores the rest, so two distinct passwords sharing a 72-byte prefix authenticate identically — a credential-semantics surprise on an auth surface, and it leaves request bodies unbounded on the most abuse-attractive endpoint. Cost per hash is constant (so this is semantics, not DoS).

**Fix:**
```java
@NotBlank @Size(min = 8, max = 72) String password)
```
This makes validation honest about what bcrypt will actually protect and bounds the body size. (Longer-passphrase schemes like pre-hash would be a contract change — out of scope v1.)

## Info

### IN-01: Known dev signing secret committed as application.yml default

**File:** `services/auth-service/src/main/resources/application.yml:28`
**Issue:** `${JWT_SECRET:bG9jYWwtZGV2LW9ubHktc2lnbmluZy1zZWNyZXQtMzJieXRlcw==}` boots host-driven runs with a publicly-known key (documented DEV/TEST-only; compose always overrides; the length gate passes it). Acceptable for local-only v1, but it must never survive into anything network-exposed.
**Fix:** Keep as-is with the existing comment; optionally log a loud warning when the default value (compare against the known constant) is active rather than env-supplied.

### IN-02: Redundant timestamp validator + effectively unreachable invalid-base64 branch

**Files:** `JwtConfig.java:66-67`, `JwtSecretAssertion.java:33-36`
**Issue:** (a) `JwtValidators.createDefaultWithIssuer(issuer)` already embeds a default ±60s `JwtTimestampValidator`; the explicit `skew` validator duplicates it (harmless, but misleading to readers about which skew wins). (b) If `jwt.secret` is invalid base64, both JWT beans decode eagerly at construction and abort with a raw `BeanCreationException` first — the assertion's "not valid base64" branch is dead in practice.
**Fix:** Drop the separate `skew` validator and rely on the default inside `createDefaultWithIssuer` (comment the ±60s choice), or build the chain explicitly from primitives. Fold base64 validation into the same pre-listen location as the WR-03 fix.

### IN-03: 401 responses omit the RFC 6750 WWW-Authenticate header

**File:** `RestAuthenticationEntryPoint.java:43-46`
**Issue:** `HTTP/1.1 401` without `WWW-Authenticate: Bearer` is incomplete per RFC 6750 §3.1; some clients/gateways use it to distinguish auth challenges.
**Fix:** `response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");` before writing the envelope (constant value preserves the anti-oracle posture).

### IN-04: Email uniqueness invariant enforced app-side only; DB index is case-sensitive

**File:** `V1__create_users.sql:20`
**Issue:** Uniqueness holds because every write path lowercases with `Locale.ROOT`, but `UNIQUE INDEX users_email_uniq ON users (email)` is case-sensitive — any future non-app writer (migration backfill, support script, second service) could create `A@x.com` alongside `a@x.com`, silently breaking login normalization assumptions.
**Fix:** When schema evolution next touches this table, consider `CREATE UNIQUE INDEX ... ON users (lower(email))` or CITEXT; until then, document the invariant next to the index.

### IN-05: PII email embedded in DuplicateEmailException message and logged at DEBUG

**Files:** `UserService.java:42-44`, `GlobalExceptionHandler.java:39`
**Issue:** Wire output is safe (fixed envelope), but `ex.getMessage()` carries the registrant's email into logs at DEBUG level — minor log-hygiene/PII nit for a service whose docs are strict about what diagnostics may carry.
**Fix:** Log a fixed string ("signup rejected: duplicate email") without the address, or drop the message argument entirely.

### IN-06: Maven distribution download lacks pinned checksum

**File:** `services/auth-service/.mvn/wrapper/maven-wrapper.properties:17-19`
**Issue:** No `distributionSha256Sum`; wrapper download integrity rests on TLS alone. Both `mvnw` and `mvnw.cmd` already implement full checksum validation — the property just isn't set.
**Fix:** Add `distributionSha256Sum=<sha256 of apache-maven-3.9.12-bin.zip>` (published on the Maven download page) to close the supply-chain gap cheaply.

### IN-07: Test coverage gaps at two boundaries

**File:** `AuthFlowIntegrationTests.java:319-341` (and login tests generally)
**Issue:** Strong suite overall (byte-match envelopes, foreign-signature, RS256/none rejection, ghost-subject, true-404 proof). Missing: (a) the *positive* side of the clock-skew boundary — a token expired ~30s ago must still verify, pinning that the 60s window is inclusive, not merely that 61s fails; (b) end-to-end login case-normalization (signup `Alice@X.com`, login `ALICE@x.com` → 200) — normalization is unit-proven for signup only.
**Fix:** Two small tests mirroring `meWithExpiredToken61SecondsPastSkewReturns401` with `expiresAt(now.minusSeconds(30))` expecting 200, and an uppercase-email login variant of `wrongPasswordAndUnknownEmailReturnByteIdentical401Envelopes`.

---

_Reviewed: 2026-08-25T19:11:08Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
