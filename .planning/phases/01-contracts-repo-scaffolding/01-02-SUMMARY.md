---
phase: 01-contracts-repo-scaffolding
plan: 02
subsystem: infra
tags: [openapi, spectral, contract-testing, kafka, bash, node, drift-gate]

requires:
  - phase: 01-contracts-repo-scaffolding plan 01
    provides: LF law (.gitattributes/.editorconfig/.gitignore), seven-service services/ skeleton, README, .env.example, compose placeholder — the partial tree the gate tolerates and validates
provides:
  - "scripts/check-contracts.sh — five-stage mechanical drift gate (lint / topic schemas / EOL law / version-manifest / spec coverage), existence-guarded for incremental waves, exit non-zero on any violation"
  - "scripts/validate-topic-schemas.mjs — Node-stdlib fenced-JSON validator freezing order.created + payment.completed payload shapes (exact key sets, outcome enum, item shape, integer totalCents)"
  - "docs/api-contracts/.spectral.yaml — spectral:oas ruleset + warn-severity info-description rule; gate runs --fail-severity=warn so warnings are fatal"
  - "docs/api-contracts/_shared.yaml — single-sourced bearerAuth scheme, Error envelope {code,message} with no-leak policy, reusable 400/401/404/409 responses, Idempotency-Key + limit/offset parameters"
  - "docs/api-contracts/auth-service.openapi.yaml — complete OpenAPI 3.0.3 auth contract: signup/login/me, explicit security matrix, D-JWT conventions frozen, D-03 no-logout note"
affects: [01-03-json-interop-versions-manifest, 01-04-catalog-cart-contracts, 01-05-orders-kafka-topics, phase-2-auth-service, phase-7-gateway]

actuals:
  tokens: 6143          # chars/4 over the realized production diff (24,573 chars across tasks 2-3); plan estimated 48,000
  tasks: 3
  commits: 3            # task commits f4488c1, b678d0b, 5fc79a0 (+ this metadata commit)

tech-stack:
  added:
    - "@stoplight/spectral-cli@6.16.3 via pinned npx invocation (SCARF_ANALYTICS=false), approved at the Task 1 blocking-human checkpoint"
  patterns:
    - "Contract-first authority header at the top of every committed spec (generated specs never tracked)"
    - "Cross-file shared components: $ref './_shared.yaml#/components/...' from every service spec"
    - "Accumulating-failure gate script: stages set FAIL=1 instead of aborting, so one run reports every violation class"
    - "Existence-guarded SKIP stages for same-wave parallel deliverables that assert at full strength once files land"
    - "Node-stdlib-only validators (no external JSON tooling dependencies)"

key-files:
  created:
    - scripts/check-contracts.sh
    - scripts/validate-topic-schemas.mjs
    - docs/api-contracts/.spectral.yaml
    - docs/api-contracts/_shared.yaml
    - docs/api-contracts/auth-service.openapi.yaml
    - .planning/phases/01-contracts-repo-scaffolding/01-02-SUMMARY.md
  modified: []

key-decisions:
  - "Package legitimacy resolved: @stoplight/spectral-cli@6.16.3 APPROVED for npx use after npmjs/GitHub review (~1.66M weekly downloads, official active stoplightio repo, Apache-2.0, SmartBear maintainers, no install lifecycle scripts, registry-signed); SUS flag judged a release-freshness false positive. Fallback paths documented: stoplight/spectral Docker image or defer-to-Phase-2."
  - "Telemetry muted: SCARF_ANALYTICS=false exported on every Spectral invocation inside the gate."
  - "bearerAuth is defined once in _shared.yaml and re-exported into each service spec's components.securitySchemes via $ref, keeping the definition single-homed while satisfying oas3-operation-security-defined."
  - "JWT conventions frozen in the auth spec info.description per D-JWT (HS256 pinned by name on issue AND verify, never negotiated; iss=ecommerce-auth; aud=ecommerce-api; sub/email/roles/iat/exp; TTL 3600s with 60s skew; CSPRNG secret >= 32 bytes held only by auth+gateway with startup length assertion)."
  - "D-03 recorded verbatim-in-spirit: logout is client-side token discard by design in v1 - no endpoint will be added without an explicit contract change."
  - "Gate SKIP semantics are BY DESIGN for parallel-wave artifacts (docs/versions.md -> Plan 03, docs/kafka-topics.md -> Plan 05, remaining three specs -> Plans 04/05); full assertions engage automatically when those files land."

patterns-established:
  - "Spec naming <service-name>.openapi.yaml feeding the docs/api-contracts/*.openapi.yaml lint glob - later specs inherit validation with zero config"
  - "Unified error envelope {code, message}: machine-readable stable codes (VALIDATION_FAILED, DUPLICATE_EMAIL...); message must never leak hostnames/stack traces/driver errors; additionalProperties true (ignore-unknown readers)"
  - "Money is integer cents everywhere (unitPriceCents/totalCents); IDs are strings on the wire; timestamps ISO 8601 ms UTC date-time"
  - "Per-operation explicit security classification (public ops declared under root security: []; protected ops carry bearerAuth) - Phase 7 implements exactly this matrix"

