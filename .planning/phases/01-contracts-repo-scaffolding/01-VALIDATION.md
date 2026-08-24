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
| 01-01-01 | 01 | 1 | CONTR-05 | — | N/A | static | `grep` manifest completeness check via scripts/check-contracts.sh | ❌ W0 | ⬜ pending |
| 01-02-01 | 01 | 1 | CONTR-01 | — | N/A | lint | `npx @stop/spectral/spectral-cli lint docs/api-contracts/*.yaml` | ❌ W0 | ⬜ pending |
| 01-03-01 | 01 | 1 | CONTR-02 | — | N/A | schema | node -e fenced-JSON topic-schema validator | ❌ W0 | ⬜ pending |
| 01-04-01 | 01 | 1 | CONTR-04 | — | LF enforcement prevents CRLF poisoning of shell scripts/.env | static | `git ls-files --eol` CRLF check | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Exact task IDs/commands to be finalized by planner; this map seeds the structure — planner updates it in PLAN.md frontmatter and VALIDATION.md is refined at validate-phase §6.)*

---

## Wave 0 Requirements

- [ ] `scripts/check-contracts.sh` — validation gate script (research proposes; mechanical verification of all five CONTR requirements)
- [ ] `.spectral.yaml` — Spectral ruleset (if Spectral linting adopted)
- [ ] jq is MISSING on this machine → all validators use `node -e`, never jq

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
