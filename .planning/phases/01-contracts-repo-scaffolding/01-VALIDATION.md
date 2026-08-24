---
phase: 1
slug: contracts-repo-scaffolding
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node-based contract checks (`node --test` / `node -e` assertions) + Spectral CLI 6.x for OpenAPI linting |
| **Config file** | `.spectral.yaml` (Wave 0 creates if Spectral lint adopted) |
| **Quick run command** | `bash scripts/check-contracts.sh --quick` |
| **Full suite command** | `bash scripts/check-contracts.sh` |
| **Estimated runtime** | ~15–30 seconds (Spectral lint + JSON schema parse + EOL check + manifest grep) |

---

## Sampling Rate

- **After every task commit:** Run `bash scripts/check-contracts.sh --quick`
- **After every plan wave:** Run `bash scripts/check-contracts.sh`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | D-07 gate | — | Pre-freeze sign-offs recorded before contracts freeze | human | checkpoint:decision (Mailpit / PyMongo AsyncMongoClient / Boot 3.5.16 posture) | — | ⬜ pending |
| 01-01-02 | 01 | 1 | CONTR-04 | T-01-02 | LF enforcement prevents CRLF poisoning of shell scripts/.env/mvnw | static | `git ls-files --eol \| grep "i/crlf" \| grep -vE "\.(bat\|cmd)$"` must output nothing | ✅ (git ≥2.8 present) | ⬜ pending |
| 01-01-03 | 01 | 1 | CONTR-04 | T-01-01 | .env.example carries placeholder values only; skeleton matches build-plan §2 | static | `grep -nE "(SECRET\|PASSWORD)=" .env.example` shows change-me placeholders only; `ls services` lists exactly 7 dirs | ❌ W0 (files are this plan's deliverable) | ⬜ pending |
| 01-02-01 | 02 | 2 | (gate precondition) | T-02-SC | Supply-chain legitimacy of Spectral CLI verified by human before first run | human | `checkpoint:human-verify gate=blocking-human` on @stoplight/spectral-cli@6.16.3 (npmjs + GitHub evidence) | — | ⬜ pending |
| 01-02-02 | 02 | 2 | CONTR-01…05 harness | T-02-SC | Mechanical drift gate across all five CONTR dimensions (existence-guarded for incremental waves) | composite | `bash scripts/check-contracts.sh` | ❌ W0 (the script is itself a Phase 1 deliverable) | ⬜ pending |
| 01-02-03 | 02 | 2 | CONTR-01 | T-02-01, T-02-03, T-02-04 | Auth contract: HS256 pinned, public/protected matrix explicit, Error envelope no-leak policy | lint | `npx -y @stoplight/spectral-cli@6.16.3 lint docs/api-contracts/*.openapi.yaml --ruleset docs/api-contracts/.spectral.yaml --fail-severity=warn` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | CONTR-05 | T-03-01 | Manifest lists every required component with exact pin + verified-date footer | static | one `grep -q '<Component>.*<pin>' docs/versions.md \|\| FAIL=1` per Pattern 5 checklist item (~20 components) | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | CONTR-03 | T-03-02, T-03-03 | Five interop rules documented; JWT claims/secret canon single-homed | static | `grep -c "^## Rule" docs/json-interop.md` == 5; `grep -q "ecommerce-auth" && grep -q "ecommerce-api"`; HS256 present | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 3 | CONTR-01 | T-04-03 | Catalog matrix: GETs public, mutations bearerAuth; batch internal edge spelled | lint+static | gate green + `grep -c "operationId" catalog yaml >= 7` + security-on-mutation greps | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 3 | CONTR-01 | T-04-01, T-04-02 | Identity from sub only (no userId in request bodies); totals server-side integer cents | lint+static | gate green + awk requestBody/userId negative grep + `minimum: 1` count >= 2 | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 3 | CONTR-01 | T-05-01, T-05-03 | Orders protected matrix; Idempotency-Key required; replay 200 vs create 201; enum D-01 spellings | lint+static | gate green + `grep -nE 'PENDING([^_]\|$)' orders yaml` empty + IdempotencyKey grep | ❌ W0 | ⬜ pending |
| 01-05-02 | 05 | 3 | CONTR-02 | T-05-02 | Topic schemas parse; REQUIRED keys/outcome enum asserted; dedup + email payload sections present | schema | `node scripts/validate-topic-schemas.mjs docs/kafka-topics.md` then full gate | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Map finalized by plan-phase 2026-08-24: task IDs match `{phase}-{plan}-{task}` in 01-01…01-05-PLAN.md. All "W0" files are in-plan deliverables (greenfield repo — no pre-existing test infra); every row has an automated command or an explicit human gate.*

---

## Wave 0 Requirements

- [x] `scripts/check-contracts.sh` — validation gate script → created by plan 01-02 Task 2 (research proposes; mechanical verification of all five CONTR requirements)
- [x] `.spectral.yaml` — Spectral ruleset → created by plan 01-02 Task 2 (`extends: ['spectral:oas']` + info.description rule)
- [x] `scripts/validate-topic-schemas.mjs` — topic-schema validator (Node stdlib only) → created by plan 01-02 Task 2, exercised against real content by plan 01-05 Task 2
- [x] jq is MISSING on this machine → all validators use `node -e` / node scripts, never jq (enforced by gate AC in plan 01-02)
- [x] Package legitimacy: `@stoplight/spectral-cli@6.16.3` SUS flag resolved via blocking-human checkpoint before first npx run (plan 01-02 Task 1)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh Windows clone yields LF everywhere governed | CONTR-04 | Requires a true fresh clone outside current working tree | Clone repo to temp dir on Windows, run `git ls-files --eol`, confirm no `w/crlf` entries under .gitattributes-governed paths |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
