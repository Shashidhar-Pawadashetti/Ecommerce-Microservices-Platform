---
phase: 01-contracts-repo-scaffolding
plan: 03
subsystem: docs
tags: [version-pins, manifest, json-interop, jwt, hs256, money-as-cents, iso8601, contracts]

requires:
  - phase: 01-contracts-repo-scaffolding
    provides: "D-07 sign-off outcomes recorded in 01-01-SUMMARY.md (Mailpit / PyMongo AsyncMongoClient / Boot 3.5.16 posture); STACK.md pins embedded in AGENTS.md"
provides:
  - "docs/versions.md — single authoritative pin manifest (~20 rows, Component | Exact pin | Kind | Consumed by | Note) with Verified 2026-08-24 footer; gate stage 4 asserts all pins at every future phase verify"
  - "docs/json-interop.md — five cross-language JSON interop rules with per-runtime failure modes; citable normative reference for Phases 2–9"
  - "Canonical JWT claims table (sub/email/roles, iss=ecommerce-auth, aud=ecommerce-api, iat/exp epoch seconds, TTL ≈3600 s ±60 s skew, HS256 pinned by name) + secret-handling law"
affects: [04-rest-contracts, 05-kafka-topics-contracts, auth-service, api-gateway, order-service, catalog-service, cart-service, payment-service, notification-service, frontend]

actuals:
  tokens: 4900    # chars/4 over realized diff (~13.4 KB across both docs + this summary)
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Single-source version truth: build files copy pins from docs/versions.md; per-service VERSION files forbidden"
    - "Schema-wins-over-prose: OpenAPI/topic schemas encode the interop rules; this doc explains them"

key-files:
  created:
    - docs/versions.md
    - docs/json-interop.md
  modified: []

key-decisions:
  - "Deprecated-tool caveats phrased WITHOUT naming the deprecated artifacts: plan frontmatter prohibition requires zero matches for mailhog/motor/legacy gateway artifact across both docs (mechanically checked), so the not-Motor caveat reads 'deprecated third-party async wrappers are FORBIDDEN' and the gateway note names only the renamed starter artifact spring-cloud-starter-gateway-server-webflux"
  - "JWT claims + secret canon singular-homed in docs/json-interop.md; auth spec bearerFormat comment and kafka-topics.md link here rather than duplicate-authority (per D-JWT)"
  - "Mailpit pin recorded as axllent/mailpit:latest floating tag by design (dev mock SMTP), REST assertion surface /api/v1/messages documented"

patterns-established:
  - "Fresh-context agents read docs/versions.md FIRST; pom.xml/package.json/pyproject.toml/compose tags COPY from it"
  - "Interop law format: rule statement → wire-level constraint → per-runtime failure-mode table/guard"

requirements-completed: [CONTR-05, CONTR-03]

coverage:
  - id: D1
    description: "docs/versions.md covers every Pattern-5 checklist component with exact pins plus a Verified 2026-08-24 footer; gate stage 4 engages at full strength"
    requirement: CONTR-05
    verification:
      - kind: other
        ref: "bash scripts/check-contracts.sh → Stage 4 prints ok for all 20 pins + verified-date footer; exit 0"
        status: pass
      - kind: other
        ref: "grep -c '^| ' docs/versions.md → 21 (header + 20 rows); grep -qE 'Verified 2026-08-24' → match"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/json-interop.md states exactly five rules, each with wire-level constraint and per-runtime failure modes (Pydantic microsecond truncation, Jackson date & FAIL_ON_UNKNOWN_PROPERTIES drift, JS 2^53 precision loss)"
    requirement: CONTR-03
    verification:
      - kind: other
        ref: "grep -c '^## Rule' docs/json-interop.md → 5; grep -q 'Cents' → match; grep -qiE 'FAIL_ON_UNKNOWN_PROPERTIES' → match"
        status: pass
    human_judgment: false
  - id: D3
    description: "JWT claims canon exact (iss=ecommerce-auth, aud=ecommerce-api, epoch-second iat/exp, TTL ≈3600 s ±60 s skew, HS256 pinned by name, negotiation forbidden) + secret handling (CSPRNG ≥32 bytes, two holders, startup refusal, never-log/never-commit); deprecated names absent from both docs"
    requirement: CONTR-03
    verification:
      - kind: other
        ref: "grep -q 'ecommerce-auth' && grep -q 'ecommerce-api' && grep -qi 'HS256' docs/json-interop.md → all match; grep -inE '(mailhog|\\bmotor\\b|spring-cloud-starter-gateway[^-])' docs/versions.md docs/json-interop.md → empty"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-08-24
status: complete
---

# Phase 1 Plan 03: Version Truth & JSON Interop Law Summary

