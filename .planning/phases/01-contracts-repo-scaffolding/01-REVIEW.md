---
phase: 01-contracts-repo-scaffolding
reviewed: 2026-08-24T12:00:00Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - scripts/check-contracts.sh
  - scripts/validate-topic-schemas.mjs
  - docs/api-contracts/_shared.yaml
  - docs/api-contracts/.spectral.yaml
  - docs/api-contracts/auth-service.openapi.yaml
  - docs/api-contracts/catalog-service.openapi.yaml
  - docs/api-contracts/cart-service.openapi.yaml
  - docs/api-contracts/orders-service.openapi.yaml
  - docs/kafka-topics.md
  - docs/versions.md
  - docs/json-interop.md
  - .gitattributes
  - .editorconfig
  - .gitignore
  - .env.example
findings:
  critical: 0
  high: 1
  medium: 4
  low: 4
  total: 9
  # derived aliases for tier-equivalent downstream parsers:
  warning: 5   # high + medium
  info: 4      # low
status: issues
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-24T12:00:00Z
**Depth:** deep (cross-file contract consistency + runtime probes)
**Files Reviewed:** 15 (+ `docker-compose.yml` glanced: header-only stub, no reviewable content)
**Status:** issues

## Summary

Phase 1 delivers a contracts-first scaffolding: five-stage mechanical drift gate (`check-contracts.sh`), a stdlib-only topic-schema validator, four service OpenAPI specs plus shared components, Kafka topic contracts, version manifest, interop law, and repo hygiene files. The overall quality is high — the gate accumulates failures instead of aborting, the validator is exact-key-set and integer-strict, versions.md pins match AGENTS.md verbatim, and all Stage-4 pin patterns were verified to match the manifest as authored.

Verification performed (read-only): `bash -n` on the gate script (clean); live run of `validate-topic-schemas.mjs` against `docs/kafka-topics.md` (passes, exit 0); negative probe proving the APPROVED payment payload is unrepresentable in the gate; `git ls-files --eol` CRLF stage check (zero hits); every Stage-4 grep pattern manually matched against `docs/versions.md`.

No CRITICAL findings. One HIGH defect affects every generated client of all four services. The MEDIUM tier is concentrated at contract/gate boundaries where two frozen sources of truth disagree.

## High

### HI-01: Server URL + path double-prefix breaks every generated client URL (all four service specs)

**Files:**
- `docs/api-contracts/auth-service.openapi.yaml:41` with paths at `:51`, `:85`, `:121`
- `docs/api-contracts/catalog-service.openapi.yaml:47` with paths at `:61`, `:170`, `:214`, `:326`
- `docs/api-contracts/cart-service.openapi.yaml:56` with paths at `:70`, `:128`, `:166`, `:243`, `:279`
- `docs/api-contracts/orders-service.openapi.yaml:78` with paths at `:88`, `:206`, `:257`

**Issue:** OpenAPI 3 resolves request URLs as `servers[].url` + path template. Each spec declares a server URL that already contains the gateway prefix AND repeats that prefix in every path:

| Spec | servers.url | Path | Resolved client URL |
|---|---|---|---|
| auth | `http://localhost:8080/auth` | `/auth/signup` | `http://localhost:8080/auth/auth/signup` |
| catalog | `http://localhost:8080/catalog` | `/catalog/products` | `http://localhost:8080/catalog/catalog/products` |
| cart | `http://localhost:8080/cart` | `/cart/items` | `http://localhost:8080/cart/cart/items` |
| orders | `http://localhost:8080/orders` | `/orders/{id}` | `http://localhost:8080/orders/orders/{id}` |

Every codegen client, Postman import, and Swagger UI "Try it out" will target doubled prefixes and 404 through the gateway. The specs' own headers say these files are canonical and "implemented verbatim" (and Phase 9's smoke test drives this surface), so the wrongness compounds rather than gets corrected. Secondary casualty: the NETWORK-INTERNAL `/health` paths resolve to e.g. `http://localhost:8080/catalog/health`, which is neither the gateway route nor the compose probe target (`catalog-service:8000/health`) — the health operation has no valid absolute URL anywhere in its own spec.

**Fix:** Pick one convention and apply it to all four specs. Recommended: keep full gateway-prefixed paths (they document external routing) and drop the prefix from the server entry:

```yaml
servers:
  - url: http://localhost:8080
    description: api-gateway entrypoint (:8080 proxies /auth -> auth-service :8081)
```

Alternative: keep `url: http://localhost:8080/auth` and shorten paths to `/signup`, `/login`, `/me`. Do not mix. For the internal `/health` operations, either move them into a separate internal doc or add a second server entry pointing at the service container so tooling can resolve them.

## Medium

### MD-01: Gate contradicts the wire contract for `payment.completed.reason` — the canonical APPROVED variant can never pass validation

