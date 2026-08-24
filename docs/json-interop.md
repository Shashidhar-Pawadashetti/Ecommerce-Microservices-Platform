# JSON Interop Law — Cross-Language Serialization Contract

Three languages (Java/Spring, Python/FastAPI, Node.js) exchange JSON over HTTP and Kafka with
**zero shared types**. The five rules below are the law every wire payload obeys — REST bodies,
query parameters, and Kafka event payloads alike. They are cited by the OpenAPI specs in
`docs/api-contracts/*.openapi.yaml`, by `docs/kafka-topics.md`, and by every service phase plan.

**Precedence (schema wins over prose):** if any schema (OpenAPI YAML or a topic payload JSON
Schema) contradicts this document, the schema is authoritative — fix this doc to match.
Prose never licenses a shape a schema forbids, and vice versa: schemas encode these rules
(`type: string` IDs, `type: integer` money named `*Cents`, `format: date-time` timestamps),
so drift is mechanically lintable.

---

## Rule 1: Dates & times — ISO 8601 strings, millisecond precision, UTC

**Rule:** Every timestamp on the wire is an ISO 8601 string with millisecond precision in UTC.

**Wire-level constraint:** OpenAPI `type: string` + `format: date-time`; always render a `Z`
suffix (zero-offset UTC). Canonical example: `2026-08-24T12:00:00.123Z` — exactly three
fractional digits. Numeric epoch timestamps are forbidden for domain fields (`createdAt`,
`processedAt`, …). Documented exception: JWT `iat`/`exp` are epoch seconds because RFC 7519
mandates it — that is a token format rule, not a wire-payload rule.

**Per-runtime failure modes:**

| Runtime | Failure mode | Guard |
|---------|-------------|-------|
| Python / Pydantic | Pydantic happily parses microsecond input (6-digit fractions); serializing such a `datetime` emits microseconds, silently violating the 3-digit contract | Truncate to milliseconds before serialization (`datetime` must carry ms precision); assert on emitted examples |
| Java / Jackson | Default serialization of `java.time` types without configuration produces arrays (`[2026,8,24,…]`) or ISO strings without millis — drifts from the canonical form | Register `JavaTimeModule`, set `WRITE_DATES_AS_TIMESTAMPS=false`, use millisecond formatting |
| Node | `Date.prototype.toISOString()` natively yields ms-precision UTC `Z` — compliant by default | Risk only when constructing dates from numeric epoch inputs; keep domain timestamps as strings end-to-end |

## Rule 2: Money — integer minor units, `*Cents` field names

**Rule:** All monetary amounts travel as integers in minor units (cents). Field names end in
`Cents`: `priceCents`, `unitPriceCents`, `lineTotalCents`, `totalCents`.

**Wire-level constraint:** OpenAPI `type: integer` (64-bit range). Floats are forbidden on the
wire AND in documentation examples — an example carrying `9.99` teaches code generators and
readers the wrong type. Currency travels beside totals as an ISO 4217 string (e.g. `"USD"`).

**Per-runtime failure modes:** binary float rounding corrupts money across all three runtimes —
Python floats, Java `double`, and JS numbers all fail the same way (`0.1 + 0.2 ≠ 0.3`), so a
float price is wrong everywhere simultaneously. Integer cents are exact in all three. If a
runtime needs decimal arithmetic internally, convert at the boundary — the wire stays integer.

## Rule 3: Identifiers — string IDs everywhere on the wire

**Rule:** Every identifier (`userId`, `orderId`, `productId`) is a JSON **string**, even where
storage uses bigint/serial columns (PostgreSQL) or ObjectId hex (MongoDB). Storage type is a
storage concern; the wire sees strings.

**Wire-level constraint:** OpenAPI `type: string` on all ID fields. `format: int64` is
forbidden on any wire-facing ID — it makes generators emit number-typed clients.

**Per-runtime failure modes:** JavaScript consumers lose precision beyond
`Number.MAX_SAFE_INTEGER` (2^53 − 1): `JSON.parse` silently rounds a bigint ID like
`9007199254740993` to `...992`, producing phantom lookups that are miserable to debug. String
IDs make every runtime parse them losslessly.

## Rule 4: Nullability — optional means absent, not null

