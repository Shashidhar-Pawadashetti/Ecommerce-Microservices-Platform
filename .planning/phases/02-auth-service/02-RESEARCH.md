# Phase 02: Auth Service — Research

**Researched:** 2026-08-25
**Domain:** Spring Boot 3.5 auth service (signup/login/JWT//me on PostgreSQL) + first JVM-in-Docker proof (multi-stage build, memory posture, healthcheck, curl smoke test)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Docker Compose & Runtime Scope**
- **D-01:** Phase 2 adds ONLY `postgres:18` + `auth-service` to docker-compose.yml. The stale Phase 1 header comment ("Phase 2 adds shared infrastructure") is corrected to state the incremental-growth policy: Mongo joins in Phase 3, Redis in Phase 4, Kafka in Phase 5, Mailpit in Phase 6 — each datastore/broker arrives with its first consuming service. Roadmap reframe wins over build-plan §4.
- **D-02:** ONE Postgres container hosting two databases: `users` created now; `orders` database added by order-service in Phase 5. Fewer containers/RAM on dev machines, single volume to reset.
- **D-03:** JVM memory posture: `-XX:MaxRAMPercentage=75` in the Dockerfile plus a `mem_limit` on the compose entry. This is the flag pattern all JVM services copy (ORCH-02 OOMKill concern).

**Persistence**
- **D-04:** Schema managed by Flyway (`V1__create_users.sql` committed under the service); Boot-managed dependency, no extra version pins. Order-service reuses the migration pattern in Phase 5.
- **D-05:** User IDs generated app-side (JPA/Hibernate UUID), stored as native Postgres `uuid` column, stringified on the wire per interop rules — matches contract examples. — **Reversibility:** costly — user IDs become foreign references once cart (Phase 4) and order (Phase 5) store them; changing generation later means migrating the primary key AND every downstream reference.
- **D-06:** Roles stored as Postgres `text[]` mapped naturally by Hibernate; matches the contract's array shape without joins. v1 always populates `[customer]`.

**Testing**
- **D-07:** Unit tests for service-layer logic PLUS a `@SpringBootTest` slice backed by Testcontainers `postgres:18` — validates the Flyway migration and real SQL dialect (uuid + array columns are exactly where H2 diverges).
- **D-08:** Tests run on host via `./mvnw test` with a local JDK 21 prerequisite; Testcontainers drives Docker Desktop. No local-Maven install needed (wrapper committed).

**Ports & Verification**
- **D-09:** auth-service publishes temporary host port `8081:8081` in compose with an explicit comment marking it transitional; Phase 7 revokes it as part of GTWY-04 isolation verification. Same revoke-later pattern the gateway already plans.
- **D-10:** Standalone smoke test is a committed script `scripts/smoke-auth.sh`: signup → login → `/me` with status-code assertions. Later phases add sibling scripts; Phase 9 chains them into the zero-manual-steps E2E.

### Agent's Discretion
Standard implementation details left to researcher/planner: healthcheck endpoint specifics (actuator exposure breadth), email normalization rules, bcrypt cost factor, error-body shape (follow `docs/api-contracts/_shared.yaml` responses), Spring Security config style, package structure.

### Frozen Contracts (canonical refs the plan MUST honor)
- `docs/api-contracts/auth-service.openapi.yaml` — endpoints/shapes/errors; info.description freezes JWT conventions (HS256 pinned, iss/aud/TTL/skew) and logout policy (NO logout endpoint).
- `docs/api-contracts/_shared.yaml` — bearerAuth scheme, Conflict (409 DUPLICATE_EMAIL), Unauthorized (401) shapes.
- `docs/json-interop.md` — §JWT Claims (single canonical home); §Secret Handling (CSPRNG ≥32 bytes, startup assertion, holders = auth-service + gateway only).
- `docs/versions.md` — exact pins (Boot 3.5.16, Cloud 2025.0.3, JDK 21, temurin 21-jre, Postgres 18 volume at `/var/lib/postgresql`).
- `.env.example` — contractual variable names this service consumes.
- `.planning/ROADMAP.md` §Phase 2 — 5 success criteria.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

## Summary

This phase builds the platform's first real service: a Spring Boot 3.5.16 servlet app exposing `POST /auth/signup`, `POST /auth/login`, `GET /auth/me` against PostgreSQL, issuing HS256 JWTs via the OAuth2 Resource Server toolkit (`NimbusJwtEncoder`/`NimbusJwtDecoder` over nimbus-jose-jwt — no jjwt, no hand-rolled HMAC). Every wire shape, claim literal, and error code is already frozen in the committed OpenAPI contract; the research below maps each frozen value to its Spring wiring. The riskiest new ground is not the CRUD — it is (a) the symmetric-key JWT encode/decode configuration (Spring's decoder defaults to RS256-only, audience/skew validation needs explicit beans), (b) Hibernate 6's native mappings for `uuid` and `text[]` (both are default-correct on the PostgreSQL dialect — no annotations needed beyond `@UuidGenerator`), and (c) the Docker/compose proof: alpine JRE images ship BusyBox `wget` but no `curl`, PG18 moved its volume root, and PG init scripts only ever run on an empty data volume — which quietly constrains how D-02's second database can arrive in Phase 5.

Two environment findings need planner attention: the host runs **JDK 23.0.1, not the JDK 21 prerequisite stated in D-08** (mitigation: `<maven.compiler.release>21</maven.compiler.release>` compiles/tests correctly on 23 — or install Temurin 21; both viable, user should pick), and `jq` is absent (smoke script must assert with pure `curl` status-code extraction). Docker Desktop is installed but was **not running** during research — Testcontainers (D-07) hard-requires it.

