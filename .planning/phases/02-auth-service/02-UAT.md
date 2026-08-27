---
status: complete
phase: 02-auth-service
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-08-27T15:55:00Z
updated: 2026-08-27T15:58:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: From a clean state, `docker compose up -d --build` brings up postgres:18 and auth-service. Flyway V1 migration applies (users + flyway_schema_history tables), and GET http://localhost:8081/actuator/health returns 200 with status "UP". No startup errors; the stack is healthy end-to-end.
result: pass

### 2. Signup returns 201 with full User shape
expected: POST /auth/signup with a valid email + password (>=8 chars) returns 201. Body is a User JSON: id is a string UUID, email is lowercased, roles is ["customer"], createdAt matches millisecond-UTC format (e.g. 2026-08-27T...Z).
result: pass

### 3. Duplicate signup returns 409 DUPLICATE_EMAIL
expected: Re-submitting the same email (even with different casing) returns 409 with the exact ApiError envelope {code:"DUPLICATE_EMAIL", message:...}. Also: if a row is inserted directly then signup retried, the unique-index backstop still yields the identical 409 (never a 500).
result: pass

### 4. Invalid signup returns 400 VALIDATION_FAILED
expected: A malformed email or a password shorter than 8 chars returns 400 with the exact ApiError envelope {code:"VALIDATION_FAILED", message:...}, byte-matching the contracted example.
result: pass

### 5. Valid login returns 200 with HS256 access token
expected: POST /auth/login with correct credentials returns 200 with an accessToken (three-segment JWT). Decoded payload has sub=user-id string, iss="ecommerce-auth", aud containing "ecommerce-api", and exp-iat=3600.
result: pass

### 6. Login failure is uniform 401 (anti-enumeration)
expected: Wrong password AND unknown email both return byte-identical 401 UNAUTHORIZED envelopes (same full JSON body), so an attacker cannot distinguish whether an account exists.
result: pass

### 7. Authenticated /auth/me returns the profile
expected: GET /auth/me with a valid bearer token returns 200 with the same user object as login (id/email/roles/createdAt identical).
result: pass

### 8. Unauthenticated /auth/me returns 401
expected: GET /auth/me with no token, a garbage bearer, a foreign-signed token, an expired token (past the 60s skew), an RS256-swapped token, alg=none, or a valid token whose subject has no DB row ALL return the one shared 401 UNAUTHORIZED envelope (never 404).
result: pass

### 9. No logout endpoint exists (client-side logout only)
expected: POST /auth/logout with a valid bearer token returns 404. There is no server session-invalidation route — logout is client-side token discard per the contract.
result: pass

### 10. README documents the no-server-logout policy
expected: services/auth-service/README.md clearly states that no logout endpoint exists (client-side token discard), references the contract, and is readable for a new operator/contributor.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
