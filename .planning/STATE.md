---
gsd_state_version: 1.0
current_phase: 04
status: complete
stopped_at: Completed 04-04-SUMMARY.md
last_updated: "2026-08-27T19:30:00.000Z"
last_activity: 2026-08-27
last_activity_desc: Phase 04 marked complete
state_head: 86c146b07fda3a823e9065a4efa357830bbb3c41
progress:
  total_phases: 10
  completed_phases: 4
  total_plans: 17
  completed_plans: 17
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-24)

**Core value:** Complete end-to-end purchase journey — signup → browse → cart → checkout → payment → order status → notification — across all services through the gateway, verified by `docker compose up` plus a scripted smoke test.
**Current focus:** Phase 04 — Cart Service (complete)

## Current Position

Phase: 04 — COMPLETE
Plan: 4 of 4
Status: Phase 04 complete
Last activity: 2026-08-27 — Phase 04 marked complete

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02 P01 | 22min | 2 tasks | 10 files |
| Phase 02 P02 | 15min | 2 tasks | 12 files |
| Phase 02 P03 | 28min | 2 tasks | 11 files |
| Phase 02 P04 | 19min | 2 tasks | 4 files |
| Phase 03 P01 | 50 min | 2 tasks | 20 files |
| Phase 03 P02 | 18 min | 2 tasks | 4 files |
| Phase 03 P03 | 25min | 2 tasks | 27 files |
| Phase 03-catalog-service P04 | 35min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap follows the research-validated 10-phase build order; Phase 1 widened to own repo scaffolding (.gitattributes before first Java commit) + pinned version manifest + JSON interop rules
- Phase 9 reframed as cold-start reproducibility audit — each service joins Compose incrementally in its own phase
- Order + Payment kept as one inseparable phase (single Kafka saga; kill/restart redelivery test lives there)
- Gateway placed late deliberately: standalone ports revoked in Phase 7 as its isolation verify
- [Phase 02]: Auth-service skeleton: wrapper via host Maven 3.9.12 (only-script type); compose uses single-word SPRING_DATASOURCE_* spellings (relaxed-binding correction vs research draft)
- [Phase 02]: D-02 read literally in compose: POSTGRES_DB=users only; Phase-5 initdb.d obligation (init-script backfill + one-time CREATE DATABASE) recorded as compose comment
- [Phase 02]: A4 disposition held: release-21 bytecode targeting on host JDK 23.0.1; A2 (mem_limit effective, Memory=536870912) and A5 (BusyBox wget -qO- healthcheck) empirically confirmed
- [Phase 02]: Surefire UTC pin: pgjdbc transmits host TZ at connect; postgres:18 tzdata rejects legacy names - test JVMs pinned UTC (Rule 3, template for later slices)
- [Phase 02]: Two-layer race-safe duplicate detection: findByEmail fast signal + users_email_uniq DataIntegrityViolation translation to identical 409 envelope (AUTH-01)
- [Phase 02]: ERROR-dispatch law: deny-all chains must permit DispatcherType.ERROR so Boot renders true 404/500 (deny-all was masking all server error statuses as blanket 403) — Restores contracted status semantics; without it the mandated logout-absence proof (404/405) was unobservable — smoke gate now proves absence via true 404
- [Phase 02]: Phase 02 closed with runtime absence enforcement: smoke-auth.sh step 7 fails permanently if a served /auth/logout route ever appears (T-02-absence) — AUTH-04 closed by two independent proofs: scripted runtime absence assertion + README policy statement referencing contract D-03
- [Phase 03]: Catalog uses pymongo AsyncMongoClient (>=4.9); Motor forbidden per STACK.md. — Native asyncio client avoids deprecated Motor; matches research Pattern 5.
- [Phase 03]: uv is the single dependency manager: committed uv.lock; Dockerfile installs via uv sync, README documents uv sync / uv run (parity with payment-service). — Single DM avoids drift; uv.lock pins the resolved graph per versions.md.
- [Phase 03]: Unified error envelope emitted as compact json.dumps(separators=(',',':')) so byte-exact bodies (NOT_FOUND/UNAUTHORIZED) are reproducible and the /health grep matches '"status":"ok"'. — Exact-envelope assertions required by 03-PATTERNS Pattern 1/Shared Pattern 4.
- [Phase 03]: require_auth dependency defined now (security.py) so Plan 04 admin routes import it without refactor; not yet wired to public routes per plan. — Satisfies T-03-01 default-deny mutating routes without later refactor (plan must-have).
- [Phase 03]: Catalog is the third JWT_SECRET holder in v1 (with auth-service + gateway); self-verify is defense-in-depth; deviation recorded for DOCS-02 runbook. — json-interop.md names exactly two holders; catalog self-verify is a v1 deviation to document.
- [Phase 03]: Catalog listProducts uses explicit sort_spec with deterministic _id tie-break for repeatable pagination (CAT-04).
- [Phase 03]: Category filter is exact-match only; q adds $text clause only when non-empty (T-03-03 NoSQL-injection guard).
- [Phase 03]: 03-03: StaticFiles serves the whole static/ tree (mount root moved up one level) so the planned contract URL /catalog/static/products/{id}.svg resolves to static/products/{id}.svg; seed uses products_collection() public accessor from Plan 01 (no new Mongo connection logic).
- [Phase 03]: Catalog is the third JWT_SECRET holder: self-verifies HS256 in-process because the api-gateway is Phase 7 but CAT-06 mandates 401-on-invalid in Phase 3; retained as defense-in-depth post-Phase-7; documented in README + slated for docs/runbook.md (DOCS-02).

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-Phase 1] Stakeholder sign-off needed on research deviations before contracts freeze: MailHog→Mailpit, Motor→PyMongo AsyncMongoClient
- [Pre-Phase 1] Decide Spring Boot 3.5 posture (OSS EOL 2026-06-30): stay pinned vs bump to Boot 4.0 — record choice in runbook
- [Environment] OneDrive sync on this repo path flagged as file-lock risk during builds — consider excluding project dir from sync

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-27T12:48:56.406Z
Stopped at: Completed 03-04-PLAN.md
Resume file: None