**Primary recommendation:** One Boot service wired around four explicit beans — pinned-HS256 `JwtEncoder`, symmetric `JwtDecoder` composed with issuer+audience+60s-skew validators, `PasswordEncoder` (bcrypt, cost 12), and a `SecurityFilterChain` (stateless, CSRF off, `/auth/signup|/auth/login|/actuator/health` permitted, everything else authenticated via `oauth2ResourceServer().jwt()`) — plus a Flyway `V1__create_users.sql` (native `uuid` PK, `text[]` roles, unique email), a `@RestControllerAdvice` emitting the shared `{code,message}` envelope, a multi-stage alpine Dockerfile with `-XX:MaxRAMPercentage=75`, and a jq-free `scripts/smoke-auth.sh`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Signup with email/password; duplicate emails rejected; passwords hashed | Encoder bean (bcrypt) + Flyway V1 unique constraint + `DataIntegrityViolationException` → 409 `DUPLICATE_EMAIL` mapping; jakarta-validation → `VALIDATION_FAILED`; contract schemas quoted below |
| AUTH-02 | Login with valid credentials → signed JWT; invalid refused | `NimbusJwtEncoder` + `OctetSequenceJWK` + explicit `JWSAlgorithm.HS256` header; claims table frozen in `json-interop.md`; uniform-401 anti-enumeration pattern |
| AUTH-03 | Authenticated `/me`; requests without valid JWT rejected | Resource-server filter chain; `Authentication#getName()` maps to `sub`; decoder validates sig + iss + aud + exp(±60s) |
| AUTH-04 | Logout = client-side token discard, documented | Contract forbids a logout endpoint (D-03) — success criterion satisfied by docs statement + absence-of-endpoint smoke assertion |
| (SC-5) | Multi-stage build, compose entry + passing healthcheck, standalone curl smoke | Dockerfile/compose/smoke-script patterns below (alpine wget, MaxRAMPercentage=75, mem_limit, start_period, transitional :8081) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Credential verification + bcrypt hashing | API/Backend (auth-service) | — | Passwords never leave the trust boundary; browser tier must never see hashes |
| JWT signing (HS256) | API/Backend (auth-service) | — | Signing secret holder #1 per `json-interop.md` §Secret Handling |
| JWT signature/expiry/iss/aud verification | API/Backend (every resource service) | Gateway (Phase 7 re-verifies) | Verifier asserts `alg=HS256` before accepting claims; auth-service self-verifies for `/me` |
| Identity resolution for `/me` | API/Backend (auth-service) | — | Identity derives exclusively from verified `sub` claim server-side; request bodies never carry identity (contract) |
| User persistence + schema evolution | Database/Storage (PG `users` db) | Flyway in-app | D-02/D-04: one PG container, two databases, migrations owned by the service |
| Container orchestration/memory caps | CDN/Infra (docker-compose) | Dockerfile JVM flags | D-03: `mem_limit` in compose pairs with `-XX:MaxRAMPercentage=75` in image |
| Logout | Browser/Client (future Phase 8 UI) | — | No server endpoint exists by design (D-03); token discard is client-side |

## Project Constraints (from AGENTS.md)