**Files:** `scripts/validate-topic-schemas.mjs:25-27` and `:89-93` vs `docs/kafka-topics.md:128`

**Issue:** `kafka-topics.md:128` freezes `reason` as conditionally present: "PRESENT ONLY when outcome is DECLINED; on APPROVED the key is OMITTED entirely (absent-not-null, interop Rule 4)." The validator requires `reason` in the EXACT key set of every `payment.completed` block, and its header comment (`:9-10`) misdocuments the wire shape as always-reason. Verified by probe: a payload `{eventId, orderId, outcome: "APPROVED", processedAt}` — exactly what line 128 mandates — fails the gate. Today the doc happens to show only the DECLINED example, so the run passes; but any future editor who adds or switches to the equally-canonical APPROVED example (or restructures blocks) trips a confusing failure ("expected exactly 2 fenced json payload blocks"), and the validator's docstring actively teaches implementers the wrong shape.

**Fix:** Encode conditional presence instead of unconditional membership:

```js
const baseKeys = ["eventId", "orderId", "outcome", "processedAt"];
// after parsing:
if (payload.outcome === "DECLINED") {
  if (!("reason" in payload) || typeof payload.reason !== "string")
    fail("payment.completed: DECLINED requires string reason");
} else if ("reason" in payload && payload.outcome === "APPROVED") {
  fail("payment.completed: APPROVED must omit reason (absent-not-null)");
}
```

At minimum, correct the header comment so the documented shape matches kafka-topics.md.

### MD-02: APPROVED email rendering inputs span two topics, but the required cross-topic join is undocumented while the doc claims self-sufficiency

**File:** `docs/kafka-topics.md:141-177` (vs payloads at `:47-71`, `:113-121`; self-sufficiency claim at `:3-5`)

**Issue:** The "Email Content Payload" table says Phase 6 renders from these inputs alone, yet the APPROVED body needs `items[].nameSnapshot`, `items[].quantity`, `totalCents`, `currency` — none of which exist on `payment.completed`. They live only on `order.created`, which arrives before the outcome is known. Rendering therefore requires notification-service to statefully join the two topics per `orderId` (persist the order.created snapshot, enrich on APPROVED). The doc never states this; lines 3–5 promise every service implements "from this file alone — no questions asked back to planning." A fresh-context Phase 6 agent will either invent an undocumented enrichment design, re-fetch order data over REST (contradicting the event-driven design), or silently render empty item lines.

**Fix:** Add one paragraph to the email section: "The APPROVED email renders fields from BOTH topics: notification-service must retain each `order.created` payload keyed by `orderId` and enrich it with the `payment.completed` outcome at render time; DECLINED needs only the payment event." Also state retention/cleanup expectations for the pending-order buffer (e.g., discard on terminal state).

### MD-03: `.env.example` violates its own Docker-DNS convention for Kafka — `KAFKA_BOOTSTRAP_SERVERS=localhost:9092`

**File:** `.env.example:13` vs `:29-30`, `:34`, `:40-41`

**Issue:** The file frames variable names as contractual and every other endpoint uses compose-network DNS names: `CATALOG_SERVICE_URL=http://catalog-service:8000`, `CART_SERVICE_URL=http://cart-service:3001`, `SMTP_HOST=mailpit`, `MONGO_URI=mongodb://mongo:27017`, `REDIS_URL=redis://redis:6379/0`. Kafka alone points at `localhost:9092`. When Phase 7 wires services via `env_file`, every in-container Kafka client (order/payment/notification producers+consumers) would try to reach the broker inside its own container namespace and fail. `localhost` is only correct for host-side tools (kafka-ui, smoke tests).

**Fix:**

```dotenv
# ── Event bus ────────────────────────────────────────────────────────
# In-container clients resolve the compose service name.
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
# Host-side consumers (Kafka UI, Phase 9 smoke test) may override to localhost:9092.
```

(Placeholder caveat acknowledged — but the inconsistency is in the convention itself, which the file declares contractual.)

### MD-04: Auth spec omits the 400 VALIDATION_FAILED response class its own schemas make inevitable

**Files:** `docs/api-contracts/auth-service.openapi.yaml:70-83` (signup responses), `:104-119` (login responses); constraints at `:158-165`

**Issue:** `EmailPassword` enforces `format: email` and `password.minLength: 8`. Any real implementation validates these server-side (catalog createProduct documents exactly this flow as 400 VALIDATION_FAILED at `docs/api-contracts/catalog-service.openapi.yaml:165-166`). Signup/login declare only 201/409 and 200/401 respectively — no `'400'`. Clients generated from this contract have no error branch for malformed input, and the platform-wide claim "unified error envelope returned by every service on failure" (`_shared.yaml:71-74`) is not honored on its most-trafficked endpoints. This is precisely the drift the phase exists to prevent.

