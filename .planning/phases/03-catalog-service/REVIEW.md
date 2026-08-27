# Phase 03 (Catalog Service) — Code Review Report

**Reviewed:** 2026-08-27T18:19:00Z
**Depth:** standard
**Files Reviewed:** 17 source/support files
- `services/catalog-service/app/{config,models,db,security,routes,main}.py`
- `services/catalog-service/scripts/{seed,gen_placeholders}.py`
- `services/catalog-service/{Dockerfile,pyproject.toml,.dockerignore,.env.example}`
- `services/catalog-service/tests/*.py` (reviewed for behavior-contradiction only)
- `docker-compose.yml` (catalog + mongo additions)
- `docs/json-interop.md`, `docs/api-contracts/catalog-service.openapi.yaml` (contract rules)

**Status:** issues_found — **NO BLOCKING issues**. 4 WARNINGs (hardening/robustness), 4 INFOs (quality).

---

## Summary

The implementation is high quality and contract-faithful. Interop Rules 1–5 are correctly enforced: `iso_ms()` truncates to exactly 3-digit ms + `Z` (Rule 1), `priceCents` is `int` (Rule 2), `_id`→`id` string mapping (Rule 3), `response_model_exclude_none=True` omits optional keys (Rule 4), and `extra="ignore"` on every model (Rule 5). JWT verification pins `HS256` and validates `iss`/`aud` with a single byte-identical 401 envelope (anti-enumeration). Mutating routes are default-deny via `Depends(require_auth)`. `$text` search never interpolates raw JSON (no classic NoSQL injection). The error envelope is byte-exact via `separators=(",",":")`.

I did **not** find any behaviorally incorrect code, security vulnerability that is exploitable as-shipped, or data-loss risk. The findings below are hardening/robustness gaps and quality smells that should be addressed but do not block the phase.

---

## Warnings

### WR-01: Committed hardcoded fallback `JWT_SECRET` in source
**File:** `services/catalog-service/app/config.py:24`
**Issue:** `jwt_secret` has a committed literal default (`"sHwEj/+tlj4qr7PKfSqStWXV4ZnD4GPa9ImYNcXvHBM="`). When the service runs without `JWT_SECRET` in the environment (e.g. a bare `uvicorn app.main:app` local run, a test harness missing the env, or a misconfigured compose), it silently falls back to this publicly-known secret. Because `JWT_SECRET` is the *shared* platform secret, anyone who reads the repo can then forge admin tokens for this service — and, more dangerously, tokens accepted by the api-gateway (which uses the same secret). This directly contradicts `docs/json-interop.md` §Secret Handling rule #5 ("Never committed"). Compose mitigates this today (`JWT_SECRET: ${JWT_SECRET}` + `assert_secret_length()` fails fast on empty), but the in-source literal remains a live fallback.
**Fix:** Remove the default so startup fails loudly unless the secret is supplied, e.g.:
```python
jwt_secret: str  # no default — required from env / .env

# (assert_secret_length already raises if decoded < 32 bytes; an empty/missing
#  value raises RuntimeError at startup, matching fail-fast intent)
```
Alternatively default to `""` and rely on `assert_secret_length()`; the key point is that no usable secret value should ever live in source.

### WR-02: `jwt.decode` does not require the `exp` claim
**File:** `services/catalog-service/app/security.py:39-47`
**Issue:** `jwt.decode(..., algorithms=["HS256"], audience=..., issuer=..., leeway=60)` validates `exp` **only if present**. PyJWT's default behavior is to skip `exp`/`nbf`/`iat` checks when the claim is absent. A token signed with the correct secret but *lacking* `exp` is therefore accepted and never expires — a permanent credential. The contract (`docs/json-interop.md` JWT Claims) treats `exp` as mandatory. `tests/test_admin.py::test_invalid_token_401` covers expired/wrong-secret/alg-swap/alg-none/tampered, but never a token missing `exp`, so this gap is untested.
**Fix:** Enforce presence of the mandatory claims:
```python
return jwt.decode(
    creds.credentials,
    settings.jwt_secret_bytes,
    algorithms=["HS256"],
    audience=settings.jwt_audience,
    issuer=settings.jwt_issuer,
    leeway=60,
    options={"require": ["exp", "iss", "aud"]},
)
```

### WR-03: `ensure_indexes` swallows ALL `OperationFailure`, masking real index-creation failures
**File:** `services/catalog-service/app/db.py:33-47`
**Issue:** Both `create_index` calls wrap the call in a bare `except OperationFailure: pass`. This is meant to tolerate an "index already exists" re-run, but it also silently swallows genuinely fatal errors — e.g. a pre-existing text index on a *different* field set (Mongo raises *"cannot create a text index when one already exists with different options"*), or a malformed spec. If the intended `name+description` text index fails to be created, startup still succeeds, and every later `$text` search (`list_products` with `q`) raises `OperationFailure` at request time → **unhandled 500** on a documented feature (CAT-03).
**Fix:** Only ignore the specific idempotency error, and surface/log anything else:
```python
from pymongo.errors import OperationFailure

async def ensure_indexes() -> None:
    for spec in (
        [("category", ASCENDING)],
        [("name", TEXT), ("description", TEXT)],
    ):
        try:
            await _products.create_index(spec)
        except OperationFailure as e:
            if "already exists" not in str(e):
                raise
```