- Pinned stack is law: Spring Boot **3.5.16**, Cloud **2025.0.3**, JDK **21**, `spring-boot-starter-oauth2-resource-server` (nimbus-jose-jwt under the hood), Flyway Boot-managed, `postgres:18` named volume at **`/var/lib/postgresql`** (NOT `/var/lib/postgresql/data`), `eclipse-temurin:21-jre` base images, actuator healthchecks with generous `start_period`. Do not re-litigate pins.
- Versions COPY from `docs/versions.md`; no per-service version invention. [VERIFIED: docs/versions.md:3-10]
- `.gitattributes` enforces LF everywhere including `mvnw` and shell scripts — `scripts/smoke-auth.sh` must be authored LF. [VERIFIED: .gitattributes (catch-all `* text=auto eol=lf`)]
- Contracts-first workflow: OpenAPI file edited before/with code; `scripts/check-contracts.sh` must pass at Verify (Stage 5 asserts operationIds `signup`, `login`, `getMe` exist in the auth spec). [VERIFIED: scripts/check-contracts.sh:113-126]
- GSD workflow: file changes go through GSD commands; commit_docs=true for planning artifacts.
- Security enforcement enabled, ASVS Level 1, block-on high (config.json).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| spring-boot-starter-parent | **3.5.16** | Parent POM; manages ALL versions below | Project pin; OSS-EOL posture accepted per D-07 of versions manifest. [VERIFIED: docs/versions.md:14] |
| spring-boot-starter-web | managed (3.5.16) | Servlet MVC REST endpoints | Standard servlet stack; matches gateway's eventual WebFlux-free downstream expectations |
| spring-boot-starter-security | managed | Filter chain, PasswordEncoder crypto | Required for `SecurityFilterChain` DSL + `spring-security-crypto` bcrypt |
| spring-boot-starter-oauth2-resource-server | managed | JWT encode AND decode (pulls `spring-security-oauth2-jose`) | Official docs: decoding/verifying support lives in `spring-security-oauth2-jose`, pulled transitively; industry-standard route, zero extra pins. [CITED: docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html — "Minimal Dependencies"] |
| spring-boot-starter-data-jpa | managed | JPA/Hibernate 6.x entity + repository | D-05/D-06 rely on Hibernate 6 native uuid/array mappings. [CITED: Hibernate 6.6 user guide] |
| spring-boot-starter-validation | managed | jakarta `@Email`/`@Size` bean validation → 400 `VALIDATION_FAILED` | Maps directly to contract's ValidationError envelope |
| org.flywaydb:flyway-core + **flyway-database-postgresql** | managed by Boot | Schema migration V1__ | ⚠️ Since Flyway 10, database modules split out — **both coordinates required**; Boot manages versions. [CITED: springdoc of Boot-managed Flyway 11; corroborated by codersee.com/flyway-migrations-with-spring-boot, GH nanotaboada#130, IroshPerera sample] |
| org.postgresql:postgresql | managed | JDBC driver (runtime scope) | Boot-managed; supports PG18 |
| spring-boot-starter-actuator | managed | `/actuator/health` for compose healthcheck | ORCH-02 pattern |

### Supporting (test scope)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| spring-boot-starter-test | managed | JUnit 5, AssertJ, MockMvc, Testclient | All tests |
| spring-boot-testcontainers | managed (Boot 3.5 → TC 1.21.x) | `@ServiceConnection` auto-config | D-07 slice tests. [CITED: docs.spring.io/spring-boot/3.5/reference/testing/testcontainers.html] |
| org.testcontainers:postgresql | managed | `PostgreSQLContainer("postgres:18")` | Real-SQL-dialect tests; `@ServiceConnection` provides `JdbcConnectionDetails` AND `FlywayConnectionDetails` automatically. [CITED: same page — connection-details table] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| oauth2-resource-server JWT toolkit | jjwt (io.jsonwebtoken) | Manual parse/validate code; loses Boot auto-config; STACK.md explicitly prefers Resource Server |
| `DelegatingPasswordEncoder` via factories | Plain `new BCryptPasswordEncoder(cost)` | Delegating stores `{bcrypt}` prefix (self-describing, upgradeable); plain encoder stores raw bcrypt. Either satisfies "hashed, not recoverable"; **plain encoder keeps DB column clean of framework prefixes** and matches "stored bcrypt-hashed" wording literally — recommend plain encoder bean here (discretion area) |
| springdoc-openapi-starter-webmvc-api 2.8.x | None (skip live generation in v1) | EXPR-05 defers Swagger UI exposure to v2; `check-contracts.sh` currently greps the YAML files only — live-output diffing is aspirational. Adding springdoc now invites the multi-file `$ref` normalization problem (Pitfall 7) for zero Verify value today. **Recommend deferring springdoc to the v2 item.** |
| `mem_limit` compose key | `deploy.resources.limits.memory` | `mem_limit` works on local Compose v2 single-host without swarm mode; deploy.limits is ignored outside swarm unless `docker compose` translates it. Keep `mem_limit`. [CITED: docker compose file reference behavior; ASSUMED nuance] |

**Installation** (all versions inherited from parent — no explicit version tags allowed per versions.md policy):

```xml
<!-- pom.xml: parent = spring-boot-starter-parent 3.5.16; properties: java.version=21 -->
<dependencies>
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-oauth2-resource-server</artifactId></dependency>
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
  <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>
  <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-database-postgresql</artifactId></dependency>
  <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-actuator</artifactId></dependency>
  <!-- test -->
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
  <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-testcontainers</artifactId><scope>test</scope></dependency>
  <dependency><groupId>org.testcontainers</groupId><artifactId>postgresql</artifactId><scope>test</scope></dependency>
  <dependency><groupId>org.testcontainers</groupId><artifactId>junit-jupiter</artifactId><scope>test</scope></dependency>
</dependencies>
```

Maven Wrapper: generate once (`mvn wrapper:wrapper` or copy from any Boot 3.5 Initializr zip) into `services/auth-service/`; commit `.mvn/wrapper/`, `mvnw`, `mvnw.cmd`. `.gitattributes` already forces LF on `mvnw`. [VERIFIED: .gitattributes]

## Package Legitimacy Audit

> Seam verdict engine covers npm/pypi/crates only; Maven coordinates were verified directly against the authoritative registry (search.maven.org Solr API, this session) — every coordinate returned `numFound:1`. All are first-party artifacts whose versions are inherited from the pinned `spring-boot-starter-parent:3.5.16` BOM, per the project's no-version-invention policy. [VERIFIED: search.maven.org queries, 2026-08-25]

| Package (groupId:artifactId) | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| org.springframework.boot:spring-boot-*-starter-* (web/security/jpa/validation/actuator/test, testcontainers) | Maven Central | 17 yrs (project) | n/a (first-party) | github.com/spring-projects/spring-boot | OK | Approved — versions via parent BOM |
| org.springframework.security:spring-security-oauth2-jose (+ -resource-server) | Maven Central | 11 yrs | n/a (first-party) | github.com/spring-projects/spring-security | OK | Approved |
| org.flywaydb:flyway-core | Maven Central | 14 yrs | very high | github.com/flyway/flyway | OK | Approved |
| org.flywaydb:flyway-database-postgresql | Maven Central | since Flyway 10 (2023) | high | github.com/flyway/flyway | OK | Approved — REQUIRED companion to core |
| org.postgresql:postgresql | Maven Central | 24 yrs | very high | github.com/pgjdbc/pgjdbc | OK | Approved |
| org.testcontainers:postgresql / junit-jupiter | Maven Central | 10 yrs | very high | github.com/testcontainers/testcontainers-java | OK | Approved |
| springdoc-openapi-starter-webmvc-api 2.8.x | Maven Central | 6 yrs (project) | high | github.com/springdoc/springdoc-openapi | OK | **Recommend DEFER to v2** (EXPR-05) — see Alternatives |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                HOST (dev machine)
                      │
      ┌───────────────┴────────────────────────────────┐
      │ docker compose                                 │
      │                                                │
      │  :8081 (TRANSITIONAL host port, revoked Ph7)   │
      │   ┌──────────────────────────┐                 │
      │   │ auth-service (Boot jar)  │                 │
      │   │  SecurityFilterChain      │                │
      │   │   ├─ permit: signup/login │                │
      │   │   │         actuator/hlth │                │
      │   │   └─ jwt(): me (+others)  │                │
      │   │  JwtEncoder(HS256)─┐      │                │
      │   │  JwtDecoder(HS256)─┤same  │                │
      │   │   validators: iss, │secret│                │
      │   │   aud, ±60s skew   ▼      │                │
      │   │  RestControllerAdvice     │                │
      │   │   {code,message} envelope │                │
      │   └───────────┬──────────────┘                 │
      │               │ jdbc:postgresql://postgres:5432/users
      │   ┌───────────▼──────────────┐                 │
      │   │ postgres:18              │                 │
      │   │  db: users (Flyway V1)   │                 │
      │   │  db: orders (Phase 5)    │                 │
      │   │  volume: pgdata →        │                 │
      │   │   /var/lib/postgresql    │                 │
      │   └──────────────────────────┘                 │
      └────────────────────────────────────────────────┘
      Host-side: ./mvnw test → Testcontainers → ephemeral postgres:18
                 scripts/smoke-auth.sh → curl :8081 signup→login→/me
```

Trace: signup request enters via :8081 → filter chain permits → validation → bcrypt encode → JPA insert (unique constraint guards dupes) → 201 User JSON. Login → lookup by email → bcrypt match → JwtEncoder emits HS256 token with frozen claims → 200 `{accessToken,user}`. `/me` → Bearer token → JwtDecoder verifies (alg pinned, iss/aud/exp) → controller reads `sub` → loads user → 200 User. Invalid/expired/missing → 401 `{code:UNAUTHORIZED,...}`.

### Recommended Project Structure

```
services/auth-service/
├── .mvn/wrapper/            # wrapper jar+properties (committed)
├── mvnw, mvnw.cmd           # LF-enforced
├── pom.xml                  # parent 3.5.16, java.version 21
├── Dockerfile               # multi-stage, alpine jre runtime
└── src/
    ├── main/
    │   ├── java/com/ecommerce/auth/
    │   │   ├── AuthServiceApplication.java
    │   │   ├── config/       # SecurityConfig, JwtConfig(encoder+decoder+validators), JwtSecretAssertion
    │   │   ├── user/         # User entity, RoleValues?, UserRepository
    │   │   ├── web/          # AuthController (signup/login/me), dto records, GlobalExceptionHandler(@RestControllerAdvice)
    │   │   ├── security/     # RestAuthenticationEntryPoint (401 envelope)
    │   │   └── support/      # ApiError record {code,message}
    │   └── resources/
    │       ├── application.yml
    │       └── db/migration/V1__create_users.sql
    └── test/java/com/ecommerce/auth/
        ├── user/UserServiceTests.java          # unit slice (mock repo)
        ├── web/AuthFlowIntegrationTests.java   # @SpringBootTest + Testcontainers PG18
        └── support/...
```

### Pattern 1: Symmetric HS256 encoder (issue side)

**What:** `NimbusJwtEncoder` backed by an `ImmutableJWKSet` wrapping the base64-decoded secret.
**When to use:** every token issuance (login).
**Example:**

```java
// Source: NimbusJwtEncoder javadoc (constructor since Spring Security 5.6)
// + docs.spring.io resource-server reference
@Bean
JwtEncoder jwtEncoder(@Value("${jwt.secret}") String base64Secret) {
    byte[] secretBytes = Base64.getDecoder().decode(base64Secret);
    OctetSequenceJWK jwk = new OctetSequenceJWK.Builder(secretBytes).algorithm(JWSAlgorithm.HS256).build();
    return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(jwk)));
}

