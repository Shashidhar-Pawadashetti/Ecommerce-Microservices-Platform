---
phase: 5
slug: order-payment-services
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (order-service)** | JUnit 5 + Spring Boot Test + `spring-kafka-test` (EmbeddedKafka) + Testcontainers PostgreSQL |
| **Framework (payment-service)** | pytest 9.x + pytest-asyncio (auto) + httpx + Testcontainers Kafka (or shared compose broker) |
| **Config file (order)** | `src/test/resources/application-test.yml` (EmbeddedKafka + test Postgres) |
| **Config file (payment)** | `pyproject.toml [tool.pytest.ini_options]` (asyncio_mode=auto) |
| **Quick run command (order)** | `./mvnw -q test` |
| **Full suite command (order)** | `./mvnw -q test` |
| **Quick run command (payment)** | `uv run pytest -q` |
| **Full suite command (payment)** | `uv run pytest` |
| **Estimated runtime** | ~60–120s per service (Testcontainers boot) |

---

## Sampling Rate

- **After every task commit (order-service):** `./mvnw -q test` (EmbeddedKafka + Testcontainers PG)
- **After every task commit (payment-service):** `uv run pytest -q`
- **After every plan wave:** Full suite of both services green
- **Before `/gsd-verify-work`:** Full suites + the ORDR-08 compose kill-test must be green
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | ORDR-01 | — | N/A | integration | `./mvnw -q test` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | ORDR-02 | — | N/A | integration | `./mvnw -q test` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 0 | ORDR-03 | — | N/A | integration | `uv run pytest -q` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 0 | ORDR-04 | — | N/A | unit | `./mvnw -q test` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 0 | ORDR-05 | — | N/A | integration | `./mvnw -q test` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 0 | ORDR-06 | — | N/A | integration | `./mvnw -q test` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 0 | ORDR-07 | V4 Access Control | Order scan filtered by `sub`; 404 on other user | integration | `./mvnw -q test` | ❌ W0 | ⬜ pending |
| 5-05-01 | 05 | 0 | ORDR-08 | — | N/A | compose e2e | `docker kill` + poll `GET /orders/{id}` | ❌ Phase 9 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/order-service/src/test/...` — saga + idempotency + state-machine tests (ORDR-01..07)
- [ ] `services/payment-service/tests/test_saga.py` — consumer dedup + produce per PAYMENT_MODE (ORDR-03)
- [ ] `application-test.yml` for order-service (EmbeddedKafka + Testcontainers PG)
- [ ] Shared test broker fixture for payment-service (Testcontainers `KafkaContainer` KRaft, or reuse compose kafka in integration profile)
- [ ] One compose-level script asserting ORDR-08 (kill payment-service, poll to terminal)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kill/restart payment-service converges to terminal state | ORDR-08 | Requires live compose + process kill; orchestrated at Phase 9 smoke test | `docker kill` payment-service mid-flow, poll `GET /orders/{id}` until PAID/PAYMENT_FAILED; verify via kafka-ui |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
