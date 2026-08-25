# auth-service

Owns identity for the platform: email/password signup, credential exchange for HS256-signed JWT access tokens, and authenticated profile retrieval — backed by PostgreSQL with Flyway-managed schema (the JVM service template every later Java service copies).

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/signup` | public | Register a new account → `201` User JSON; `409 DUPLICATE_EMAIL` when the address is already registered |
| POST | `/auth/login` | public | Exchange valid credentials for an HS256 access token + user object; uniform `401 UNAUTHORIZED` on wrong password or unknown email |
| GET | `/auth/me` | bearer token | Return the authenticated user's profile (identity derives exclusively from the verified JWT `sub` claim); `401` when the token is missing/expired/invalid |

**No logout endpoint exists — by frozen contract (D-03).** Logout in v1 is client-side token discard: the client drops the token and it simply stops being presented; there is no server session-invalidation route and no revocation registry. This policy is stated normatively in the contract's `info.description` (`docs/api-contracts/auth-service.openapi.yaml`, "Logout (decision D-03)" paragraph): *there is NO logout endpoint … no endpoint will be added without an explicit contract change.* The standalone smoke script (`scripts/smoke-auth.sh`, step 7) enforces this absence at runtime by asserting the route answers 404/405.

## Consumed environment variables

Values are supplied via `.env` (copied from `.env.example`) and wired through `docker-compose.yml`. Variable NAMES are contractual — never rename or repurpose.

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Base64 CSPRNG signing secret shared only with api-gateway (Phase 7); decoded length ≥ 32 bytes asserted at startup, otherwise boot aborts |
| `JWT_ISSUER` | Token issuer claim (`iss`) this service emits and validates |
| `JWT_AUDIENCE` | Token audience claim (`aud`) this service emits and validates |
| `JWT_TTL_SECONDS` | Access-token lifetime in seconds (contract: 3600) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Credentials for the shared PostgreSQL 18 container (users database) |
| `SPRING_DATASOURCE_URL` | JDBC URL bound to the users database (`jdbc:postgresql://postgres:5432/users` in compose) |

## Memory posture

The container runs with `-XX:MaxRAMPercentage=75` baked into the image **paired** with a compose-level `mem_limit: 512m` (D-03). The flag tells the JVM how much of its cgroup budget it may claim; the limit makes the budget real. All later JVM services copy this pairing.

## Running

### Tests

```bash
cd services/auth-service
./mvnw test
```

Docker must be running: the integration slice boots against an ephemeral Testcontainers `postgres:18`. No local Maven install needed (wrapper committed).

### Smoke test against the live stack

```bash
docker compose up -d --build   # rebuild so the image carries current source
# wait for http://localhost:8081/actuator/health to report UP
bash scripts/smoke-auth.sh     # ALL PASS = signup/duplicate/login/me/logout-absence verified live
```

Defaults to the transitional direct port `http://localhost:8081`; override with `AUTH_BASE_URL=<url>` (e.g. once the Phase 7 gateway serves `/auth`). Exit code 0 means every step passed; any failure exits non-zero with a labeled step.

## Residual risks

- **Credential stuffing:** login throttling/rate limiting is deliberately deferred to the api-gateway (Phase 7 rate-limiting work, GTWY-05). Until then, repeated login attempts are not throttled at the service level.
