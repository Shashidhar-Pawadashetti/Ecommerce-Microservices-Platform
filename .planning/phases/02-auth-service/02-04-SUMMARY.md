---
phase: 02-auth-service
plan: 04
subsystem: auth
tags: [smoke-test, curl, bash, documentation, jwt, docker-compose, phase-gate, spring-security]

# Dependency graph
requires:
  - phase: 02-auth-service
    plan: 01
    provides: transitional :8081 compose mapping + mem_limit 512m posture (smoke target and inspect assertions ride these), multi-stage Dockerfile rebuilt here
  - phase: 02-auth-service
    plan: 02
    provides: signup wire contract (201/409/400 envelopes) the smoke steps assert live
  - phase: 02-auth-service
    plan: 03
    provides: login/me token plane (200 AccessTokenPair, byte-exact 401s) the smoke steps assert live; SecurityConfig chain amended by this plan's Rule-1 fix
provides:
  - scripts/smoke-auth.sh — jq-free pure-curl 7-step live behavior gate (signup/duplicate/wrong-password/login//me auth//me anon/logout-absence) with AUTH_BASE_URL override; Phase 9 E2E chain member (D-10)
  - services/auth-service/README.md — endpoint table with explicit no-server-logout statement (client-side discard per contract D-03), env-var table, memory posture, run instructions, residual-risk note (AUTH-04 both proofs closed)
  - ERROR-dispatch law in SecurityConfig: internal Boot error rendering permitted, direct /error probes still denied — unmapped routes answer true 404, unhandled failures keep true 500 (was: blanket 403)
  - Closed phase gate: suite 20/20 + contracts + healthy compose + smoke ALL PASS + LF audit simultaneously green
affects: [phase-05 order-service (copies smoke-script shape + SecurityConfig dispatch law), phase-07 gateway (revokes :8081, verifies same tokens), phase-09 E2E (chains this script zero-manual-steps)]

actuals:
  tokens: 6500
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - jq-free smoke scripting: status-only assertions via curl -o /dev/null -w '%{http_code}', single sed accessToken lift, fail-fast labeled FAIL, ALL-PASS verdict line
    - dispatcherTypeMatchers(DispatcherType.ERROR).permitAll() as the deny-all companion — Boot error rendering must never be masked by authorization (template law for later JVM services)
    - Absence-as-contract enforcement: forbidden route probed WITH valid bearer expecting 404/405, locking frozen no-logout decision at runtime

key-files:
  created:
    - scripts/smoke-auth.sh
    - services/auth-service/README.md
  modified:
    - services/auth-service/src/main/java/com/ecommerce/auth/config/SecurityConfig.java
    - services/auth-service/src/test/java/com/ecommerce/auth/web/AuthFlowIntegrationTests.java

key-decisions:
  - "Fixed ERROR-dispatch masking (Rule 1): anyRequest().denyAll() was denying Boot's internal /error forward so every unmapped route (and unhandled failure) surfaced as blanket 403 — permitting only DispatcherType.ERROR restores contracted status semantics and makes the mandated 404 absence-proof observable"
  - "LF-audit assertion corrected to repo law (Rule 1): .gitattributes mandates CRLF working-tree encoding for mvnw.cmd, so the raw grep -i crlf==0 form is unsatisfiable by design; the law (check-contracts Stage 3) governs i/crlf index rows outside *.bat/*.cmd — asserted count-equals-zero"
  - "Smoke script prints statuses/verdicts only — never tokens or bodies (T-02-docleak); step 7 accepts 404 OR 405 per plan while this stack answers 404 post-fix"

patterns-established:
  - "Sibling smoke-script template (D-10): boxed header, ROOT via BASH_SOURCE, AUTH_BASE_URL-style env override, staged echoes, exit non-zero on first labeled FAIL, ALL PASS verdict — every later service copies"
  - "Phase-closing gate rhythm: rebuild image -> bounded health poll -> suite + contracts + compose ps + smoke + LF audit in one session, evidence recorded in SUMMARY"

requirements-completed: [AUTH-04, SC-5]

coverage:
  - id: D1
    description: "Standalone smoke gate (D-10/AUTH-04 runtime proof): signup 201, duplicate replay 409, wrong-password 401, login 200+token, /me bearer 200, /me anonymous 401, /auth/logout absence 404 — ALL PASS against rebuilt live stack"
    requirement: AUTH-04
    verification:
      - kind: e2e
        ref: "bash scripts/smoke-auth.sh (exit 0, 'ALL PASS 7/7' verdict, run twice against rebuilt compose stack)"
        status: pass
      - kind: integration
        ref: "tests/com.ecommerce.auth.web.AuthFlowIntegrationTests#unmappedRouteWithValidBearerTokenAnswersTrue404"
        status: pass
    human_judgment: false
  - id: D2
    description: "README documents client-side logout policy (AUTH-04 doc criterion): dedicated statement that no server session-invalidation route exists, paraphrasing contract info.description (D-03)"
    requirement: AUTH-04
    verification:
      - kind: other
        ref: "grep 'No logout endpoint exists' services/auth-service/README.md -> dedicated section citing docs/api-contracts/auth-service.openapi.yaml info.description"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full phase gate green simultaneously: ./mvnw test 20/20 (incl. Testcontainers slice), check-contracts.sh 0 fail, docker compose ps both healthy, smoke re-run ALL PASS, LF audit count-equals-zero"
    requirement: SC-5
    verification:
      - kind: e2e
        ref: "./mvnw test && bash scripts/check-contracts.sh && bash scripts/smoke-auth.sh && [ $(git ls-files --eol | grep 'i/crlf' | grep -vE '\\.(bat|cmd)$' | wc -l) -eq 0 ] (all exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Container posture intact after rebuild: Memory=536870912 (512m limit effective) and TRANSITIONAL HOST PORT comment survives in docker-compose.yml (D-09/D-03 pairing)"
    requirement: SC-5
    verification:
      - kind: other
        ref: "docker inspect ... --format '{{.HostConfig.Memory}}' = 536870912; grep TRANSITIONAL HOST PORT docker-compose.yml line 45"
        status: pass
    human_judgment: false
  - id: D5
    description: "README operator readability/completeness as a documentation artifact (tone, structure, usefulness to a new contributor)"
    verification: []
    human_judgment: true
    rationale: "Documentation quality is reader judgment; all mechanical content criteria are proven in D2/D3, but overall sufficiency for operators deserves a human skim"

duration: 19min
completed: 2026-08-25
status: complete
---

# Phase 2 Plan 4: Smoke Script, Logout Policy Docs & Phase Gate Summary

**jq-free 7-step curl smoke gate proving the full contracted auth surface live — including runtime enforcement of the frozen no-logout contract — plus README policy docs, an ERROR-dispatch correctness fix, and a fully green phase-close matrix (suite 20/20, contracts, healthy compose, LF law)**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-25T18:27:38Z
- **Completed:** 2026-08-25T18:46:51Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `scripts/smoke-auth.sh` committed: seven hard status assertions over pure curl (no jq on host) following check-contracts.sh house style — signup 201, identical-replay 409, wrong-password 401, correct login 200 with sed-lifted non-empty accessToken, bearer `/me` 200, anonymous `/me` 401, and the AUTH-04 centerpiece: POST `/auth/logout` with valid bearer answering **404**, proving the third write operation absent per frozen D-03. Exits non-zero on first labeled FAIL; prints ALL-PASS verdict; accepts `AUTH_BASE_URL` override for the Phase 7 gateway era
- `services/auth-service/README.md` committed: endpoint table for exactly the three contracted operations plus an explicit no-server-logout statement referencing the contract's info.description paragraph, consumed-env-vars table (names only, never values), MaxRAMPercentage=75 + mem_limit 512m memory-posture note, test/smoke run instructions, and the credential-stuffing residual-risk note deferred to Phase 7 gateway rate limiting
- **Rule-1 discovery fixed at the source:** the Wave-3 security chain masked ALL server-generated error statuses as 403 — Spring Security 6 authorizes Boot's internal `/error` ERROR dispatch, which `anyRequest().denyAll()` denied. One-line `dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()` amendment restores true 404/500 semantics (direct `/error` REQUEST probes remain denied); locked by a new integration test and proven live when smoke step 7 flipped 403→404
- Full phase verification gate green in one session: `./mvnw test` **20/20** (unit slice + Testcontainers postgres:18 slice incl. the new regression), `scripts/check-contracts.sh` all five stages ok (signup/login/getMe operationIds intact), `docker compose up -d --build` rebuilt image healthy via bounded poll, smoke re-run ALL PASS on the same stack, LF audit asserted count-equals-zero under repo-law semantics

### Roadmap SC 1–5 evidence map (Task 2 acceptance)

| # | Roadmap success criterion | Backing proof |
|---|---------------------------|---------------|
| 1 | Signup works; duplicates rejected; passwords hashed | Suite: `validSignupReturns201WithContractUserShape`, `duplicateEmailReturnsExact409ConflictEnvelope`, `storedCredentialIsBcryptHashNeverPlaintext`; live: smoke steps 1–2 |
| 2 | Valid credentials → signed JWT; invalid refused | Suite: `loginReturnsThreeSegmentHs256TokenWithCanonicalClaims`, `wrongPasswordAndUnknownEmailReturnByteIdentical401Envelopes`; live: smoke steps 3–4 |
| 3 | `/me` with JWT returns profile; without rejected | Suite: `meWithFreshBearerTokenReturnsSameUserShapeAsLogin` + six rejection methods; live: smoke steps 5–6 |
| 4 | Documented client-side logout, no server revocation | README D-03 section + smoke step 7 runtime absence assertion (404) |
| 5 | Multi-stage build, compose entry w/ healthcheck, standalone smoke | Rebuilt image healthy (`docker compose ps`), Memory=536870912, smoke-auth.sh ALL PASS |

## Task Commits

Each task committed atomically:

1. **Task 1 Rule-1 fix:** `64f0aea` (fix) — ERROR-dispatch permit + regression test (suite 20/20)
2. **Task 1: smoke-auth.sh + README logout-policy documentation** - `9962ea1` (feat)
3. **Task 2:** *(gate task, no repo files)* — matrix executed inline, results recorded here

**Plan metadata:** committed with STATE/ROADMAP/REQUIREMENTS updates (docs commit).

_Note: Task 1 carries two commits because the Rule-1 source fix landed separately from the declared feature files._

## Files Created/Modified

- `scripts/smoke-auth.sh` - 7-step live behavior gate; statuses only, never token values (T-02-docleak)
- `services/auth-service/README.md` - Service docs incl. the AUTH-04 policy statement and residual-risk register
- `services/auth-service/src/main/java/com/ecommerce/auth/config/SecurityConfig.java` - +dispatcherTypeMatchers(ERROR).permitAll() with explanatory comment (Rule-1 fix)
- `services/auth-service/src/test/java/com/ecommerce/auth/web/AuthFlowIntegrationTests.java` - +unmappedRouteWithValidBearerTokenAnswersTrue404 regression lock

## Decisions Made

- **Fix the masking bug rather than widen the assertion** (Rule 1 over shortcut): accepting 403 in the smoke script would have weakened the high-severity T-02-absence mitigation (a permission-gated forbidden endpoint would slip through) and permanently encoded "403 means absent" into the Phase 9 E2E chain. Restoring true 404 semantics keeps the absence proof exact and fixes system-wide status fidelity (500s were also being masked).
- **LF audit asserted under repo-law semantics:** the plan's literal `grep -i crlf | wc -l == 0` is unsatisfiable by design — `.gitattributes` mandates CRLF *working-tree* encoding for `mvnw.cmd` (index stays i/lf). Used the law's own form (check-contracts Stage 3): zero `i/crlf` index rows outside `*.bat/*.cmd`, asserted with explicit count-equals-zero.
- **Fail-fast over accumulation in the smoke script:** plan requires exiting non-zero on the FIRST failed step with a labeled message; research sanctioned either house habit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deny-all chain masked true 404/500 as blanket 403**
- **Found during:** Task 1 verification (smoke step 7 answered 403, expected 404/405)
- **Issue:** Spring Security 6 authorizes every dispatch type; Boot renders unmatched routes through an internal ERROR dispatch to `/error`, which `anyRequest().denyAll()` denied — every unmapped route (and any unhandled server failure) returned 403 Forbidden, breaking contracted status semantics platform-wide and blocking the mandated absence proof
- **Fix:** `.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()` as the first authorization rule (direct client requests to `/error` stay denied); added integration regression test
- **Files modified:** SecurityConfig.java, AuthFlowIntegrationTests.java (outside declared files_modified scope — necessary source fix, documented here)
- **Verification:** suite 20/20 green; image rebuilt; smoke step 7 now answers 404 and full script prints ALL PASS 7/7
- **Committed in:** 64f0aea

**2. [Rule 1 - Bug] Plan's literal LF-audit assertion contradicted repo EOL law**
- **Found during:** Task 2 matrix step 5
- **Issue:** `git ls-files --eol | grep -i crlf` counts working-tree rows too; `mvnw.cmd` legitimately shows w/crlf forever because `.gitattributes` assigns it `text eol=crlf`, making the planned count-equals-zero impossible on any correct checkout
- **Fix:** asserted the law's own predicate — zero `i/crlf` index rows outside `*.bat/*.cmd` (count-equals-zero test passed); additionally normalized the stale CRLF working copy of `.mvn/wrapper/maven-wrapper.properties` (index was already i/lf)
- **Files modified:** none in git (working-tree hygiene only; assertion run inline as specified by the gate-task design)
- **Verification:** explicit `[ "$LAW_CRLF_ROWS" -eq 0 ]` PASS; check-contracts Stage 3 independently confirms zero i/crlf
- **Committed in:** n/a (no repo change required)

---

**Total deviations:** 2 auto-fixed (2 bugs).
**Impact on plan:** Both fixes align execution with frozen contracts and repo law — the first was strictly necessary to make the plan's own 404/405 absence proof observable; the second corrected an unsatisfiable-by-design assertion to its intended legal semantics. No scope creep.

## Issues Encountered

- First root-cause probe used a never-signed-up email, so both probes returned entry-point 401s; redone with a real signed-up identity, which cleanly demonstrated 403-on-unmatched-route pre-fix.
- Docker health poll logged two transient `curl: (52) Empty reply` lines during JVM boot before reporting UP — normal Tomcat startup behavior, bounded poll handled it as designed.

## Authentication Gates

None — no external credentials required. Docker daemon already running (29.4.0) at start, satisfying Task 1's precondition.

## Known Stubs

None — smoke script fully wired to the live stack, README fully written; no placeholders, TODOs, or unwired paths.

## Threat Model Outcomes

- **T-02-absence (high, mitigate):** enforced at phase close — smoke step 7 fails the gate permanently if a served logout route ever appears (post-fix it answers 404 with a valid bearer; a future mapped implementation would answer 2xx and trip the gate)
- **T-02-docleak (medium, mitigate):** README documents env-var NAMES only; smoke script prints statuses and verdicts, never tokens/bodies
- **T-02-stuff (medium, accept):** residual risk recorded in README, deferred to Phase 7 GTWY-05 gateway rate limiting

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 2 complete — ready for `/gsd-verify-work 02`.** All four plans have summaries; AUTH-01…04 and SC-5 are backed by runnable proofs.

- Phase 3 (catalog-service) can copy: the smoke-script template (sibling-script pattern), Testcontainers UTC slice, Flyway/migration discipline, ERROR-dispatch law, and the memory-posture pairing
- Phase 7 (api-gateway): revoke the transitional :8081 mapping (comment marks the spot at docker-compose.yml line 45); smoke scripts flip to `AUTH_BASE_URL=http://localhost:8080/auth`
- Phase 9: chain `scripts/smoke-auth.sh` into the zero-manual-steps E2E (D-10 sibling-script pattern starts here)
- Pre-existing blockers carried in STATE.md unchanged (Mailpit/Motor stakeholder sign-off, Boot 3.5 EOL posture note, OneDrive sync caution)

---
*Phase: 02-auth-service*
*Completed: 2026-08-25*

## Self-Check: PASSED

Both created files exist on disk; task commits 64f0aea and 9962ea1 present in git log. Plan-level verification re-run this session: `./mvnw test` 20/20, `scripts/check-contracts.sh` exit 0 (all five stages), `bash scripts/smoke-auth.sh` ALL PASS 7/7 against the rebuilt healthy stack, LF audit count-equals-zero PASS under repo-law semantics, `docker inspect` Memory=536870912.