String issueToken(UserEntity user) {
    Instant now = Instant.now();
    Instant expiry = now.plus(Duration.ofSeconds(ttlSeconds)); // JWT_TTL_SECONDS=3600
    JwtClaimsSet claims = JwtClaimsSet.builder()
        .issuer(jwtIssuer)                    // exactly "ecommerce-auth"
        .issuedAt(now)
        .expiresAt(expiry)
        .subject(user.getId().toString())     // sub = userId (string on the wire)
        .claim("email", user.getEmail())
        .claim("roles", user.getRoles())      // ["customer"]
        .build();
    JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.HS256).build(); // PIN the alg
    return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
}
```

⚠️ Always pass the `JWSHeader` — `JwtEncoderParameters.from(header, claims)`. Omitting it leaves algorithm selection to defaults tuned for RSA, which fails against a symmetric-only JWK source. [ASSUMED — classic pitfall; javadoc confirms parameters carry "the JOSE header and JWT Claims Set"]

### Pattern 2: Symmetric HS256 decoder + frozen validations (verify side)

```java
// Source: docs.spring.io resource-server JWT page + JwtTimestampValidator javadoc (ctor since 5.1)
@Bean
JwtDecoder jwtDecoder(@Value("${jwt.secret}") String base64Secret,
                      @Value("${jwt.issuer}") String issuer,
                      @Value("${jwt.audience}") String audience) {
    SecretKey key = new SecretKeySpec(Base64.getDecoder().decode(base64Secret), "HMACSHA256");
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).build();
    OAuth2TokenValidator<Jwt> skew   = new JwtTimestampValidator(Duration.ofSeconds(60)); // ±60 s
    OAuth2TokenValidator<Jwt> issuerV = JwtValidators.createDefaultWithIssuer(issuer);
    OAuth2TokenValidator<Jwt> audV    = new JwtClaimValidator<List<String>>(AUD,
            aud -> aud != null && aud.contains(audience));
    decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(skew, issuerV, audV));
    return decoder;
}
```

`withSecretKey()` restricts verification to MAC algorithms; combined with the encoder's pinned HS256 header this satisfies "verifier asserts alg equals HS256 and rejects every other value". [CITED: docs.spring.io resource-server page ("Trusting a Single Symmetric Key", "Configuring Trusted Algorithms"); docs/json-interop.md:113-116]

### Pattern 3: Stateless filter chain

```java
// Source: docs.spring.io resource-server page (Custom JWT Configuration example)
@Bean
SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
      .csrf(AbstractHttpConfigurer::disable)                       // stateless bearer API
      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
          .requestMatchers("/auth/signup", "/auth/login", "/actuator/health").permitAll()
          .requestMatchers("/auth/**").authenticated()             // /auth/me et al.
          .anyRequest().denyAll())
      .exceptionHandling(e -> e.authenticationEntryPoint(restEntryPoint())) // 401 envelope
      .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
    return http.build();
}
```

### Pattern 4: Unified error envelope ({code, message})

Contract requires every failure to emit `{code, message}` with machine-readable codes; clients branch on code, never message; messages MUST NOT leak internals. [VERIFIED: docs/api-contracts/_shared.yaml:69-91]

```java
record ApiError(String code, String message) {}