**Fix:**

```yaml
        '400':
          $ref: './_shared.yaml#/components/responses/ValidationError'
```

Add under both signup and login responses (login 400 covers missing/malformed body before credential check).

## Low

### LO-01: `.editorconfig` global `end_of_line = lf` fights `.gitattributes` CRLF law for `*.bat`/`*.cmd`

**Files:** `.editorconfig:8` vs `.gitattributes:11-12`

**Issue:** EditorConfig applies `lf` to ALL files including Windows batch scripts, which `.gitattributes` deliberately checks out as CRLF. Editors honoring both will flip .bat working-tree copies to LF on save (cmd.exe label/goto parsing risk), causing churn between the two governance files. Repo contents stay safe (git normalizes on check-in); friction is worktree-only.

**Fix:** Append:

```ini
[*.{bat,cmd}]
end_of_line = crlf
```

### LO-02: `.gitignore` has no `.next/` entry ahead of the Next.js phase

**File:** `.gitignore:9-14`

**Issue:** Node/Java/Python artifacts are covered (`node_modules/`, `target/`, `dist/`, `build/`), but Next.js's default build output `.next/` is absent. First frontend build risks committing megabytes of build output.

**Fix:** Add `.next/` under the dependencies/build-artifacts block (also consider `out/` for static exports).

### LO-03: Stage-4 pin assertions scan whole-file prose and use GNU-specific `\b` — weaker and less portable than intended

**Files:** `scripts/check-contracts.sh:86-105` (patterns; esp. `:88`, `:92`, `:102`), `:106`

**Issue:** Two compounding weaknesses: (a) `grep -qiE "$pattern" "$VERSIONS_FILE"` searches the entire markdown including prose notes, so a table row could be deleted while its version string survives in a Note column or footer and the pin still "passes"; loose alternatives like `(JDK|Java).*\b21\b` also match unrelated text containing "Java … 21". (b) `\b` is a GNU-grep extension — fine in Git Bash (the stated environment) but silently different on BSD/busybox grep if the gate ever runs elsewhere. Verified all 20 pins currently pass against versions.md as authored, so this is robustness, not breakage.

**Fix:** Anchor assertions to table rows, e.g. `grep -qiE '^\| *JDK *\| *21\b' docs/versions.md`, or assert on the Exact-pin column specifically. If cross-platform portability matters, prefer `[[:digit:]]` classes and explicit boundary constructs over `\b`.

### LO-04: Topic validator maps JSON fences positionally, blind to section headings

**File:** `scripts/validate-topic-schemas.mjs:50-55`

**Issue:** Blocks are mapped onto `["order.created", "payment.completed"]` purely by document order. If the sections are ever reordered (or a third fence added), validations attach to the wrong topic — failures stay in the safe direction (key sets differ, so it fails loudly) but with misleading diagnostics like "order.created: key set mismatch" pointing at a perfectly valid payment payload.

**Fix:** Cheap hardening: capture the nearest preceding `^## Topic: (.*)$` heading per block (extend the regex scan to track offsets) and map by heading text instead of index; fail with "block found under unexpected heading" when they diverge.

## Verified clean (no action)

- **Secrets hygiene:** `.env.example` carries placeholder values only (`JWT_SECRET=<long-random-secret-change-me>`, `POSTGRES_PASSWORD=change-me-db-password`); `.env` / `.env.*` ignored with correct `!.env.example` negation ordering (`.gitignore:4-6`).
- **Gate mechanics:** `set -euo pipefail` interactions audited — every fallible command sits behind `if !` / `|| true` guards; failure accumulation via `FAIL=1` works; `exit "$FAIL"` correct. Quoting of `${SPECS[@]}`, `"$ROOT"`, `"$VERSIONS_FILE"` all sound; nullglob usage correct; `_shared.yaml` correctly excluded from the lint glob.
- **Stage 3 EOL law:** `git ls-files --eol | grep 'i/crlf' | grep -vE '\.(bat|cmd)$'` verified against the live index — zero hits; bat/cmd exemption consistent with `.gitattributes` (index stores LF even for them).
- **Validator strictness:** exact key-set equality, non-empty `items[]`, exact item keys, `Number.isInteger(totalCents)`, frozen outcome enum — all exercised against the real doc (pass) and a negative fixture (fail, exit 1).
- **Cross-spec totals arithmetic:** cart example (2×12999+999=26997) and order/kafka examples (12999+2×999=14997) all internally consistent.
- **versions.md ↔ AGENTS.md:** every pin matches the embedded STACK.md table; verified-date footer present and matched by the gate pattern.
- **Spectral ruleset:** exists, benign, `--fail-severity=warn` semantics match the comment.
- **docker-compose.yml:** header-only stub by design; nothing to review yet.

---

_Reviewed: 2026-08-24T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
