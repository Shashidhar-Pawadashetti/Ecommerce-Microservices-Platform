---
phase: 1
slug: contracts-repo-scaffolding
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-24
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| developer workstation → git history | Everything committed here becomes immutable context for fresh-context milestone agents | contracts, manifests, env var names |
| .env.example → .env copies | Variable NAMES are contractual; values must never be real | secret placeholders |
| npm registry → dev machine | npx executes third-party code during lint | package payloads (Spectral) |
| contract file → Phase 7 gateway implementation | Public-vs-protected classification encoded here becomes enforced authorization behavior | route security matrix |
| unauthenticated client → auth endpoints | Signup/login accept untrusted credentials input | credentials shapes |
| authenticated client → cart/order mutations | JWT sub is the only identity source; bodies untrusted | identity + cart/order payloads |
| cart-service ↔ catalog-service / order-service → cart-service | Internal sync edges trust network placement, validate payload shapes | batch pricing, checkout read |
| Kafka consumers ↔ producers | At-least-once redelivery means duplicate/malicious event replays cross service boundaries | order/payment events |
| email renderer → recipient mailbox | Event fields flow verbatim into emails | notification content |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Information Disclosure | .env.example | high | mitigate | Placeholder-only values (acceptance grep); `.gitignore` excludes `.env`, keeps `!.env.example` | closed |
| T-01-02 | Tampering | .gitattributes / shell scripts / mvnw | high | mitigate | `text eol=lf` pairing + renormalize pass; mechanical i/crlf gate stage 3 — zero CRLF in index verified | closed |
| T-01-03 | Denial of Service | docker-compose.yml | low | accept | Placeholder-comment-only file; real compose arrives Phase 2+ | closed |
| T-01-SC | Tampering | npm installs (this plan) | high | mitigate | No installs occur; delegated to T-02-SC gate | closed |
| T-02-SC | Tampering | npx @stoplight/spectral-cli install/run | high | mitigate | Blocking human legitimacy checkpoint — verdict recorded in 01-02-SUMMARY (1.66M dl/wk, official stoplightio repo, Apache-2.0, no lifecycle scripts, SmartBear maintainers, registry-signed); pinned @6.16.3; SCARF_ANALYTICS=false | closed |
| T-02-01 | Spoofing | JWT verification contract | critical | mitigate | HS256 pinned by name on issue AND verify sides (never negotiated) ×3 in auth spec; iss/aud frozen; forgery tests assigned Phase 7 | closed |
| T-02-02 | Information Disclosure | Error envelope | medium | mitigate | Shared Error schema forbids hostnames/stack traces/driver errors; stable `code` correlation field | closed |
| T-02-03 | Elevation of Privilege | /auth/me classification | high | mitigate | `/auth/me` declares `security: [bearerAuth: []]`; signup/login declared public — matrix acceptance-grepped | closed |
| T-02-04 | Spoofing | Secret handling conventions | high | mitigate | CSPRNG ≥32 bytes, two-holder restriction (auth+gateway), startup length assertion, never-log/never-commit rules in json-interop.md | closed |
| T-03-01 | Tampering | docs/versions.md pins | medium | mitigate | Mechanical copy from STACK.md; gate stage 4 enforces all 20 pins + verified footer every run (green) | closed |
| T-03-02 | Information Disclosure | JWT secret conventions | high | mitigate | Canon states CSPRNG ≥32 bytes, holder restriction, never-log/never-commit | closed |
| T-03-03 | Spoofing | Algorithm selection | critical | mitigate | HS256 pinned by name; negotiation explicitly forbidden — canonical wording in json-interop.md | closed |
| T-03-04 | Repudiation | Ambiguous rule precedence | low | accept | Schema-wins-over-prose clause removes interpretive wiggle | closed |
| T-04-01 | Spoofing | Identity via request body | high | mitigate | Contract forbids userId in bodies (awk-proven zero matches); identity exclusively from verified sub claim | closed |
| T-04-02 | Tampering | Client-supplied prices/totals | high | mitigate | Bodies carry productId+quantity only; all price fields response-side recomputed server-side | closed |
| T-04-03 | Elevation of Privilege | Catalog write endpoints | high | mitigate | create/update/delete each declare bearerAuth (verified ×3); only GETs public per GTWY-03 matrix | closed |
| T-04-04 | Denial of Service | Unbounded quantities/lists | medium | mitigate | quantity minimum 1; limit maximum 100; batch minItems 1 (bounds present ×6 across specs) | closed |
| T-04-05 | Information Disclosure | Internal edge exposure | medium | mitigate | Internal edges described network-internal, not-gateway-routed (×6 notes); Phase 7 port revocation enforces mechanically | closed |
| T-05-01 | Elevation of Privilege | Orders endpoints classification | high | mitigate | All three REST ops declare bearerAuth; /health alone public-internal — matrix transcribed verbatim by Phase 7 | closed |
| T-05-02 | Tampering | Redelivery/duplicate events | high | mitigate | Per-consumer dedup contracts written INTO topic contract (orderId authz check, eventId dedupe, terminal-state guards) — ×10 references | closed |
| T-05-03 | Repudiation | Replay ambiguity | medium | mitigate | D-05 locked: 201 create vs 200 replay at HTTP level; Idempotency-Key required header parameter | closed |
| T-05-04 | Information Disclosure | userEmail into events/emails | low | accept | User's own email to their own address IS the feature (NOTF-02); no third-party recipients in v1 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-03 | docker-compose.yml is placeholder-comment-only this phase; cannot misconfigure anything until Phase 2+ delivers real compose | stakeholder (D-07 approve-all) | 2026-08-24 |
| AR-02 | T-03-04 | Schema-wins-over-prose precedence clause leaves negligible residual ambiguity for v1 | stakeholder (D-07 approve-all) | 2026-08-24 |
| AR-03 | T-05-04 | userEmail flows only to the user's own mailbox by design (NOTF-02) | stakeholder (D-07 approve-all) | 2026-08-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-24 | 21 | 21 | 0 | ox-alpha orchestrator (L1 grep-depth; short-circuit per asvs_level=1 + plan-time register + threats_open=0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-24
