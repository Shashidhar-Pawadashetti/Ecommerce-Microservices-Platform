---
phase: 1
slug: contracts-repo-scaffolding
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash gate (`scripts/check-contracts.sh`, 5 stages) + Node stdlib validator (`scripts/validate-topic-schemas.mjs`) + Spectral CLI 6.16.3 via npx |
| **Config file** | `docs/api-contracts/.spectral.yaml` |
| **Quick run command** | `bash scripts/check-contracts.sh` |
| **Full suite command** | Same script (single gate) + manual fresh-clone LF spot-check below |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash scripts/check-contracts.sh`
- **After every plan wave:** Run `bash scripts/check-contracts.sh` (full)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T1 | 01-01 | 1 | D-07 governance | T-01-* | Sign-offs precede freeze | human checkpoint | recorded in 01-01-SUMMARY Decisions | ✅ | ✅ green |
| T2 | 01-01 | 1 | CONTR-04 | T-01-02 | LF law prevents CRLF poisoning | static | `git ls-files --eol \| grep i/crlf \| grep -vE "\.(bat\|cmd)$"` empty; attributes commit precedes scaffold | ✅ | ✅ green |
| T3 | 01-01 | 1 | CONTR-04 | T-01-01 | Placeholder-only secrets | static | `grep -c "=" .env.example >= 14`; SECRET/PASSWORD lines change-me only | ✅ | ✅ green |
| T1 | 01-02 | 2 | T-02-SC | T-02-SC | Supply-chain legitimacy | human checkpoint | verdict in 01-02-SUMMARY Decisions | ✅ | ✅ green |
| T2 | 01-02 | 2 | CONTR-01/02 infra | T-02-02 | Gate fails loudly on violations | behavior | `bash scripts/check-contracts.sh` exit 0 + validator exit ≠0 on missing-eventId fixture | ✅ | ✅ green |
| T3 | 01-02 | 2 | CONTR-01 | T-02-01/03 | Auth spec complete + secured ops declared | lint | `<automated>bash scripts/check-contracts.sh</automated>` green on auth tracer | ✅ | ✅ green |
| T1 | 01-03 | 2 | CONTR-05 | T-03-01 | Manifest pins frozen | static | pin greps ×20 + verified-date footer (now gate stage 4) | ✅ | ✅ green |
| T2 | 01-03 | 2 | CONTR-03 | T-03-03/04 | Interop rules + HS256 canon | static | `grep -c "^## Rule" docs/json-interop.md == 5`; HS256 present; negotiation-forbidden wording | ✅ | ✅ green |
| T1 | 01-04 | 3 | CONTR-01 | T-04-01..04 | Catalog+cart specs lint-clean, bounds present | lint | `<automated>npx spectral lint …</automated>` ×2 + gate | ✅ | ✅ green |
| T2 | 01-04 | 3 | CONTR-01 | T-04-02/05 | No client prices; internal-edge notes | static | response-side price greps; network-internal notes ≥4 | ✅ | ✅ green |
| T1 | 01-05 | 3 | CONTR-01 | T-05-01/03 | Orders spec: idempotent replay, enum D-01 | lint | `<automated>npx spectral lint orders…</automated>`; PENDING_PAYMENT greps | ✅ | ✅ green |
| T2 | 01-05 | 3 | CONTR-02 | T-05-02/04 | Topic schemas exact key sets; email payload tables | schema | `<automated>node scripts/validate-topic-schemas.mjs docs/kafka-topics.md && bash scripts/check-contracts.sh</automated>` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `scripts/check-contracts.sh` — validation gate script (built by Plan 01-02 Task 2)
- [x] `docs/api-contracts/.spectral.yaml` — Spectral ruleset (extends spectral:oas)
- [x] `scripts/validate-topic-schemas.mjs` — topic-schema validator (Node stdlib only)

*All Wave 0 infrastructure exists and runs green.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh Windows clone yields LF everywhere governed | CONTR-04 | Requires a true fresh clone outside current working tree | Clone repo to temp dir on Windows, run `git ls-files --eol`, confirm no `w/crlf` entries under .gitattributes-governed paths |

*All other phase behaviors have automated verification.*

---

## Validation Audit 2026-08-24

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All five CONTR requirements map to mechanical gate stages (lint/schema/EOL/manifest/coverage), all running green at audit time. Negative-path tests proven by verifier (validator exits non-zero on missing eventId, float totalCents, out-of-enum outcome).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-08-24