requirements-completed: [CONTR-01, CONTR-04]

coverage:
  - id: D1
    description: "Five-stage mechanical drift gate scripts/check-contracts.sh covering lint, topic schemas, EOL law, version manifest, and spec coverage; exits non-zero on any violation"
    requirement: CONTR-04
    verification:
      - kind: other
        ref: "command: bash scripts/check-contracts.sh -> exit 0 on partial tree (all stages exercised)"
        status: pass
      - kind: other
        ref: "command: bash scripts/check-contracts.sh -> exit 0 post auth-spec (tracer rerun)"
        status: pass
      - kind: unit
        ref: "command: node scripts/validate-topic-schemas.mjs <fixture-missing-eventId> -> exit 1 (negative proof stage 2 fails loudly)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Topic-schema validator (Node stdlib only, zero jq dependency) freezing both topic payload contracts"
    verification:
      - kind: unit
        ref: "command: negative fixture with order.created block missing eventId -> FAIL key-set mismatch, exit 1"
        status: pass
      - kind: unit
        ref: "command: valid payment.completed fixture block -> 'ok: payment.completed required-key set exact'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Spectral ruleset extending spectral:oas with warn-severity info-description rule; warnings gate-fatal"
    verification:
      - kind: other
        ref: "command: gate stage 1 output 'No results with a severity of warn or higher found!'"
        status: pass
    human_judgment: false
  - id: D4
    description: "_shared.yaml shared components (bearerAuth/Error envelope/reusable responses/shared params) referenced cross-file by the auth spec"
    verification:
      - kind: other
        ref: "command: Spectral dereferences ./_shared.yaml refs during lint - zero findings proves refs resolve (broken ref aborts loudly by design)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Complete auth-service.openapi.yaml tracer slice: signup/login/me with explicit public-vs-bearerAuth matrix, frozen JWT conventions (D-JWT), bcrypt note, D-03 no-logout note"
    requirement: CONTR-01
    verification:
      - kind: other
        ref: "command: grep acceptance - operationId x3, bearerAuth x4, logout x1, type:number x0 in _shared"
        status: pass
    human_judgment: true
    rationale: "Lint proves structure and internal consistency; whether the contract text is sufficient for Phase 2 to implement signup/login/me with zero follow-up questions is a reader judgment reserved for phase verify."
  - id: D6
    description: "Package-legitimacy checkpoint (blocking-human) resolved before first package execution; verdict and chosen npx path recorded in this SUMMARY"
    verification: []
    human_judgment: true
    rationale: "Human approval decision made at the checkpoint (response: 'approved'); automation cannot substitute for the supply-chain sign-off itself."

# Metrics
duration: 12min
completed: 2026-08-24
status: complete
---

# Phase 1 Plan 02: Validation Gate & Auth Contract Tracer Summary

**Five-stage mechanical contract drift gate (Spectral lint + topic schemas + EOL law + version manifest + endpoint coverage) proven green end-to-end on a complete auth-service OpenAPI 3.0.3 tracer slice.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-24T17:11:17Z
- **Completed:** 2026-08-24T17:23:17Z
- **Tasks:** 3
- **Files modified:** 6 created

## Accomplishments

- Package-legitimacy blocking-human checkpoint resolved (`approved`) BEFORE any package execution, with evidence and chosen path recorded below
- `check-contracts.sh` gate exists, is idempotent, tolerates incremental wave states (existence-guarded SKIPs), and fails loudly on genuine violations (negative test proven)
- Topic-schema validator freezes `order.created` / `payment.completed` payload shapes mechanically using Node stdlib only (jq absent by design)
- `_shared.yaml` single-sources bearerAuth, the unified `{code,message}` error envelope, reusable 4xx responses, Idempotency-Key, and pagination params
- Complete auth contract authored: operations exactly `signup` / `login` / `getMe`, explicit security classification, JWT conventions (D-JWT) and the D-03 no-logout note frozen in the spec itself
- Tracer chain proven end-to-end BEFORE any expansion spec is written: shared components → service spec → Spectral dereference/lint → coverage greps → gate exit 0 (verified twice)

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate** — `f4488c1` (docs: approval record in SUMMARY)
2. **Task 2: Validation gate trio (gate + validator + ruleset)** — `b678d0b` (feat)
3. **Task 3 (TRACER): _shared.yaml + complete auth spec** — `5fc79a0` (feat)

**Plan metadata:** committed as the final `docs(01-02)` commit immediately following the task commits.

## Files Created/Modified

