---
phase: 02
slug: auth-service
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-27
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Host -> auth-service (:8081) | Public dev-machine ingress during Phases 2-6; untrusted HTTP enters here | Credentials, tokens |
| auth-service -> postgres | Service-to-datastore inside the Compose network; DB publishes no host port | Credential hashes, PII |
| Client -> auth endpoints | Untrusted credentials/tokens cross into validation/persistence & security filter chain | Login, signup, JWT |
| JWT issuer -> JWT verifier (self + future gateway) | Signed claims are the platform's identity substrate | Signed JWT claims |
| Env secret -> crypto beans | The HS256 secret enters only via environment property binding | JWT signing secret |
| .env -> containers | Secrets enter via env interpolation only; never baked into image layers | Secrets |
| Smoke script -> :8081 | Verification traffic exercises the public boundary exactly as a real client would | Statuses, verdicts |
| Documentation -> operators | README shapes security expectations (residual risks, secret handling) | Env var names, not values |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-SC | Tampering | Maven coordinates in pom.xml | high | mitigate | Parent-BOM-only versions; Package Legitimacy Audit all OK (02-RESEARCH.md) | closed |
| T-02-08 | DoS | Unthrottled auth routes on :8081 | medium | accept | Rate limiting deferred to GTWY-05 (Phase 7) | closed |
| T-02-vol | Tampering | PG18 volume mis-mount silently losing data | medium | mitigate | Named volume at /var/lib/postgresql root; verify asserts users + flyway_schema_history | closed |
| T-02-root | Elevation | Root-running container | medium | mitigate | Runtime stage switches to non-root `spring` user before ENTRYPOINT | closed |
| T-02-dbex | Information Disclosure | Postgres exposed to host network | medium | mitigate | No `ports:` key on postgres; reachable only inside Compose network | closed |
| T-02-mass | Tampering | Mass assignment of id/roles/createdAt | medium | mitigate | Dedicated two-field request records; server sets identity/roles/timestamps | closed |
| T-02-sqli | Tampering | SQL injection through email/password | low | accept | JPA parameterized queries by construction; zero string-concatenated SQL | closed |
| T-02-stuff | Elevation | Credential stuffing against /auth/login | medium | accept | Gateway rate limiting deferred to GTWY-05 (Phase 7) | closed |
| T-02-01 | Tampering/Elevation | JWT algorithm confusion (alg swap, unsigned) | critical | mitigate | Encoder pins HS256; decoder via withSecretKey (MAC-only); wrong-algo rejection test | closed |
| T-02-02 | Information Disclosure | User enumeration via divergent errors/timing | high | mitigate | Byte-identical 401 envelopes + dummy bcrypt compare for unknown accounts | closed |
| T-02-04 | Elevation | Weak/offline-crackable signing secret | high | mitigate | CSPRNG >=32-byte generation; JwtSecretAssertion fail-fast startup check | closed |
| T-02-05 | Information Disclosure | Secret leakage into logs | high | mitigate | Length-only logging in JwtSecretAssertion; no secret/token material emitted | closed |
| T-02-docleak | Information Disclosure | Docs leaking secret material or token values | medium | mitigate | README documents env var NAMES only; smoke script prints verdicts, never tokens | closed |
| T-02-absence | Tampering | Forbidden third write operation added later | high | mitigate | Smoke script absence assertion fails phase gate if contract violated | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

> Note (non-blocking, low severity): T-02-sqli's accepted-risk record is documented here but the README does not yet carry an explicit parameterized-SQL note. The codebase is safe by construction (JPA repositories use parameterized queries, zero concatenated SQL). Add the README note as a non-blocking doc follow-up.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-1 | T-02-08 | Auth-route rate limiting/throttling intentionally deferred to api-gateway GTWY-05 (Phase 7); residual DoS risk documented in service README | gsd-security-auditor | 2026-08-27 |
| AR-02-2 | T-02-stuff | Credential-stuffing throttling deferred to api-gateway GTWY-05 (Phase 7); residual risk documented in service README | gsd-security-auditor | 2026-08-27 |
| AR-02-3 | T-02-sqli | SQL injection not possible by construction (JPA parameterized queries, no string-concatenated SQL); accepted as residual documentation gap, not a code defect | gsd-security-auditor | 2026-08-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-27 | 14 | 14 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-27
