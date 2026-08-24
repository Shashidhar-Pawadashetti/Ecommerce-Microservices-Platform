---
phase: 01-contracts-repo-scaffolding
plan: 01
subsystem: infra
tags: [gitattributes, monorepo-scaffolding, env-template, docker-compose, repo-hygiene]

requires:
  - phase: none
    provides: greenfield repo — only planning-artifact commits precede this plan
provides:
  - ".gitattributes LF law (text=auto eol=lf catch-all, *.bat/*.cmd crlf, binary exceptions) committed before any content file"
  - ".editorconfig (UTF-8, LF, per-language indent)"
  - "Extended .gitignore (.env hygiene with !.env.example, polyglot build artifacts, research cache)"
  - "Seven-service monorepo skeleton under services/ per build-plan §2"
  - "Root README with contracts-first policy and line-ending contributor note"
  - "docker-compose.yml placeholder header (no service keys until Phase 2)"
  - ".env.example: 15 contractual variable names, placeholder-only values"
affects: [02-tooling-gates, 03-version-manifest-docs, 04-rest-contracts, 05-kafka-topics-contracts, catalog-service, cart-service, order-service, payment-service, notification-service, api-gateway, auth-service]

actuals:
  tokens: 4400    # chars/4 over realized diff (~17.6 KB across 14 files + this summary)
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Contracts-first policy: committed specs in docs/ are the source of truth; code changes start there"
    - "Line-ending law: .gitattributes pairs text WITH eol=lf (bare text insufficient on Windows); committed before any content file"

key-files:
  created:
    - .gitattributes
    - .editorconfig
    - README.md
    - docker-compose.yml
    - .env.example
    - services/api-gateway/.gitkeep
    - services/auth-service/.gitkeep
    - services/catalog-service/.gitkeep
    - services/cart-service/.gitkeep
    - services/order-service/.gitkeep
    - services/payment-service/.gitkeep
    - services/notification-service/.gitkeep
  modified:
    - .gitignore

key-decisions:
  - "D-07 APPROVED (all three): MailHog→Mailpit (axllent/mailpit); Motor→PyMongo AsyncMongoClient (pymongo >=4.9); Spring Boot pinned 3.5.16 + Spring Cloud 2025.0.3 despite OSS EOL (upgrade path noted for Phase 10 runbook)"

patterns-established:
  - "LF-only law: all governed text files normalize to LF in index AND worktree on every platform; *.bat/*.cmd are the only CRLF exceptions"
  - "Secrets hygiene pairing: .env gitignored from commit one; .env.example is the tracked placeholder template"
  - "Env var names are contractual: later phases add variables to .env.example, never rename"

requirements-completed: [CONTR-04]

coverage:
  - id: D1
    description: ".gitattributes LF law + .editorconfig + extended .gitignore committed as their own commit before any scaffold file; index renormalized and provably CRLF-free on governed paths"
    requirement: CONTR-04
    verification:
      - kind: other
        ref: "git ls-files --eol | grep 'i/crlf' | grep -vE '\\.(bat|cmd)$' → empty output (exit-checked)"
        status: pass
      - kind: other
        ref: "git check-attr eol -- .env.example → 'eol: lf'"
        status: pass
      - kind: other
        ref: "grep -n '^\\.env$' .gitignore && grep -n '^!\\.env\\.example$' .gitignore → both present (lines 4/6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seven service directories exist exactly as build-plan §2 names them, each tracked via .gitkeep"
    requirement: CONTR-04
    verification:
      - kind: other
        ref: "ls services → exactly api-gateway, auth-service, cart-service, catalog-service, notification-service, order-service, payment-service (count=7); ls services/*/.gitkeep → 7"
        status: pass
    human_judgment: false
  - id: D3
    description: "README (contracts-first policy, docs/ pointer, no-attribute-override note), comments-only docker-compose.yml placeholder, and .env.example with ≥14 contractual placeholder-only variables"
    requirement: CONTR-04
    verification:
      - kind: other
        ref: "grep -c 'contracts-first' README.md → 1; grep -c '^#' docker-compose.yml → 14; grep -cE '^[a-zA-Z_-]*:' docker-compose.yml → 0; grep -c '=' .env.example → 15; grep -nE '(SECRET|PASSWORD)=' .env.example → change-me placeholders only"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-07 stakeholder sign-off outcomes recorded under a Decisions heading naming Mailpit, PyMongo AsyncMongoClient, and the Boot 3.5.16 pin explicitly"
    verification:
      - kind: other
        ref: "grep -E 'Mailpit|AsyncMongoClient|3\\.5\\.16' .planning/phases/01-contracts-repo-scaffolding/01-01-SUMMARY.md → all three named under ## Decisions"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-08-24
status: complete
---

# Phase 1 Plan 01: Repo Hygiene Law & Monorepo Skeleton Summary

**D-07 sign-offs recorded (Mailpit / PyMongo AsyncMongoClient / Boot 3.5.16 pin), LF-only .gitattributes law committed ahead of all content, seven-service monorepo skeleton scaffolded with placeholder-values-only .env.example**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-24T16:23:39Z
- **Completed:** 2026-08-24T16:32:30Z
- **Tasks:** 3
- **Files created/modified:** 14 (12 created, 1 modified, 1 planning doc)

## Accomplishments

