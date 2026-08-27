---
phase: 03
slug: catalog-service
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-27
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x + pytest-asyncio 1.x |
| **Config file** | `services/catalog-service/pyproject.toml` (pytest section) |
| **Quick run command** | `cd services/catalog-service && pytest -q` |
| **Full suite command** | `cd services/catalog-service && pytest` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest -q`
- **After every plan wave:** Run `pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CAT-01 | T-03-01 | Public list needs no JWT | tracer/integration | `docker compose up -d mongo catalog-service && curl -s localhost:8000/health \| grep -q '"status":"ok"'` | ❌ W1 | ⬜ pending |
| 03-01-02 | 01 | 1 | CAT-02 | T-03-01 | Public detail needs no JWT | unit/integration | `cd services/catalog-service && pytest tests/test_list.py tests/test_get.py tests/test_models.py -q` | ❌ W1 | ⬜ pending |
| 03-02-01 | 02 | 2 | CAT-03 | T-03-01 | Category filter unauthenticated | unit | `cd services/catalog-service && pytest tests/test_filter.py -q` | ❌ W2 | ⬜ pending |
| 03-02-02 | 02 | 2 | CAT-04 | T-03-01 | Text search + sort unauthenticated | unit | `cd services/catalog-service && pytest tests/test_search.py -q` | ❌ W2 | ⬜ pending |
| 03-03-01 | 03 | 2 | CAT-05 | — | Seed idempotent (re-run no-op) | integration | `cd services/catalog-service && pytest tests/test_seed.py -q` | ❌ W2 | ⬜ pending |
| 03-04-01 | 04 | 3 | CAT-06 | T-03-01 | Confirm 3rd JWT holder (blocking checkpoint) | checkpoint | `<human-check>` user confirms deviation | — | ⬜ pending |
| 03-04-02 | 04 | 3 | CAT-06 | T-03-02 | Finalize JWT self-verify (base64, HS256, iss/aud/exp) | unit/integration | `cd services/catalog-service && pytest tests/test_models.py tests/test_list.py -q` | ❌ W3 | ⬜ pending |
| 03-04-03 | 04 | 3 | CAT-06 | T-03-02 | Admin CRUD requires valid JWT | integration | `cd services/catalog-service && pytest tests/test_admin.py -q` | ❌ W3 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/catalog-service/tests/conftest.py` — Mongo testcontainer / mocked AsyncMongoClient fixture
- [ ] `services/catalog-service/tests/test_list.py` — stubs for CAT-01
- [ ] `services/catalog-service/tests/test_get.py` — stubs for CAT-02
- [ ] `services/catalog-service/tests/test_filter.py` — stubs for CAT-03
- [ ] `services/catalog-service/tests/test_search.py` — stubs for CAT-04
- [ ] `services/catalog-service/tests/test_seed.py` — stubs for CAT-05
- [ ] `services/catalog-service/tests/test_admin.py` — stubs for CAT-06

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Swagger UI shows admin endpoints behind bearerAuth | CAT-06 | OpenAPI security scheme is structural; best confirmed visually | Open `/docs`, confirm write routes show lock + 401 without token |
| Placeholder SVG images render in browser | CAT-05 | Static file serving + content-type verification | curl `/catalog/static/prod-1001.svg` returns image/svg+xml |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