### WR-04: DB exceptions on request paths bypass the unified error envelope
**File:** `services/catalog-service/app/db.py` (all `list_products`/`get_product`/`batch_get`/`create_product`/`update_product`/`delete_product`) + `app/main.py:58-86`
**Issue:** The custom `HTTPException` / `RequestValidationError` handlers emit the byte-exact `{"code","message"}` envelope, but `PyMongoError`/`OperationFailure` raised during a request is not caught. FastAPI falls back to its default 500 handler, returning a *different* body (`{"detail":"Internal Server Error"}`) and, in debug mode, a stack trace. This breaks the "unified envelope" contract precisely on the failure path (DB down, cursor error, WS reset). It is not a security leak in prod, but it is an inconsistency the phase explicitly designed against.
**Fix:** Add a top-level handler (or a DB-call wrapper) that maps mongo errors to the unified `INTERNAL_ERROR` / `503` envelope:
```python
from pymongo.errors import PyMongoError

@app.exception_handler(PyMongoError)
async def mongo_exception_handler(request, exc):
    return _error_response("INTERNAL_ERROR", "An unexpected error occurred.", 503)
```

---

## Info

### IN-01: `imageUrl` is not constrained to http/https
**File:** `services/catalog-service/app/models.py:38,56` (`Product.imageUrl`, `ProductWrite.imageUrl`)
**Issue:** The OpenAPI contract describes `imageUrl` as "URL-shaped (http/https)" but the Pydantic field is an unconstrained `Optional[str]`. An admin (or any caller reaching a mutating route) could store `javascript:`/`data:` URLs. This is only an XSS/abuse vector if the frontend renders it unsafely (e.g. as `<a href>`), and admins are privileged, so impact is low — but it deviates from the documented shape.
**Fix:** Add a lightweight scheme check (or a `pydantic` `AnyHttpUrl` constrained to http/https) on `ProductWrite.imageUrl`.

### IN-02: Redundant local import of `HTTPException`
**File:** `services/catalog-service/app/routes.py:94`
**Issue:** `from fastapi import HTTPException` is re-imported *inside* `get_product`, even though `HTTPException` is already imported at module top (line 22). Harmless but a code smell indicating copy-paste.
**Fix:** Delete line 94 and use the module-level `HTTPException`.

### IN-03: Duplicate `id` field stored alongside `_id` in the seed
**File:** `services/catalog-service/scripts/seed.py:241-244`
**Issue:** `$setOnInsert` writes `"id": row["id"]` in addition to `_id` (which already equals the same value). The read path (`db._doc_to_product`) derives `id` from `_id` and ignores the stored `id`, so the field is dead data that can drift.
**Fix:** Drop `"id"` from `$setOnInsert` (keep only `createdAt` there).

### IN-04: Mixed `createdAt` storage types (string vs BSON datetime)
**File:** `services/catalog-service/scripts/seed.py:32-34` vs `services/catalog-service/app/routes.py:114`
**Issue:** The seed writes `createdAt` as a **string** (`"2026-08-24T12:00:00.000Z"`), while `create_product` writes it as a tz-aware BSON `datetime`. Both currently round-trip through Pydantic's `datetime` field + `iso_ms` serializer, so behavior is correct today — but the collection holds two different physical types for the same logical field, which is fragile (any future query/sort/aggregation on `createdAt` would behave inconsistently).
**Fix:** Store a real `datetime` in the seed too (e.g. `datetime(2026,8,24,12,0,0, tzinfo=timezone.utc)`), keeping `createdAt` homogeneous across all write paths.

---

## Notes / Non-issues (explicitly checked)

- **NoSQL injection:** `category` is exact-match; `q` is passed only as `{"$text": {"$search": q}}` (string value, cannot inject operators). `batch_get` uses `{"_id": {"$in": ids}}` with caller-supplied strings as values, not operators. No injection found.
- **Secret hygiene:** `.env` is gitignored; only `.env.example` (placeholder `<long-random-secret-change-me>`) is tracked; `.dockerignore` excludes `.env`. The committed *code* default (WR-01) is the only secret-in-source issue.
- **JWT alg negotiation:** `algorithms=["HS256"]` is pinned; `alg=none`/HS384 variants are rejected (confirmed by `test_invalid_token_401`). Good.
- **Static SVG serving:** `StaticFiles` prevents path traversal; `gen_placeholders.py` XML-escapes `name`/`category`/`id` before embedding. No XSS/XXE.
- **Determinism / pagination:** `_id` tie-break is correctly appended in both `routes.py` and `db.list_products` (no double-append). `total` reflects the full filtered set. Correct.
- **Interop envelope byte-exactness:** `json.dumps(..., separators=(",",":"))` guarantees compact, identical bodies for the shared error shapes. Correct.

---

## Verdict

**No BLOCKING issues.** The phase is shippable. Recommended before production hardening: address WR-01 (remove in-source secret default) and WR-02 (require `exp`) as they are the two with the largest security blast radius; WR-03/WR-04 improve robustness of the search path and failure envelope. The INFO items are low-risk quality improvements.

_Reviewed: 2026-08-27T18:19:00Z_
_Reviewer: gsd-code-reviewer (standard depth)_