@RestControllerAdvice
class GlobalExceptionHandler {
    static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalid() {
        return status(HttpStatus.BAD_REQUEST).body(new ApiError("VALIDATION_FAILED",
            "Request validation failed. Check field formats and limits."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)     // unique_email violation — race-safe
    ResponseEntity<ApiError> conflict(Exception e) {
        log.warn("Integrity violation suppressed", e);           // log internals server-side ONLY
        return status(HttpStatus.CONFLICT).body(new ApiError("DUPLICATE_EMAIL",
            "An account with this email already exists."));      // exact contract example strings
    }
}
```

Plus a custom `AuthenticationEntryPoint` writing `401 {"code":"UNAUTHORIZED","message":"Authentication required or credentials invalid."}` — Spring's default entry point emits a different body shape. Login-failure path (bad password) also returns this identical 401 body — never reveal whether the email existed (anti-enumeration; ASVS V2).

### Pattern 5: Flyway V1 migration (frozen columns)

```sql
-- V1__create_users.sql  (src/main/resources/db/migration/)
CREATE TABLE users (
    id         uuid PRIMARY KEY,                     -- D-05: app-generated UUID
    email      varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,             -- bcrypt only, never recoverable
    roles      text[] NOT NULL DEFAULT '{customer}', -- D-06: native array
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uniq ON users (email);  -- store normalized (lowercased) emails
```

Entity side (no extra annotations needed for the array):

```java
// Source: Hibernate 6.6 user guide — arrays map to SqlTypes.ARRAY by default (text[] on PG);
// @UuidGenerator default style is RANDOM (RFC 4122 v4), app-side generation per D-05.
@Entity @Table(name = "users")
class UserEntity {
    @Id @GeneratedValue @UuidGenerator
    private UUID id;

    @Column(nullable = false, unique = false) private String email; // uniqueness enforced by index above
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(columnDefinition = "text[]", nullable = false)
    private List<String> roles = List.of("customer");

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
```

Set `spring.jpa.hibernate.ddl-auto=validate` — Flyway owns the schema; validate catches entity↔migration drift early.

### Pattern 6: Startup secret assertion (fail fast, fail securely)

```java
// Source requirement: docs/json-interop.md §Secret Handling items 1–4 (quoted below)
@Component
class JwtSecretAssertion implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(JwtSecretAssertion.class);
    private final String secret;
    JwtSecretAssertion(@Value("${jwt.secret}") String secret) { this.secret = secret; }

    @Override public void run(ApplicationArguments args) {
        int bytes = Base64.getDecoder().decode(secret).length;
        if (bytes < 32) throw new IllegalStateException(
            "jwt.secret too short: " + bytes + " bytes decoded; minimum 32");
        log.info("JWT signing secret present ({} decoded bytes)", bytes); // log LENGTH, never content
    }
}
```

### Pattern 7: Multi-stage Dockerfile (template for order-service/gateway)

```dockerfile
# ---- build stage: full JDK ----
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -q -B dependency:go-offline || true        # best-effort layer cache
COPY src ./src
RUN ./mvnw -q -B package -DskipTests

# ---- runtime stage: JRE only, non-root ----
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S spring && adduser -S spring -G spring
USER spring
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

alpine JRE images include BusyBox `wget` and do NOT include `curl` — the healthcheck must use wget. [CITED: stackoverflow.com/q/57515333 (21-jre-alpine ships wget) + marmo.dev/deploy-spring-with-docker ("curl is not available in this image")]

### Pattern 8: Compose entries (incremental growth per D-01)

```yaml
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: users
    volumes:
      - pgdata:/var/lib/postgresql          # PG18: mount the ROOT, not /data [VERIFIED: docs/versions.md:28]
      # optional (see Pitfall 8): - ./scripts/pg-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d users"]
      interval: 10s
      timeout: 5s
      retries: 5
    # NO host port published — DB stays network-internal (GTWY-04 direction)

  auth-service:
    build: ./services/auth-service
    # TRANSITIONAL PORT — direct access for Phases 2–6 only; revoked in Phase 7 (D-09, GTWY-04)
    ports:
      - "8081:8081"
    environment:
      SPRING_DATA_SOURCE_URL: jdbc:postgresql://postgres:5432/users
      SPRING_DATA_SOURCE_USERNAME: ${POSTGRES_USER}
      SPRING_DATA_SOURCE_PASSWORD: ${POSTGRES_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      JWT_ISSUER: ${JWT_ISSUER}             # ecommerce-auth
      JWT_AUDIENCE: ${JWT_AUDIENCE}         # ecommerce-api
      JWT_TTL_SECONDS: ${JWT_TTL_SECONDS}   # 3600
      SERVER_PORT: "8081"
    depends_on:
      postgres:
        condition: service_healthy
    mem_limit: 512m                         # D-03 pairing with MaxRAMPercentage=75
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8081/actuator/health | grep UP || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 60s                     # generous: JVM boot + Flyway migrate

volumes:
  pgdata:
```

Also apply D-01: rewrite the compose header comment to the incremental-growth policy (current header wrongly says Phase 2 adds Kafka/Mongo/Redis/Mailpit/Kafka-UI). [VERIFIED: docker-compose.yml:4-9]

### Anti-Patterns to Avoid
- **Hand-rolled HMAC/Base64Url JWT code** — nimbus-jose-jwt (via resource-server) handles RFC 7515/7519 edge cases; hand-rolling breaks interop with the Phase 7 verifier.
- **Pre-check-then-insert for email uniqueness** — TOCTOU race; rely on the unique index and translate the constraint violation.
- **`ddl-auto=update/create` alongside Flyway** — two schema owners drift; `validate` only.
- **Storing Spring's `{bcrypt}`-prefixed DelegatingPasswordEncoder output while claiming "raw bcrypt"** — pick ONE representation and keep tests consistent with it (either is secure; consistency is the requirement).
- **Different 401 bodies for expired vs missing vs malformed tokens** — collapses to one UNAUTHORIZED envelope.
- **Logging the JWT secret or full tokens** — log presence/length only (interop law item 4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT sign/verify | Manual HMAC + Base64url + claims JSON | `NimbusJwtEncoder`/`NimbusJwtDecoder` (resource-server starter) | JOSE spec edge cases, constant-time MAC verify, validator composition |
| Password hashing | SHA-256/MD5/custom salt schemes | `BCryptPasswordEncoder` (spring-security-crypto) | Adaptive work factor, embedded salt, constant-time compare |
| CSPRNG secret | `Random`, timestamp-derived keys | `openssl rand -base64 32` at `.env` creation time | CSPRNG mandated by json-interop §Secret Handling |
| DB schema evolution | Hand-run psql DDL, schema.sql | Flyway V-named migrations | Versioned, checksummed, repeatable across cold starts |
| Unique-email race guard | SELECT-then-INSERT | PG unique index + `DataIntegrityViolationException` mapping | Only the DB constraint is atomic |
| Integration DB | H2 "compatible mode" | Testcontainers `postgres:18` | uuid + text[] are exactly where H2 diverges (D-07 rationale) |
| Health probe scripting | Custom TCP pinger in image | actuator `/actuator/health` + BusyBox wget | Status UP/DOWN reflects DB connectivity via Boot auto-config |

**Key insight:** Every cryptographic and persistence primitive this phase needs is already in the pinned stack — the engineering work is *configuration fidelity* to frozen contracts, not algorithm construction.

## Common Pitfalls

### Pitfall 1: Decoder silently expects RS256
**What goes wrong:** Default `NimbusJwtDecoder` trusts only RS256; a symmetric-secret setup that skips `withSecretKey()` rejects every issued token or misconfigures discovery.
**Why:** RS256 is the library default for asymmetric JWKS deployments.
**How to avoid:** Always construct via `NimbusJwtDecoder.withSecretKey(key)`; add the issuer/audience/skew validator chain explicitly (Pattern 2).
**Warning signs:** `JwtValidationException` mentioning signature/algorithm on freshly minted tokens.

### Pitfall 2: Encoder without explicit JWSHeader
**What goes wrong:** Encoding claims-only picks a default algorithm suited to RSA keys and throws against a symmetric JWK source.
**How to avoid:** `JwtEncoderParameters.from(new JWSHeader.Builder(JWSAlgorithm.HS256).build(), claims)` — always. [ASSUMED failure mode; header-in-parameters is javadoc-verified]

### Pitfall 3: Timestamp serialization violates the millisecond law
**What goes wrong:** Jackson serializes `Instant` with variable fractional digits (`…T12:00:00Z` when millis are 000, 6 digits when micros present) — `json-interop.md` Rule 1 demands exactly 3 digits + `Z`. Its Java guard row warns: *"Default serialization of java.time types … produces arrays or ISO strings without millis — drifts from the canonical form."* [VERIFIED: docs/json-interop.md:31]
**How to avoid:** Annotate `createdAt` with `@JsonFormat(shape = STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")`, or register a millisecond `InstantSerializer`. Add an integration-test assertion on the emitted regex.
**Warning signs:** contract-diff failures; smoke tests comparing timestamps literally.

### Pitfall 4: User enumeration via divergent error paths
**What goes wrong:** "No such user" vs "wrong password" returning different bodies/statuses leaks registered addresses.
**How to avoid:** One shared 401 `UNAUTHORIZED` envelope for both factors; identical timing profile (run bcrypt compare even when user absent — hash-and-compare against a dummy constant).
**Warning signs:** security review findings (ASVS V2 auth error handling).

### Pitfall 5: `grep UP` healthcheck false positives/negatives
**What goes wrong:** With `show-details` enabled the body contains other statuses; conversely `grep '"status":"UP"'` is brittle to whitespace changes. Also curl doesn't exist on alpine.
**How to avoid:** Keep exposure minimal (`management.endpoints.web.exposure.include: health`), use the simple `wget -qO- … | grep UP || exit 1` form, and rely on HTTP 200-vs-503 semantics (actuator serves 503 when DOWN). [CITED: SO q/57515333 discussion]

### Pitfall 6: PG18 volume mounted at the old path
**What goes wrong:** Pre-18 habit `- pgdata:/var/lib/postgresql/data` misplaces data silently (PGDATA moved to version-specific subdir; declared VOLUME is `/var/lib/postgresql`).
**How to avoid:** Mount named volume at `/var/lib/postgresql`. Already pinned in versions.md. [VERIFIED: docs/versions.md:28]

### Pitfall 7: Naive live-springdoc diff against the committed spec
**What goes wrong:** The committed spec `$ref`s an external file (`./_shared.yaml#/components/...`); springdoc emits a single self-contained doc with renamed inline components. Any structural equality check fails forever.
**How to avoid:** If/when live conformance checking is built, normalize semantically (paths/operations/response codes/error codes) rather than byte/structure diffing — or defer springdoc entirely (recommended for v1; EXPR-05 owns UI exposure in v2).
**Warning signs:** a planned task "diff /v3/api-docs against auth-service.openapi.yaml".

### Pitfall 8: Second database can't appear from init scripts on an existing volume
**What goes wrong:** `/docker-entrypoint-initdb.d` scripts execute ONLY during first initialization of an empty data directory. Adding an `orders` init script in Phase 5 does nothing to an existing volume. [CITED: official postgres image docs quoted in mrts/docker-postgresql-multiple-databases README + SO q/46668233]
**How to avoid:** Choose deliberately (see Open Questions Q1): either (a) create BOTH `users` and `orders` in Phase 2's init script/env so cold-start reproducibility (ORCH-04) holds forever, or (b) accept a one-time `CREATE DATABASE orders;` step inside Phase 5's tasks. Option (a) costs ~10 MB and removes a manual step; option (b) matches D-02's phrasing literally.
**Warning signs:** Phase 5 verify failing on fresh clones but passing on long-lived volumes.

### Pitfall 9: CRLF poisoning of mvnw / smoke script on Windows
**What goes wrong:** Git on Windows can commit CRLF, breaking `./mvnw` (bash) and `smoke-auth.sh`.
**How to avoid:** `.gitattributes` catch-all already forces LF — author files with LF and verify `git ls-files --eol` shows `i/lf` (check-contracts Stage 3 enforces this). [VERIFIED: .gitattributes + check-contracts.sh:62-70]

### Pitfall 10: OneDrive path file locks during Maven/Docker builds
**What goes wrong:** STATE.md already flags OneDrive sync as a build-lock risk on this repo path; concurrent jar writes or Docker context uploads can fail spuriously.
**How to avoid:** Prefer pausing sync/excluding the dir; retry transient `FileNotFoundException`s during `./mvnw package` before debugging deeper. [VERIFIED: .planning/STATE.md Blockers/Concerns]

## Code Examples

See Patterns 1–8 above (all sourced). Two additional snippets:

**Controller skeleton honoring contract shapes:**

```java
@RestController
class AuthController {
    // POST /auth/signup -> 201 User | 409 Conflict(DUPLICATE_EMAIL)   [contract op: signup]
    // POST /auth/login  -> 200 {accessToken, user} | 401              [contract op: login]
    // GET  /auth/me     -> 200 User | 401                             [contract op: getMe]
    // NOTE: there is intentionally NO logout mapping — D-03 freezes its absence.

    @PostMapping("/auth/me-context") // illustrative only
    UserDto me(Authentication authentication) {
        // Authentication#getName() maps to the JWT sub claim by default
        // [CITED: docs.spring.io resource-server page — "Runtime Expectations"]
        UUID userId = UUID.fromString(authentication.getName());
        return userService.profileOf(userId);
    }
}
```

**Smoke script assertion style (jq-free):**

```bash
#!/usr/bin/env bash
# scripts/smoke-auth.sh — signup → login → /me with status assertions (LF endings!)
set -euo pipefail
BASE="${AUTH_BASE_URL:-http://localhost:8081}"
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

EMAIL="smoke-$RANDOM@example.com"
[ "$(code -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"correct-horse-battery\"}")" = 201 ] || { echo "FAIL signup"; exit 1; }
[ "$(code -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"correct-horse-battery\"}")" = 409 ] || { echo "FAIL dup-email"; exit 1; }

TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"correct-horse-battery\"}" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "FAIL login"; exit 1; }
[ "$(code "$BASE/auth/me" -H "Authorization: Bearer $TOKEN")" = 200 ] || { echo "FAIL me"; exit 1; }
[ "$(code "$BASE/auth/me")" = 401 ] || { echo "FAIL unauthenticated-me"; exit 1; }
echo "smoke-auth: ALL PASS"
```

(`sed` extraction avoids the missing `jq`; replace with a stricter parser later if desired.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jjwt manual wiring for JWT | Spring Security OAuth2 Resource Server (nimbus) | stable since Boot 2.x | Zero extra pins; validator composition idioms |
| Motor-style wrappers / legacy starters | n/a (Java side) | — | — |
| `spring-cloud-starter-gateway` naming | `…gateway-server-webflux` | SC 2025.0 | Irrelevant this phase; matters Phase 7 |
| Flyway monolithic artifact | flyway-core + flyway-database-postgresql split | Flyway 10 (2023) | Missing companion = "No database found to handle jdbc:postgresql…" boot crash |
| PGDATA at `/var/lib/postgresql/data` | Volume root `/var/lib/postgresql` | postgres:18 image (2025) | Wrong mount silently loses data |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Omitting the `JWSHeader` in `JwtEncoderParameters` defaults toward RS256 and fails against a symmetric JWK source | Pattern 1 / Pitfall 2 | Token issuance broken at runtime — trivially caught by the first login test |
| A2 | `mem_limit` (not `deploy.resources.limits`) applies under local Compose v2 | Alternatives table | Memory cap silently ignored → OOMKill risk remains (ORCH-02); visible via `docker inspect` at verify |
| A3 | BCrypt cost 12 is the right dev-box tradeoff (docs advise tuning toward ~1s verify, which is excessive for local learning) | Primary rec / Discretion | Slower tests; purely tunable constant |
| A4 | Host JDK 23 + `<release>21</release>` is an acceptable substitute for the "local JDK 21 prerequisite" (D-08) | Environment table / Q2 | Bytecode target still 21; container runtime unaffected; if user insists on literal 21 they must install Temurin 21 |
| A5 | BusyBox wget on 21-jre-alpine supports the exact `-qO-` flag combo used in the healthcheck | Pattern 8 / Pitfall 5 | Healthcheck always-unhealthy; swap to `wget -q -O-` or spider form |
| A6 | `sed`-based accessToken extraction is adequate for smoke-auth.sh | Code Examples | Brittle if response formatting changes — acceptable for a status-first script; jq install would remove fragility |
| A7 | Creating the empty `orders` database in Phase 2 (Option a, Pitfall 8) is acceptable despite D-02's "added by order-service in Phase 5" phrasing | Open Questions Q1 | Deviation from locked-decision wording — needs user confirmation either way |

## Open Questions

1. **When does the `orders` database physically exist?** *(Pitfall 8)*
   - What we know: PG init scripts run only on empty volumes; D-02 wants no container recreation; ORCH-04 demands clean cold starts at Phase 9.
   - What's unclear: create `orders` eagerly in Phase 2 (robust, slight wording deviation) vs lazily in Phase 5 (literal compliance, adds a one-time manual/exec task + init-script backfill for cold starts).
   - Recommendation: eager (Option a) — commit `scripts/pg-init/01-create-databases.sh` iterating `POSTGRES_MULTIPLE_DATABASES` (set to `users,orders`) now; flag to user in plan as a checkpoint if strictness preferred.

2. **Host JDK: literal 21 vs release-flag on 23?** *(A4)*
   - What we know: host has Oracle JDK 23.0.1; D-08 names "local JDK 21 prerequisite".
   - Recommendation: proceed with `maven.compiler.release=21` on JDK 23 (bytecode + API targeting identical for this codebase); offer Temurin 21 install as alternative. Needs user nod at plan review since D-08 is a locked decision.

3. **PasswordEncoder representation: `{bcrypt}`-prefixed Delegating vs raw bcrypt?**
   - Both satisfy "hashed, not recoverable"; discretion area. Recommendation: plain `BCryptPasswordEncoder(12)` bean — column content stays tool-portable (`$2a$…` recognizable everywhere) and matches the contract's "bcrypt-hashed" description without framework framing.

4. **springdoc in v1?** Recommendation: defer entirely (EXPR-05); check-contracts Stage 5 already asserts operationIds statically. Revisit if Verify wants live conformance — then budget for semantic normalization (Pitfall 7).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | Testcontainers (D-07), compose up | ✓ (installed) | 29.4.0 | — |
| Docker daemon running | Same | **✗ at research time** | — | Start Docker Desktop before any `./mvnw test` / `compose up` (hard blocker, no fallback) |
| Docker Compose v2 | Orchestration | ✓ | v5.1.1 | — |
| JDK (host) | `./mvnw test`, wrapper builds | ✓ (wrong major?) | **23.0.1** vs D-08's 21 | `maven.compiler.release=21` (works on 23) or install Temurin 21 |
| curl | smoke-auth.sh, ad-hoc probing | ✓ | 8.12.1 (mingw64) | — |
| jq | (would simplify smoke parsing) | ✗ | — | sed/regex extraction (Pattern in Code Examples) |
| openssl | JWT_SECRET generation (`rand -base64 32`) | ✓ | 3.2.4 | `node -e crypto.randomBytes` alternative |
| node/npx | check-contracts.sh (Spectral CLI) | ✓ (present — used in Phase 1) | — | — |

**Missing dependencies with no fallback:**
- Running Docker daemon — must be started by the executor before Wave containing Testcontainers/compose tasks.

**Missing dependencies with fallback:**
- jq (absent) → scripted extraction; JDK 21 literal (host has 23) → release-flag compile.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | JUnit 5 + AssertJ + Spring Boot Test (Boot 3.5.16-managed), Testcontainers 1.21.x |
| Config file | none yet — created in Wave 0 (`pom.xml` test deps + `src/test/java` tree) |
| Quick run command | `cd services/auth-service && ./mvnw -q test -Dtest=UserServiceTests` (unit slice, no Docker) |
| Full suite command | `cd services/auth-service && ./mvnw test` (includes Testcontainers slice; requires Docker daemon) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | signup 201; duplicate → 409 code=DUPLICATE_EMAIL; stored value is bcrypt ($2a$ prefix), not plaintext/reversible | unit + integration | `./mvnw test -Dtest=AuthFlowIntegrationTests` | ❌ Wave 0 |
| AUTH-01b | malformed email / short password (<8) → 400 code=VALIDATION_FAILED | unit (validator) + MockMvc | `./mvnw test -Dtest=AuthWebValidationTests` | ❌ Wave 0 |
| AUTH-02 | valid creds → 200 with 3-segment JWT carrying sub/email/roles/iss/aud/exp; wrong password & unknown email → identical 401 envelope | integration | `./mvnw test -Dtest=AuthFlowIntegrationTests#login*` | ❌ Wave 0 |
| AUTH-03 | `/me` with fresh token → 200 matching User shape; no token, garbage token, expired(+61s) token → 401 | integration | `./mvnw test -Dtest=AuthFlowIntegrationTests#me*` | ❌ Wave 0 |
| AUTH-04 | logout-by-doc: `POST /auth/logout` yields 404/405 (endpoint absent); service README states client-side discard | smoke/manual | `scripts/smoke-auth.sh` (asserts absence) + README line | ❌ Wave 0 |
| SC-5 (infra) | Flyway migrates cleanly on postgres:18 (uuid PK, text[] roles survive round-trip) | integration (Testcontainers) | included in AuthFlowIntegrationTests boot | ❌ Wave 0 |
| SC-5 (container) | image builds; compose healthcheck passes; end-to-end signup→login→/me via :8081 | smoke (manual-at-phase, chained in Ph9) | `bash scripts/smoke-auth.sh` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** quick unit slice `./mvnw -q test -Dtest=UserServiceTests`
- **Per wave merge:** `./mvnw test` full suite (Testcontainers slice green)
- **Phase gate:** full suite green + `scripts/check-contracts.sh` pass + `docker compose up` healthy + `smoke-auth.sh` ALL PASS before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `pom.xml` with parent 3.5.16 + all dependencies above + maven wrapper committed
- [ ] `src/main/resources/db/migration/V1__create_users.sql`
- [ ] `src/test/java/com/ecommerce/auth/web/AuthFlowIntegrationTests.java` — covers AUTH-01/02/03 + SC-5 infra row
- [ ] `scripts/smoke-auth.sh` — covers AUTH-04 + SC-5 container row (LF endings)
- [ ] `.env` locally generated (not committed) with `JWT_SECRET=$(openssl rand -base64 32)`

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | bcrypt (`BCryptPasswordEncoder`), min-length 8 per contract, uniform 401 anti-enumeration, no password recovery path |
| V3 Session Management | yes | Fully stateless — `SessionCreationPolicy.STATELESS`; short-TTL bearer tokens (3600 s); no cookies in this phase (cookie transport is Phases 7/8 per interop doc) |
| V4 Access Control | yes | `/auth/me` identity exclusively from verified `sub` claim resolved server-side (contract-mandated); deny-all default in filter chain |
| V5 Input Validation | yes | jakarta-validation (`@Email`, `@NotBlank`, `@Size(min=8)`) → 400 `VALIDATION_FAILED`; typed DTO records; additionalProperties tolerated reader-side per interop Rule 5 |
| V6 Cryptography | yes | HS256 via nimbus-jose-jwt (never hand-roll HMAC); CSPRNG secret ≥32 bytes; startup length assertion; secret never logged/committed |
| V7 Error Handling/Logging | yes | Unified `{code,message}` envelope; internal causes logged server-side only; messages leak no hostnames/drivers (contract text) |
| V14 Configuration | yes | Non-root container user; DB publishes no host port; secret holders restricted to auth-service + gateway |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Algorithm confusion (RS/HS swap, `alg:none`) | Tampering/Elevation | Pin HS256 at encoder header AND decoder key type; verifier accepts only MAC-family keys (Patterns 1–2) |
| User enumeration via error/timing differences | Information Disclosure | Identical 401 envelope + dummy-hash compare for unknown accounts |
| Credential stuffing | Elevation | Gateway rate-limiting arrives Phase 7 (GTWY-05); document residual risk in service docs for v1 |
| Weak/offline-crackable secrets | Elevation | CSPRNG ≥32 bytes + startup assertion (interop law); bcrypt work factor for stored creds |
| Secret leakage into logs/images | Information Disclosure | Env-var injection only; log length not content; `.env` gitignored from commit one; never baked into image layers |
| SQL injection | Tampering | JPA parameterized queries only; zero string-concatenated SQL |
| Timing attacks on credential compare | Information Disclosure | `BCryptPasswordEncoder.matches` constant-time comparison |
| Mass assignment | Tampering | Dedicated request DTOs (email/password only) — role/id/createdAt set server-side |

## Sources

### Primary (HIGH confidence)
- docs.spring.io/spring-security/reference/features/authentication/password-storage.html — DelegatingPasswordEncoder format, BCrypt strength defaults/tuning
- docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html — minimal deps, RS256-only default, `withSecretKey()`, `jws-algorithms`, `audiences`, sub→getName()
- docs.spring.io/site/docs/current/api/.../NimbusJwtEncoder.html + JwtTimestampValidator.html — constructor/method signatures (Since tags)
- docs.spring.io/spring-boot/3.5/reference/testing/testcontainers.html (v3.5.16 docs) — @ServiceConnection, spring-boot-testcontainers, connection-details table
- docs.jboss.org/hibernate/orm/6.6/userguide — SqlTypes.ARRAY default mapping, @UuidGenerator RANDOM default, preferred_uuid_jdbc_type
- In-repo (read this session): docs/api-contracts/auth-service.openapi.yaml (lines 20-38, 50-146, 153-198), docs/api-contracts/_shared.yaml (69-131), docs/json-interop.md (16-33, 97-139), docs/versions.md (14-34), .env.example (13-41), docker-compose.yml (4-14), scripts/check-contracts.sh (37-126), .gitattributes, .planning/STATE.md

### Secondary (MEDIUM confidence)
- search.maven.org Solr API — coordinate existence checks (this session, all numFound:1)
- stackoverflow.com/q/57515333 + marmo.dev/deploy-spring-with-docker — alpine wget/curl availability, healthcheck forms, MaxRAMPercentage practice
- github.com/mrts/docker-postgresql-multiple-databases + SO q/46668233 — initdb.d once-only semantics, multi-db script pattern
- codersee.com/flyway-migrations-with-spring-boot, GH springdoc/springdoc-openapi#3041, mvnrepository.com — flyway-database-postgresql requirement; springdoc 2.8.x ↔ Boot 3.5 compatibility floor 2.8.9

### Tertiary (LOW confidence)
- None outstanding — all LOW items were escalated to Assumptions Log instead.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version rides the project-pinned Boot parent; coordinates registry-verified
- Architecture: HIGH — patterns sourced from official Spring Security/Boot/Hibernate docs matched against frozen contracts read this session
- Pitfalls: HIGH for contract-derived items (millisecond law, initdb.d semantics, PG18 volume); MEDIUM for A1/A2/A5 behavioral nuances flagged in Assumptions Log
- Environment: MEDIUM — probes ran this session, but Docker daemon state can change between sessions

**Research date:** 2026-08-25
**Valid until:** 2026-09-24 (30 days — pinned-stack phase; re-verify springdoc/Testcontainers minors if deferred past window)