- D-07 governance gate cleared: all three research deviations approved (`approve-all`) and recorded — contracts freeze unblocked for Plans 02–05
- Line-ending law established first among content commits: `.gitattributes` (`* text=auto eol=lf` catch-all + `*.bat`/`*.cmd` CRLF + binary exceptions + explicit `mvnw`), `.editorconfig`, extended `.gitignore`, with a one-time `git add --renormalize .`; index verified CRLF-free on governed paths
- Monorepo skeleton matches build-plan §2 exactly: seven `services/<name>/` dirs with `.gitkeep`
- Root README documents the contracts-first policy, docs/ architecture pointer, and the "do not override `.gitattributes` via `.git/info/attributes`" contributor rule
- `docker-compose.yml` ships as comments-only placeholder ("grows incrementally starting Phase 2 per build plan §4")
- `.env.example` freezes all 15 variable names Phases 2–9 consume, grouped by concern, values placeholder-only, with the Mailpit note per D-07

## Task Commits

Each task was committed atomically:

1. **Task 1: Pre-freeze stakeholder sign-off (D-07 checkpoint)** - `59922bd` (docs)
2. **Task 2: Line-ending law + renormalize** - `96e0d00` (chore)
3. **Task 3: Monorepo skeleton + README + compose placeholder + .env.example** - `924cdd9` (feat)

**Plan metadata:** final docs commit (this file + deferred-items.md).

_All hashes verified against `git log` at self-check time._

## Files Created/Modified

- `.gitattributes` — LF law: `* text=auto eol=lf`, batch-file CRLF exceptions, binary exceptions, explicit `mvnw text eol=lf`
- `.editorconfig` — UTF-8 / LF / final newline; md keeps trailing whitespace; 2-space web formats, 4-space Python, tab Makefile
- `.gitignore` (modified) — preserved `.opencode`; added `.env`/`.env.*` with `!.env.example`, `node_modules/`, `target/`, `__pycache__/`, `.venv/`, `dist/`, `build/`, `*.log`, `.DS_Store`, `.planning/research/.cache/`
- `README.md` — overview, architecture pointer, contracts-first policy, layout table, quick-start stub, line-ending contributor note
- `docker-compose.yml` — header comment block only (no service keys by design until Phase 2)
- `.env.example` — 15 grouped variables, placeholders only, policy header
- `services/{api-gateway,auth-service,catalog-service,cart-service,order-service,payment-service,notification-service}/.gitkeep` — skeleton markers

## Decisions Made

### D-07 — Pre-freeze stakeholder sign-off on research deviations (checkpoint:decision)

**Outcome: `approve-all` — all three deviations approved as researched (recorded 2026-08-24).**

1. **MailHog → Mailpit (`axllent/mailpit`) — APPROVED.**
   Drop-in replacement on the same ports (SMTP :1025, web UI :8025); actively maintained vs MailHog unmaintained since ~2020. Mailpit's REST API `/api/v1/messages` becomes the Phase 9 smoke-test assertion surface for email-content contracts. Later plans (01-03 versions manifest, 01-05 kafka-topics.md) reference Mailpit by name.
2. **Motor → PyMongo AsyncMongoClient (`pymongo >=4.9`) — APPROVED.**
   Motor was deprecated 2025-05-14 (EOL 2026-05-14); the native asyncio API `pymongo.AsyncMongoClient` is the official replacement and supports MongoDB 8.0. Referenced by name in the versions manifest and catalog-service plans.
3. **Spring Boot pinned at 3.5.16 + Spring Cloud 2025.0.3 (Northfields) despite OSS support ending 2026-06-30 — APPROVED.**
   Acceptable for a local learning target; upgrade path (Boot 4.0.x + Spring Cloud 2025.1 Oakwood) noted for the Phase 10 runbook. All three Java services inherit this pin.

**Effect:** Plans 03–05 copy these values mechanically into frozen manifests/docs without replanning.

## Deviations from Plan

None — plan executed exactly as written. (The one-time `git add --renormalize .` was planned work, executed as specified.)

## Issues Encountered

- **Renormalize swept in orchestrator-owned dirty files.** `git add --renormalize .` staged pre-existing working-tree modifications to `.planning/STATE.md` and `.planning/config.json` (dirty before execution began). These were unstaged (`git restore --staged`) so only plan-owned files landed in the Task 2 commit; orchestrator edits remain untouched in the working tree.
- **Pre-existing tracked cache blobs (out of scope, logged).** Some `.planning/research/.cache/*.json` files were committed by earlier planning commits before any ignore rule existed; the new `.gitignore` line stops future additions but does not untrack them. Untracking was out of scope for this plan — logged to [deferred-items.md](./deferred-items.md).
- **README acceptance grep case sensitivity.** First draft contained only capitalized "Contracts-first"; added a lowercase in-prose occurrence to satisfy the literal phrase check.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None beyond intentional, plan-designed placeholders: `docker-compose.yml` is comments-only by design until Phase 2 (enforced by the plan's prohibition), and the README quick-start explicitly says compose grows per phase. No code stubs exist — no service code lands in this plan.

## Next Phase Readiness

- Contracts freeze unblocked: Plans 02–05 can reference Mailpit, PyMongo AsyncMongoClient, and the Boot 3.5.16/SC 2025.0.3 pins mechanically
- LF law is in force before any contract or code file exists; Plan 02's mechanical i/crlf gate reuses the same `git ls-files --eol` check proven here
- `.env.example` variable names frozen for Phases 2–9; Phase 2 begins adding infrastructure services to `docker-compose.yml`
- Minor carry-over: untracking the pre-existing research-cache blobs (see deferred-items.md)

---
*Phase: 01-contracts-repo-scaffolding*
*Completed: 2026-08-24*

## Self-Check: PASSED

- All 13 claimed files exist on disk (verified 2026-08-24T16:32:40Z)
- All 3 task commits exist in history: `59922bd`, `96e0d00`, `924cdd9`
- Post-plan gate re-run: `git ls-files --eol | grep 'i/crlf' | grep -vE '\.(bat|cmd)$'` → empty (index CRLF-free)