- `scripts/check-contracts.sh` — five-stage accumulating drift gate; Spectral pinned at 6.16.3 via approved npx path with `SCARF_ANALYTICS=false`; executable (100755)
- `scripts/validate-topic-schemas.mjs` — stdlib-only fenced-JSON topic validator; exact required-key sets, outcome enum, item shape, integer `totalCents`; executable (100755)
- `docs/api-contracts/.spectral.yaml` — `extends: ['spectral:oas']` + warn-severity `info-description-required` rule
- `docs/api-contracts/_shared.yaml` — authority header; components fragment consumed via `$ref` from every service spec
- `docs/api-contracts/auth-service.openapi.yaml` — the tracer contract implementing AUTH-01/02/03 (+ AUTH-04 as an explicit absence)

## Decisions Made

### Task 1 — Package-legitimacy checkpoint resolution (checkpoint:human-verify, gate=blocking-human)

**Package:** `@stoplight/spectral-cli` pinned at **6.16.3** (flagged SUS by the research audit — release-freshness flag on the latest publish only).

**Verification URLs checked (per task how-to-verify):**
- https://www.npmjs.com/package/@stoplight/spectral-cli
- https://github.com/stoplightio/spectral

**Legitimacy evidence reviewed and accepted:**
- Weekly downloads ≈ **1.66M** — long-established, massively adopted project.
- Source repo is the **official stoplightio org**, active, not archived/deprecated.
- License Apache-2.0; maintained under SmartBear stewardship.
- **No install/postinstall lifecycle scripts** on the package.
- Registry-signed publishes; the SUS flag is a **release-freshness false positive** contradicting all adoption signals.

**Chosen execution path:** ✅ **npx** — user responded `approved`. All lint invocations run `npx -y @stoplight/spectral-cli@6.16.3` through `scripts/check-contracts.sh`, with `SCARF_ANALYTICS=false` muting telemetry.

**Documented fallbacks (not needed):** official Docker image `stoplight/spectral`; defer lint automation to Phase 2 keeping only the script skeleton.

### Execution decisions
- bearerAuth defined once in `_shared.yaml`, re-exported per-spec via `$ref` so `oas3-operation-security-defined` passes while the definition stays single-homed.
- Root-level `security: []` makes "public" an explicit declaration rather than a default silence; protected operations override with `bearerAuth` (T-02-03 mitigation).
- Gate SKIP stages are intentional wave-tolerance, not gaps: full assertions engage the moment Plans 03/04/05 land their files.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- npm printed deprecation warnings (`inflight`, `glob@7`, `sourcemap-codec`) while npx fetched Spectral's transitive dependency tree on first run — upstream packaging noise inside `@stoplight/spectral-cli`'s own deps, not findings of the gate and not repo code. Out of scope per deviation scope boundary; logged here for visibility.
- First Spectral run reported **zero findings at `--fail-severity=warn`** — no fix iterations were needed for either YAML file.

## Verification Evidence

| Check | Result |
|-------|--------|
| `bash scripts/check-contracts.sh` (partial tree, Task 2) | exit 0 |
| Negative fixture (order.created missing `eventId`) | validator exit 1 with key-set mismatch message |
| AC greps Task 2: `spectral-cli@6\.16\.3` ≥1 / forbidden token ==0 / `spectral:oas` present | 1 / 0 / 1 |
| `bash scripts/check-contracts.sh` (post auth spec, Task 3) | exit 0 — "No results with a severity of 'warn' or higher found!" |
| Tracer feedback gate re-run after commit | exit 0 |
| AC greps Task 3: operationId ≥3 / bearerAuth ≥1 / logout ≥1 / `type: number` in _shared ==0 | 3 / 4 / 1 / 0 |
| Prohibitions: float money types / tracked `*.openapi.json` / hedge words | none / none / none |
| EOL law stage (index CRLF scan) | clean |

## Known Stubs

None. The existence-guarded SKIP stages are planned wave-tolerance behavior mandated by the plan (files arrive later in this same phase), not stub implementations; every guarded stage asserts at full strength once its file lands.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 03 (json-interop.md + docs/versions.md): the manifest stage of the gate already asserts the complete ~20-component pin list plus verified-date footer, so Plan 03 gets mechanical completeness checking for free.
- Ready for Plans 04/05 (catalog/cart/orders specs + kafka-topics.md): new specs drop into the existing lint glob and coverage loop with zero gate changes; the topic validator is already proven against both payload shapes.
- Phase 2 can begin auth implementation against `auth-service.openapi.yaml`: request/response schemas, error codes, security classification, and JWT conventions are all frozen contractually.

---
*Phase: 01-contracts-repo-scaffolding*
*Completed: 2026-08-24*

## Self-Check: PASSED

- All 6 created files verified on disk (`[ -f ]` checks).
- Commits `f4488c1`, `b678d0b`, `5fc79a0` verified in `git log --oneline --all`.
- Full gate re-run post-commit: exit 0.
