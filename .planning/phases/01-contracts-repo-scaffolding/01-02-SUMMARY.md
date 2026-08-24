---
phase: 01-contracts-repo-scaffolding
plan: 02
status: in-progress
---

# Phase 1 Plan 02: Validation Gate & Auth Contract Tracer — SUMMARY

**Five-stage mechanical contract gate (`check-contracts.sh`) proven end-to-end on the complete auth-service OpenAPI tracer slice.**

## Decisions Made

### Task 1 — Package-legitimacy checkpoint resolution (checkpoint:human-verify, gate=blocking-human)

**Package:** `@stoplight/spectral-cli` pinned at **6.16.3** (the linting dependency this phase executes via npx; flagged SUS by the research audit — "too-new" release-freshness flag on the latest publish only).

**Verification URLs checked (per task how-to-verify):**
- https://www.npmjs.com/package/@stoplight/spectral-cli
- https://github.com/stoplightio/spectral

**Legitimacy evidence reviewed and accepted:**
- Weekly downloads ≈ **1.66M** — long-established, massively adopted project.
- Source repo is the **official stoplightio org** (`github.com/stoplightio/spectral`), active, not archived/deprecated.
- License Apache-2.0; maintained under SmartBear stewardship.
- **No install/postinstall lifecycle scripts** on the package (`npm view` returned empty scripts).
- Registry-published; the SUS flag is a **release-freshness false positive** (flag fired on the 2026-08-03 publish only, contradicting all adoption signals).

**Chosen execution path:** ✅ **npx** — user responded `approved`. All lint invocations use `npx -y @stoplight/spectral-cli@6.16.3` (pinned, deterministic). Telemetry muted where practical via `SCARF_ANALYTICS=false` on the Spectral invocation.

**Documented fallbacks (not needed):** official Docker image `stoplight/spectral`, or defer lint automation to Phase 2 keeping only the script skeleton.

**Per-task consequence:** Tasks 2–3 verify commands run Spectral through the approved npx path.
