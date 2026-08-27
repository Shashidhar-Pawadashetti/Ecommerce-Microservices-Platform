# Phase 03: Catalog Service - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 22 (20 new service files + 1 modified root compose + 1 docs note)
**Analogs found:** 16 / 22 reference auth-service structure, the OpenAPI contract, or json-interop.md; 6 have no prior code analog (Mongo/Python-specific).

> **Context note:** Catalog is the **first Python/FastAPI service** in the repo. There is no Python code to copy from. The "closest analog" for repo conventions (layout, Dockerfile, compose/healthcheck, error envelope, JWT verify, Testcontainers tests) is the **auth-service Java skeleton** — copy its *conventions*, not its Java. The Python *implementation* patterns come from `03-RESEARCH.md` (Patterns 1–6) and must obey `docs/api-contracts/catalog-service.openapi.yaml` (frozen) and `docs/json-interop.md` (Rules 1–5).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/catalog-service/Dockerfile` | config/infra | build | `services/auth-service/Dockerfile` | convention-analog |
| `services/catalog-service/pyproject.toml` (or `requirements.txt`) | config | n/a | `services/auth-service/pom.xml` (layout) | convention-analog |
| `services/catalog-service/.env.example` | config | n/a | root `.env.example` | exact (same var names) |
| `services/catalog-service/README.md` | doc | n/a | `services/auth-service/README.md` | convention-analog |
| `services/catalog-service/app/__init__.py` | module | n/a | `services/auth-service/src/main/java/.../AuthServiceApplication.java` (package init) | convention-analog |
| `services/catalog-service/app/main.py` | controller/app | request-response | `services/auth-service/src/main/resources/application.yml` (lifespan/health) + `GlobalExceptionHandler.java` | convention-analog |
| `services/catalog-service/app/config.py` | config/settings | n/a | `services/auth-service/src/main/resources/application.yml` + `JwtConfig.java` | convention-analog |
| `services/catalog-service/app/security.py` | middleware/security | request-response | `services/auth-service/src/main/java/.../security/RestAuthenticationEntryPoint.java` + `config/JwtConfig.java` + `config/JwtSecretAssertion.java` | convention-analog (CRITICAL) |
| `services/catalog-service/app/models.py` | model | transform (serialize) | `services/auth-service/src/main/java/.../web/dto/UserResponse.java` + `_shared.yaml` + `json-interop.md` | spec-only (Pydantic new) |
| `services/catalog-service/app/db.py` | service/db | CRUD | **none** (first Mongo/Python) — use `03-RESEARCH.md` Pattern 5 | no-analog |
| `services/catalog-service/app/routes.py` | controller | request-response | `services/auth-service/src/main/java/.../web/AuthController.java` + contract | convention-analog |
| `services/catalog-service/scripts/seed.py` | utility/script | batch/CRUD | **none** — use `03-RESEARCH.md` Pattern 4 | no-analog |
| `services/catalog-service/scripts/gen_placeholders.py` | utility | n/a | **none** (optional) | no-analog |
| `services/catalog-service/static/products/*.svg` | asset | file-I/O | **none** | no-analog |
| `services/catalog-service/tests/conftest.py` | test-fixture | n/a | `services/auth-service/src/test/java/.../AuthFlowIntegrationTests.java` | convention-analog |
| `services/catalog-service/tests/test_list.py` | test | request-response | `AuthFlowIntegrationTests.java` | convention-analog |
| `services/catalog-service/tests/test_get.py` | test | request-response | `AuthFlowIntegrationTests.java` | convention-analog |
| `services/catalog-service/tests/test_admin.py` | test | request-response | `AuthFlowIntegrationTests.java` | convention-analog |
| `services/catalog-service/tests/test_seed.py` | test | batch | `AuthFlowIntegrationTests.java` | convention-analog |
| `services/catalog-service/tests/test_models.py` | test | transform | `AuthFlowIntegrationTests.java` (ms regex) | convention-analog |
| `services/catalog-service/pytest.ini` (or pyproject `[tool.pytest.ini_options]`) | config | n/a | `services/auth-service/pom.xml` (test config) | convention-analog |
| `docker-compose.yml` (**MODIFY**) | config/infra | n/a | existing root `docker-compose.yml` (auth-service + postgres blocks) | exact (extend) |
| `docs/runbook.md` (DOCS-02, note deviation) | doc | n/a | — (Phase 10 file; note the 3-holder JWT deviation now) | no-analog |

---

## Pattern Assignments

### `services/catalog-service/Dockerfile` (config/infra)

**Analog:** `services/auth-service/Dockerfile` (lines 1–30)

Copy the **multi-stage + non-root + pinned-base** shape, but adapt to Python 3.13-slim. Key conventions to preserve:
- Pin the base image by digest/tag per `docs/versions.md` (`python:3.13-slim`); do not substitute tags.
- Run as a **non-root user** (auth-service lines 22–25: `addgroup -S spring && adduser -S spring`).
- `EXPOSE` the service port (catalog uses `8000`, mirroring auth-service `8081` transitional port — see Open Question 3 in research; revoke in Phase 7).
- Memory posture: pair any container flag with a compose `mem_limit` (auth-service `Dockerfile` lines 7–8 + compose `mem_limit: 512m`).

**Auth-service reference (lines 22–29):**
```dockerfile
# ---- runtime stage: JRE only, non-root ----
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S spring && adduser -S spring
USER spring
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

**Catalog adaptation (target — derive from research "Dockerfile" note, line 152):**
```dockerfile
# build: python:3.13-slim (compile n/a for Python; single runtime stage ok)
# runtime: python:3.13-slim, non-root user app
FROM python:3.13-slim
RUN groupadd -r app && useradd -r -g app app
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .
COPY . .
USER app
EXPOSE 8000
# uvicorn (via fastapi[standard]); no root needed
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
> Do **NOT** copy the `wget`-based healthcheck inside the image — `python:3.13-slim` is Debian-based and ships no `wget`/`curl`. The compose healthcheck must use a `python -c` one-liner (see Shared Patterns → Healthcheck).

---

### `services/catalog-service/pyproject.toml` + `.env.example` + `README.md` (config/doc)

**Analog:** `services/auth-service/pom.xml` (layout), root `.env.example` (lines 1–41), `services/auth-service/README.md` (lines 1–55)

- **Dependency versions are pinned by research `Standard Stack` table** (FastAPI 0.141.1, Pydantic 2.13.4, pydantic-settings 2.15.0, pymongo>=4.9, PyJWT 2.13.0, uvicorn via fastapi[standard]). Do not re-verify on npm (research line 81).
- **`.env.example` variable NAMES are contractual** — mirror root `.env.example` exactly. Catalog needs: `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_TTL_SECONDS`, `MONGO_URI` (root `.env.example` lines 15–19, 40 already declare these). Add nothing that renames existing keys.
- **README** mirrors auth-service README structure: endpoint table (method/path/auth/purpose), env var table, memory posture, run/test/smoke commands.

**Root `.env.example` relevant lines (15–19, 40):**
```bash
# ── Auth / JWT (issued by auth-service, verified by api-gateway) ─────
JWT_SECRET=<long-random-secret-change-me>
JWT_ISSUER=ecommerce-auth
JWT_AUDIENCE=ecommerce-api
JWT_TTL_SECONDS=3600
# ...
MONGO_URI=mongodb://mongo:27017
```

---

### `services/catalog-service/app/main.py` (controller/app, request-response)

**Analog:** `services/auth-service/src/main/resources/application.yml` (lifespan/health, lines 16–20) + `GlobalExceptionHandler.java` (custom envelope handlers) + `03-RESEARCH.md` "App skeleton" (lines 372–402)

Copy the **lifespan-startup + custom-exception-handler + static-mount** shape. Catalog replaces Spring's `/actuator/health` with its own `GET /health` (contract line 326–351). Register the contract-faithful exception handlers (research Pattern 2) so 400/401/404 emit `{"code","message"}`, never FastAPI's `{"detail":...}`.

**Auth-service health exposure (application.yml lines 16–20):**
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health
```
> Catalog analog: a `GET /health` returning `{"status":"ok"}` (contract `/health` 200 example, line 350–351). This is the compose healthcheck target.

**Research App skeleton (lines 388–401) — the pattern to copy:**
```python
app = FastAPI(
    title="Catalog Service API", version="1.0.0", lifespan=lifespan,
    openapi_extra={"components": {"securitySchemes": {
        "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}}}})
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "products")
app.mount("/catalog/static", StaticFiles(directory=STATIC_DIR), name="catalog-static")
# register exception handlers (Pattern 2) here, then:
app.include_router(routes.router)
```
> **Pitfall (research line 322–326):** set `operation_id="listProducts"` etc. on every route and declare `bearerAuth` via `openapi_extra` so `scripts/check-contracts.sh` Stage 5 (operationId coverage) and Spectral lint pass.

---

### `services/catalog-service/app/config.py` (config/settings)

**Analog:** `services/auth-service/src/main/resources/application.yml` (env binding, lines 22–31) + `JwtConfig.java` (`@Value` injection, lines 49–60) + `03-RESEARCH.md` pydantic-settings note (line 46)

Use `pydantic-settings.BaseSettings` to bind the **same contractual env var names** auth-service uses. Critically, `JWT_SECRET` is **base64-encoded** in `.env` (auth-service decodes it before use — see Shared Patterns → JWT verification). Mirror that: decode `JWT_SECRET` from base64 into raw bytes at settings load, and assert `len(decoded) >= 32` at startup (mirrors `JwtSecretAssertion.java`).

**Auth-service env binding (application.yml lines 22–31):**
```yaml
jwt:
  secret: ${JWT_SECRET:bG9jYWwtZGV2LW9ubHktc2lnbmluZy1zZWNyZXQtMzJieXRlcw==}
  issuer: ${JWT_ISSUER:ecommerce-auth}
  audience: ${JWT_AUDIENCE:ecommerce-api}
  ttl-seconds: ${JWT_TTL_SECONDS:3600}
```

**Auth-service JwtConfig injection (lines 49–60):**
```java
@Bean JwtEncoder jwtEncoder(@Value("${jwt.secret}") String base64Secret) { ... }
@Bean JwtDecoder jwtDecoder(@Value("${jwt.secret}") String base64Secret,
                             @Value("${jwt.issuer}") String issuer,
                             @Value("${jwt.audience}") String audience) { ... }
```

**Research settings note (line 46):** `pydantic-settings==2.15.0` — matches env-var convention used by auth-service.

---

### `services/catalog-service/app/security.py` (middleware/security, request-response) — **CRITICAL**

**Analog:** `services/auth-service/src/main/java/com/ecommerce/auth/security/RestAuthenticationEntryPoint.java` (UNAUTHORIZED envelope, lines 27–47) + `config/JwtConfig.java` (decoder + validator chain, lines 57–75) + `config/JwtSecretAssertion.java` (startup length assertion, lines 18–43) + `03-RESEARCH.md` Pattern 1 (lines 183–214)

This is the most important analog. Catalog must **self-verify** HS256 JWTs (gateway doesn't exist in Phase 3 — research line 11, CAT-06). Copy three behaviors from auth-service:

1. **Single byte-identical 401 envelope** on every auth failure (missing/expired/invalid/alg-swap) — exactly the `_shared.yaml` `Unauthorized` example. Do NOT let failures leak which case.
2. **Algorithm pinning + claim validation** (iss `ecommerce-auth`, aud `ecommerce-api`, exp with ±60s skew) via PyJWT `algorithms=["HS256"]` only.
3. **Startup secret-length assertion** (≥32 decoded bytes), fail-fast.

**`RestAuthenticationEntryPoint.java` — the contracted envelope (lines 31–32, 43–46):**
```java
public static final ApiError UNAUTHORIZED_ENVELOPE =
        new ApiError("UNAUTHORIZED", "Authentication required or credentials invalid.");
// ...
response.setStatus(HttpStatus.UNAUTHORIZED.value());
response.setContentType(MediaType.APPLICATION_JSON_VALUE);
MAPPER.writeValue(response.getOutputStream(), UNAUTHORIZED_ENVELOPE);
```

**`JwtConfig.java` — how auth-service derives the HMAC key (LINE 61 IS THE KEY DETAIL):**
```java
SecretKey key = new SecretKeySpec(Base64.getDecoder().decode(base64Secret), "HMACSHA256");
NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).build();
OAuth2TokenValidator<Jwt> skew = new JwtTimestampValidator(Duration.ofSeconds(60));
OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(issuer);
OAuth2TokenValidator<Jwt> audienceValidator =
        new JwtClaimValidator<>(JwtClaimNames.AUD, aud -> aud != null && asAudList(aud).contains(audience));
decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(skew, issuerValidator, audienceValidator));
```

> ⚠️ **CROSS-CUTTING MUST:** auth-service signs with the **base64-decoded** secret (line 61). Catalog MUST decode `JWT_SECRET` the same way before calling `jwt.decode(...)`, or the signature will never validate. `PyJWT` `jwt.decode(secret_bytes, algorithms=["HS256"], audience=..., issuer=...)` with `secret_bytes = base64.b64decode(settings.jwt_secret)`. The `require_auth` research example (lines 201–207) passes `settings.jwt_secret` directly — **update it to pass the decoded bytes**.

**`JwtSecretAssertion.java` — startup gate (lines 30–43):**
```java
int decodedBytes = Base64.getDecoder().decode(base64Secret).length;
if (decodedBytes < 32) {
    throw new IllegalStateException("jwt.secret too short: " + decodedBytes + " bytes decoded; minimum 32");
}
log.info("JWT signing secret present ({} decoded bytes)", decodedBytes); // length ONLY, never value
```

**Research Pattern 1 `require_auth` (lines 191–213) — copy with the base64-decode fix:**
```python
def require_auth(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED",
            "message": "Authentication required or credentials invalid."})
    try:
        return jwt.decode(creds.credentials, settings.jwt_secret_bytes,  # decoded bytes!
            algorithms=["HS256"], audience=settings.jwt_audience, issuer=settings.jwt_issuer)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED",
            "message": "Authentication required or credentials invalid."})
```

---

### `services/catalog-service/app/models.py` (model, transform)

**Analog:** `services/auth-service/src/main/java/com/ecommerce/auth/web/dto/UserResponse.java` (response shape) + `docs/api-contracts/_shared.yaml` (envelope, lines 68–91) + `docs/json-interop.md` (Rules 1–5) + `03-RESEARCH.md` Pattern 3 (lines 247–269)

No Python Pydantic analog exists; the contract + interop law are authoritative. Copy the **interop serialization discipline** exactly:
- **Rule 1:** `createdAt` → 3-digit ms + `Z` via `field_serializer` (research lines 251–268). Never emit 6-digit microseconds.
- **Rule 2:** `priceCents: int` (ge=0). No floats.
- **Rule 3:** `id: str` (string on wire; map Mongo `_id` → `id`).
- **Rule 4:** `response_model_exclude_none=True` so optional `description`/`imageUrl` are omitted, never `null`.
- **Rule 5:** `model_config = ConfigDict(extra="ignore")` (tolerate unknown, mirror interop line 92).

**Research Pattern 3 (lines 255–268) — copy verbatim:**
```python
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")   # Rule 5
    id: str
    name: str
    description: str | None = None
    category: str
    priceCents: int = Field(ge=0)               # Rule 2
    stock: int = Field(ge=0)
    imageUrl: str | None = None
    createdAt: datetime                          # Rule 1

    @field_serializer("createdAt")
    def _ser(self, v: datetime) -> str:
        return _iso_ms(v)
```
> The `Product`/`ProductWrite`/`ProductList`/`BatchPricingEntry` shapes MUST match `docs/api-contracts/catalog-service.openapi.yaml` `components.schemas` (lines 359–464) field-for-field. `ProductWrite` excludes `id`/`createdAt` (mass-assignment guard, research line 648).

---

### `services/catalog-service/app/routes.py` (controller, request-response)

**Analog:** `services/auth-service/src/main/java/com/ecommerce/auth/web/AuthController.java` (route + operationId + envelope + security, lines 40–85) + `GlobalExceptionHandler.java` + `03-RESEARCH.md` Patterns 2 & 5 + code examples (lines 404–454)

Copy the **explicit `operation_id` + `security` per route + envelope shapes** discipline. Auth-service stamps `operationId: signup/login/getMe` (controller doc lines 28–33) and returns the shared 401 envelope (lines 81–84). Catalog must do the same for `listProducts/createProduct/batchGetProducts/getProduct/updateProduct/deleteProduct/health`.

**Auth-service route + operationId discipline (lines 28–33, 49–53):**
```java
// POST /auth/signup [operationId: signup] → 201 User | 409 DUPLICATE_EMAIL
@PostMapping("/auth/signup")
ResponseEntity<UserResponse> signup(@Valid @RequestBody SignupRequest request) {
    User user = userService.signup(request.email(), request.password());
    return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user));
}
```

**Research list route (lines 414–435) — copy; note `response_model_exclude_none=True` + `operation_id`:**
```python
@router.get("/catalog/products", operation_id="listProducts",
            response_model=ProductList, response_model_exclude_none=True)
async def list_products(category: str | None = None, q: str | None = None,
    sort: str = Query("name", pattern="^(price|name)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    ...
    return ProductList(items=items, total=total, limit=limit, offset=offset)
```
**Research admin create (lines 440–451)** — protected route uses `dependencies=[Depends(require_auth)]` + `openapi_extra={"security": [{"bearerAuth": []}]}`; returns 201 `Product`.

**Pitfall (research line 346–349):** register `POST /catalog/products/batch` BEFORE `GET /catalog/products/{id}` so the path param never swallows it.

---

### `services/catalog-service/app/db.py` (service/db, CRUD) — **no-analog (first Mongo/Python)**

No existing code analog. Implement from `03-RESEARCH.md` Pattern 5 (lines 287–291) + interop Rule 3 (`_id` → `id` mapping on read). Use `pymongo.AsyncMongoClient` (>=4.9), **never Motor** (research line 62). Ensure the `category` index and the **single** `text` index on `{name, description}` idempotently at startup (`ensure_indexes`), mirroring auth-service's "validate catches entity/migration drift early" startup posture (application.yml lines 11–14).

**Research Pattern 5 (lines 287–291):**
```python
# exactly one text index per collection; create idempotently at startup
# category exact-match + $text search; if q absent, omit the $text clause
# map _id -> id on every read (interop Rule 3)
```

---

### `services/catalog-service/scripts/seed.py` (utility, batch/CRUD) — **no-analog**

No existing code analog. Implement idempotent upsert from `03-RESEARCH.md` Pattern 4 (lines 277–285). Stable string `_id` (`prod-1001`…`prod-1020`), `$setOnInsert` for `createdAt` so re-runs are no-ops. `imageUrl = "/catalog/static/products/{id}.svg"` (research Pattern 6, lines 293–296).

**Research Pattern 4 (lines 279–284):**
```python
await products_coll.update_one(
    {"_id": p["id"]},
    {"$set": {k: v for k, v in p.items() if k not in ("id", "createdAt")},
     "$setOnInsert": {"createdAt": p["createdAt"], "id": p["id"]}},
    upsert=True)
```

---

### `services/catalog-service/tests/conftest.py` + `tests/test_*.py` (test) — **convention-analog**

**Analog:** `services/auth-service/src/test/java/com/ecommerce/auth/web/AuthFlowIntegrationTests.java` (lines 41–62, 47–56, 104) — Testcontainers + exact-envelope byte-match + ms-timestamp regex.

Copy the **test discipline**:
1. **Testcontainers** spins the real datastore (`mongo:8.0`, mirroring `new PostgreSQLContainer<>("postgres:18")` at line 62). Use `@pytest.fixture` + `MongoDbContainer("mongo:8.0")` (research conftest lines 479–483).
2. **Exact envelope assertions** — define `UNAUTHORIZED_BODY`, `VALIDATION_BODY`, `NOT_FOUND_BODY` constants matching `_shared.yaml` examples byte-for-byte (auth-service lines 47–56 define `DUPLICATE_BODY`/`VALIDATION_BODY`/`UNAUTHORIZED_BODY` and asserts `content().string(equalTo(...))`).
3. **ms-timestamp regex** on `createdAt` (auth-service line 104: `matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z")`) — catalog `test_models.py` must assert Rule 1.
4. **Token-minting fixture** for admin tests (research conftest lines 495–503 mints a valid HS256 token with `iss=ecommerce-auth`, `aud=ecommerce-api`; reuse for `test_admin.py` 401/201 coverage).

**Auth-service exact-envelope constants (lines 47–56):**
```java
private static final String DUPLICATE_BODY =
    "{\"code\":\"DUPLICATE_EMAIL\",\"message\":\"An account with this email already exists.\"}";
private static final String VALIDATION_BODY =
    "{\"code\":\"VALIDATION_FAILED\",\"message\":\"Request validation failed. Check field formats and limits.\"}";
private static final String UNAUTHORIZED_BODY =
    "{\"code\":\"UNAUTHORIZED\",\"message\":\"Authentication required or credentials invalid.\"}";
```
> Catalog equivalents from `_shared.yaml`: `UNAUTHORIZED` (lines 108–110), `NOT_FOUND` (lines 117–119), `VALIDATION_FAILED` (lines 99–101). `test_admin.py` must also mimic auth-service's algorithm-swap / expired / foreign-signed 401 proofs (lines 282–376) for CAT-06.

**Auth-service Testcontainers + ms assertion (lines 60–62, 104):**
```java
@Container @ServiceConnection
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:18");
// ...
assertThat(createdAt).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z");
```

---

### `docker-compose.yml` (**MODIFY**) — extend existing

**Analog:** root `docker-compose.yml` `auth-service` + `postgres` blocks (lines 18–70)

Add a `mongo` service (image `mongo:8.0`, no host port, healthcheck) and a `catalog-service` service (build `./services/catalog-service`, transitional `8000:8000` port per research Open Question 3, `mem_limit`, `depends_on: mongo: service_healthy`, env wiring, healthcheck against `/health`). Preserve the file's incremental-growth header convention (lines 1–16).

**Existing auth-service block to mirror (lines 43–67):**
```yaml
auth-service:
  build: ./services/auth-service
  ports:
    - "8081:8081"
  mem_limit: 512m
  environment:
    JWT_SECRET: ${JWT_SECRET}
    JWT_ISSUER: ${JWT_ISSUER}
    JWT_AUDIENCE: ${JWT_AUDIENCE}
    JWT_TTL_SECONDS: ${JWT_TTL_SECONDS}
  depends_on:
    postgres:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://localhost:8081/actuator/health | grep UP || exit 1"]
    interval: 15s
    timeout: 5s
    retries: 5
    start_period: 60s
```
> Catalog adaptation: `catalog-service` mirrors this but `depends_on: mongo: condition: service_healthy`, `MONGO_URI: ${MONGO_URI}`, and healthcheck hits `http://localhost:8000/health`. See Shared Patterns → Healthcheck for the `python -c` form (no wget in slim).

---

## Shared Patterns

### 1. Unified Error Envelope (apply to `main.py`, `security.py`, `routes.py`, `models.py`)
**Source:** `docs/api-contracts/_shared.yaml` `Error` schema (lines 68–91) + `services/auth-service/.../support/ApiError.java` (lines 1–9) + `GlobalExceptionHandler.java` (lines 26–31, 55–59)
Every error response is `{"code": <MACHINE>, "message": <HUMAN>}` — never FastAPI's `{"detail":...}`, never leak internals. Catalog codes used: `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_FAILED`. Mirror the auth-service single-source-of-truth envelope (one constant, reused everywhere).

### 2. JWT Self-Verification — **CRITICAL CROSS-CUTTING** (apply to `config.py`, `security.py`)
**Source:** `services/auth-service/config/JwtConfig.java` (lines 57–75) + `security/RestAuthenticationEntryPoint.java` (lines 31–32) + `config/JwtSecretAssertion.java` (lines 30–43)
- Decode `JWT_SECRET` from **base64** into raw bytes before `jwt.decode` (auth-service line 61) — must match the issuer or signatures fail.
- `algorithms=["HS256"]` only; validate `iss=ecommerce-auth`, `aud=ecommerce-api`, `exp` ±60s skew.
- One byte-identical 401 envelope for all auth failures (anti-enumeration, T-02-02).
- Startup assertion: `len(base64.b64decode(JWT_SECRET)) >= 32`, fail-fast, log length only.
- **Deviation to record (research line 651, json-interop.md line 129):** catalog becomes a 3rd `JWT_SECRET` holder in v1 (auth-service + gateway are the canonical two). Note in `docs/runbook.md` (DOCS-02) now; keep self-verify as defense-in-depth post-Phase-7.

### 3. JSON Interop Serialization (apply to `models.py`, every response)
**Source:** `docs/json-interop.md` Rules 1–5 (lines 16–93)
- Rule 1: `createdAt` → exactly 3-digit ms + `Z`.
- Rule 2: money as `int` `*Cents`, never float.
- Rule 3: all IDs are `str` on the wire (`_id` → `id`).
- Rule 4: omit optional keys, never `null` (`response_model_exclude_none=True`).
- Rule 5: `extra="ignore"` (tolerate unknown; writers stay schema-closed).

### 4. Testcontainers + Envelope Byte-Match Tests (apply to `tests/*`)
**Source:** `services/auth-service/.../AuthFlowIntegrationTests.java` (lines 47–56, 60–62, 104, 182–376)
Spin real `mongo:8.0`; assert exact `_shared.yaml` envelope bodies; assert `createdAt` ms regex; cover token-missing/expired/foreign-signed/alg-swap → 401 (CAT-06).

### 5. Dockerfile / Compose / Healthcheck Conventions (apply to `Dockerfile`, `docker-compose.yml`)
**Source:** `services/auth-service/Dockerfile` (lines 22–29) + root `docker-compose.yml` (lines 43–67)
- Non-root runtime user; pin base image per `docs/versions.md`; pair image flag with `mem_limit`.
- Transitional host port `8000:8000` in Phases 3–6, revoked Phase 7 (research Open Question 3).
- **Healthcheck adaptation:** `python:3.13-slim` has no `wget`/`curl`. Use:
  ```yaml
  healthcheck:
    test: ["CMD-SHELL", "python -c \"import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)\""]
    interval: 15s
    timeout: 5s
    retries: 5
    start_period: 30s
  ```
- `depends_on: mongo: condition: service_healthy`; `MONGO_URI: ${MONGO_URI}`; gateway/other env from `.env`.

### 6. Contract Faithfulness Gate (apply to `routes.py`, `main.py`)
**Source:** `scripts/check-contracts.sh` (lines 48–53 Spectral lint, 128–140 operationId coverage) + `docs/api-contracts/catalog-service.openapi.yaml`
Set `operation_id` on every route matching the contract; declare `bearerAuth` via `openapi_extra`; run `bash scripts/check-contracts.sh` in the phase gate (research line 588). Spectral `--fail-severity=warn` makes any contract drift fatal.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `services/catalog-service/app/db.py` | service | CRUD | First MongoDB/Python consumer; no prior Mongo code. Use `03-RESEARCH.md` Pattern 5 + interop Rule 3. |
| `services/catalog-service/app/models.py` | model | transform | First Pydantic models; Java DTOs only show envelope shape. Use contract `components.schemas` + interop Rules. |
| `services/catalog-service/scripts/seed.py` | utility | batch | Idempotent Mongo upsert is new; no seed precedent. Use research Pattern 4. |
| `services/catalog-service/static/products/*.svg` | asset | file-I/O | First committed static assets; no analog. Use research Pattern 6. |
| `services/catalog-service/scripts/gen_placeholders.py` | utility | n/a | Optional generator; no analog. |
| `docs/runbook.md` (deviation note) | doc | n/a | Phase 10 file; only the 3-holder JWT deviation note is added now. |

---

## Metadata

**Analog search scope:** `services/auth-service/**` (Dockerfile, application.yml, SecurityConfig, JwtConfig, JwtSecretAssertion, RestAuthenticationEntryPoint, ApiError, GlobalExceptionHandler, AuthController, AuthFlowIntegrationTests, README), root `docker-compose.yml`, root `.env.example`, `docs/api-contracts/_shared.yaml`, `docs/api-contracts/catalog-service.openapi.yaml`, `docs/json-interop.md`, `scripts/check-contracts.sh`, `03-RESEARCH.md`.
**Files scanned:** 12 source trees / docs (auth-service Java + YAML/MD), 1 Python research doc.
**Pattern extraction date:** 2026-08-27
**Key deviations flagged:** Catalog is a 3rd `JWT_SECRET` holder (record in DOCS-02); `JWT_SECRET` MUST be base64-decoded before PyJWT verify to match auth-service's signer.