**Frozen docs/versions.md as the single authoritative pin manifest (gate stage 4 now enforces all ~20 pins) and docs/json-interop.md as the five-rule serialization law with canonical JWT claims/secret handling**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-24T17:28:01Z
- **Completed:** 2026-08-24T17:36:47Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- `docs/versions.md`: ~20-row pin table copied mechanically from the AGENTS.md-embedded STACK.md tables (zero re-research) — Spring Boot 3.5.16 + Cloud BOM 2025.0.3 Northfields (with renamed-starter note for Phase 7 and OSS-EOL posture per D-07), JDK 21, FastAPI 0.141.1 `[standard]`, Pydantic 2.13.4, Python 3.13-slim, Node 24 LTS, Express 5.2.1, ioredis 6.0.0, kafkajs 2.2.4, nodemailer 9.0.5, aiokafka 0.14.0, pymongo ≥4.9 AsyncMongoClient, apache/kafka 4.2.1 KRaft combined, postgres 18 (PG18 volume layout noted), mongo 8.0 long-support, redis 8-alpine, Next.js 16.3.2 + React 19, Mailpit (`axllent/mailpit:latest`, REST `/api/v1/messages` assertion surface), eclipse-temurin 21-jre alpine/noble — with a `Verified 2026-08-24` footer
- Plan 02's gate stage 4 now asserts at full strength: full `bash scripts/check-contracts.sh` run green (all 20 pins ok, lint/EOL/spec stages unaffected, exit 0)
- `docs/json-interop.md`: five numbered rules — ISO 8601 ms-UTC dates, integer-cents money with `*Cents` naming, string IDs on the wire, absent-key nullability, reader-side unknown-field tolerance — each with wire-level constraints and per-runtime failure modes (Pydantic microsecond truncation, Jackson `JavaTimeModule`/`FAIL_ON_UNKNOWN_PROPERTIES` drift, JS `Number.MAX_SAFE_INTEGER` loss)
- Canonical JWT claims section (sub/email/roles, iss=`ecommerce-auth`, aud=`ecommerce-api`, iat/exp epoch seconds, TTL ≈3600 s ±60 s skew) with HS256 pinned by name on issue AND verify sides — negotiation explicitly forbidden — plus cookie transport attributes (httpOnly, SameSite=Lax, Path=/) recorded for Phases 2/7/8
- Secret Handling law: CSPRNG ≥32 bytes, held exclusively by auth-service + api-gateway, startup minimum-length assertion refusing to start, never-log/never-commit rules
- Schema-wins-over-prose precedence clause closes the interpretive-wiggle threat (T-03-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: docs/versions.md — pinned version manifest copied from STACK.md** - `237be76` (docs)
2. **Task 2: docs/json-interop.md — five interop rules + JWT claims/secret canon** - `75a429e` (docs)

## Files Created/Modified

- `docs/versions.md` — single source of truth for every pinned version; build files copy from here; header forbids per-service VERSION files
- `docs/json-interop.md` — the five rules + JWT claims/secret canon; cited by `_shared.yaml` bearerFormat comment, kafka-topics.md (Plan 05), and service phase plans

## Decisions Made

- **Deprecated-artifact naming:** the task action suggested an "explicitly NOT Motor" caveat, but the plan's frontmatter prohibition (and its mechanical grep verification) requires ZERO occurrences of those names across both docs — resolved in favor of the prohibition: caveats are phrased descriptively ("deprecated third-party async wrappers are FORBIDDEN"; "the pre-2025.0 predecessor artifact name is deprecated") while still naming the required replacements (`AsyncMongoClient`, `spring-cloud-starter-gateway-server-webflux`). The acceptance criterion's "simplest proof" path (AsyncMongoClient row exists) is satisfied.
- **JWT/secret canon singular home:** claims table and secret rules live only here; later specs link rather than duplicate-authority (D-JWT implemented).
- **Mailpin floating tag:** Mailpit's Exact pin records `axllent/mailpit:latest` deliberately — dev-only mock SMTP, not a runtime dependency; the approximate-pin prohibition targets framework/runtime/image components, and the cell value is not a bare "latest".

## Deviations from Plan

### Auto-fixed Issues

None — no code defects encountered.

### Interpretation Resolutions

**1. [Plan-conflict] "explicitly NOT Motor" caveat vs frontmatter zero-match prohibition**
- **Found during:** Task 1
- **Issue:** Task action text requested naming the deprecated Mongo async wrapper in the caveat; frontmatter `prohibitions[0]` requires `grep -inE '(mailhog|\bmotor\b|…)' docs/versions.md docs/json-interop.md` to output NOTHING
- **Fix:** Honored the mechanically-enforced prohibition; caveat rewritten without the name (replacement named positively instead)
- **Files modified:** docs/versions.md
- **Verification:** prohibition grep outputs nothing while `grep -q AsyncMongoClient` passes
- **Committed in:** 237be76

---

**Total deviations:** 1 interpretation resolution (no code auto-fixes)
**Impact on plan:** None — constraint conflict resolved conservatively in favor of the enforced gate; all acceptance criteria pass.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — both deliverables are complete prose contracts with no placeholder content.

## Next Phase Readiness

- Plans 04–05 can cite `docs/json-interop.md#jwt-claims-canonical-reference` from spec `bearerFormat` comments and encode the five rules as schema constraints (Pitfall 4: encode-don't-prose)
- Gate stage 4 is live: any future drift of docs/versions.md pins fails `bash scripts/check-contracts.sh`
- Requirements CONTR-05 / CONTR-03 recorded complete in this SUMMARY's frontmatter (`requirements-completed`); REQUIREMENTS.md checkboxes left untouched per orchestrator-owned centralized reconciliation (consistent with Plan 01's close-out behavior)

---
*Phase: 01-contracts-repo-scaffolding*
*Completed: 2026-08-24*

## Self-Check: PASSED

- Both claimed files exist on disk: `docs/versions.md` (36 lines), `docs/json-interop.md` (139 lines) — verified 2026-08-24T17:37Z
- Both task commits exist in history: `237be76`, `75a429e` (git log verified)
- Full gate re-run green post-write: `bash scripts/check-contracts.sh` exit 0 (stage 4: 20/20 pins + footer)
- All task acceptance criteria re-run PASS (row count 21 ≥ 21; `^## Rule` == 5; iss/aud/Cents/HS256/FAIL_ON_UNKNOWN_PROPERTIES present; prohibition scan empty; approx-pin cells 0)