**Rule:** An optional field is communicated by omitting the key entirely. Explicit `null` is
forbidden unless a schema explicitly declares `nullable: true` (OpenAPI 3.0.3 discipline).
Readers MUST NOT require the presence of optional keys.

**Wire-level constraint:** Writers omit optional keys rather than sending `"field": null`.
Schemas mark genuinely nullable fields with `nullable: true` so tooling encodes the distinction.

**Per-runtime failure modes:** `"field": null` breaks strict readers that assume presence
implies value; in JS, `key in obj` vs truthiness checks conflate absent/null/0/""; in Python,
`dict.get(key)` returns `None` for both absent and explicit-null — treat `None` obtained via
absence as the only null path and never emit `None` for optional fields. This mirrors the
OpenAPI 3.0.x choice repo-wide (see `_shared.yaml` components).

## Rule 5: Unknown fields — receivers ignore, writers stay closed

**Rule:** Receivers MUST ignore unrecognized properties. This is a reader-side tolerance
policy that enables additive evolution — it is never license for writer-side sloppiness:
writers remain constrained to their declared schema shapes.

**Wire-level constraint:** Schemas leave `additionalProperties` at its tolerant default
(true/unset) unless a specific schema deliberately closes; any exception is declared
per-schema, not globally.

**Per-runtime failure modes:**

| Runtime | Failure mode | Guard |
|---------|-------------|-------|
| Java / Jackson | Hand-built `ObjectMapper`s default to `FAIL_ON_UNKNOWN_PROPERTIES=true` and throw on new fields, turning additive evolution into outages | Disable/configure tolerant: `mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)`; Spring Boot's auto-configured mapper already disables it — verify any hand-built mapper |
| Python / Pydantic | Models ignore extra keys by default, but a stray `extra="forbid"` config would hard-fail forward compatibility | Keep/document the `extra="ignore"` stance per model family |
| Node | Destructuring naturally ignores unknown keys | Only risk: strict validators added ad hoc |

---

## JWT Claims (canonical reference)

This section is the **single canonical home** of the JWT claims contract. The auth-service
spec's `bearerFormat` comment and `docs/kafka-topics.md` link here; they do not duplicate the
table. Phase 2 (auth-service issue side) and Phase 7 (gateway verify side) implement exactly:

| Claim | Type | Value / constraint |
|-------|------|--------------------|
| `sub` | string | userId |
| `email` | string | user email address |
| `roles` | array of string | role names (e.g. `["customer"]`) |
| `iss` | string literal | exactly `ecommerce-auth` |
| `aud` | string literal | exactly `ecommerce-api` |
| `iat` | integer | epoch seconds |
| `exp` | integer | epoch seconds; token TTL ≈ 3600 s; a ±60 s clock skew is accepted at verification |

**Algorithm — pinned, not negotiated:** HS256 is pinned **by name** on both the issue side
(auth-service) and the verify side (api-gateway). Algorithm negotiation is forbidden: the
verifier asserts the `alg` header equals `HS256` and rejects every other value (including
`none` and RS/HS confusion swaps) before signature checks.

**Cookie transport attributes** (values recorded here for Phases 2/7/8; enforcement is owned
by those phases): `httpOnly`; `SameSite=Lax`; `Path=/`.

Logout is client-side token discard by design (v1) — no server revocation endpoint exists;
see the auth spec's informational note.

## Secret Handling

The JWT signing secret (`JWT_SECRET`) is the highest-value credential in the platform:

1. **Generation:** CSPRNG only, minimum **32 bytes** (256 bits) — e.g. `openssl rand -base64 32`.
2. **Holders:** held exclusively by **auth-service** and **api-gateway** — exactly two services.
   No other service, container, or human-facing artifact ever receives it.
3. **Startup assertion:** both holders assert the secret's minimum length (≥ 32 bytes decoded)
   at startup and refuse to start otherwise — fail fast beats fail insecurely.
4. **Never logged:** the secret value must never appear in logs, error messages, stack traces,
   or diagnostics; log its presence/length, never its content.
5. **Never committed:** it lives only in `.env` (gitignored since commit one);
   `.env.example` carries the name with a placeholder value only.

v1 uses one shared symmetric secret across the two HS256 holders (symmetric signing implies
shared material); rotation procedure is deferred until the deployment arc needs it.
