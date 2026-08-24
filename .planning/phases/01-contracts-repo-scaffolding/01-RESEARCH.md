# Phase 1: Contracts & Repo Scaffolding - Research

**Researched:** 2026-08-24
**Domain:** Contract-first API/event specification for a polyglot (Java/Spring + Python/FastAPI + Node/Express) monorepo; git line-ending hygiene on Windows; version pinning manifests; validation scripting
**Confidence:** HIGH for in-repo contract content (all values read from `.planning/research/*` this session); MEDIUM for tooling/format conventions (official-docs-cited)

## Summary

Phase 1 produces **no service code** — its deliverables are authoritative documents and repo hygiene files: four OpenAPI YAMLs (`docs/api-contracts/`), one Kafka topic contract (`docs/kafka-topics.md`), a JSON interop style guide, `.gitattributes`/`.editorconfig`/`.env.example`, a pinned version manifest, the `services/` monorepo skeleton, and a mechanical drift-check script (`scripts/check-contracts.sh`). The research burden is therefore inverted relative to code phases: most load-bearing content already exists verbatim in `.planning/research/ARCHITECTURE.md` (event payloads, dedup keys, JWT claims, port map, monorepo tree) and `PITFALLS.md` (JSON interop rules, CRLF guard). This research's job was to (a) assemble those into a complete endpoint/topic inventory, (b) resolve the *ambiguities between planning documents* that contracts must settle, and (c) verify the tooling choices for mechanical validation.

Three cross-document contradictions were found that the planner MUST force decisions on before specs are written: the order status initial value (`PENDING_PAYMENT` in REQUIREMENTS/ROADMAP vs `PENDING` in ARCHITECTURE — exactly the drift class this phase exists to kill), the cart path singular/plural (`/cart/**` gateway route vs `GET /carts/{userId}` internal edge), and whether logout has an endpoint (AUTH-04 says client-side discard only). Each is cheap to resolve but fatal to leave open, because every later milestone plans from these files.

External research confirmed the standard tooling: Spectral (`@stoplight/spectral-cli`) or Redocly CLI lint hand-authored specs without any service code existing; `git ls-files --eol` mechanically proves LF enforcement; and the `.gitattributes` pattern `* text=auto eol=lf` plus explicit batch-file CRLF exceptions guarantees LF checkout on Windows regardless of each cloner's `core.autocrlf` setting. Because this is a **fresh repo**, the classic renormalization trap (`git add --renormalize`) does not apply — `.gitattributes` simply commits before anything else.

**Primary recommendation:** Write the contracts as hand-authored OpenAPI 3.0.3 YAMLs (one per service, shared `_shared.yaml` components file), freeze the five JSON interop rules and both topic schemas exactly as specified in ARCHITECTURE/PITFALLS research, commit `.gitattributes` in the very first commit, validate everything with `scripts/check-contracts.sh` (Spectral lint + JSON-schema parse + `git ls-files --eol` + manifest completeness grep), and resolve the three named ambiguities explicitly inside the spec files.

## Project Constraints (from AGENTS.md)

Extracted actionable directives (AGENTS.md, project root):

- **Tech stack pinned**: Java/Spring Boot 3.x + Maven (api-gateway, auth-service, order-service); Python/FastAPI + Pydantic v2 (catalog-service, payment-service); Node.js/Express (cart-service); Node worker + kafkajs (notification-service); Next.js frontend; Apache Kafka KRaft mode (no ZooKeeper).
- **Versions**: exact framework versions pinned at planning time per phase — latest stable, researched then locked so plans don't drift across milestones. (Phase 1 owns writing these pins into the repo manifest.)
- **Runtime**: local Docker Compose only; single-broker Kafka.
- **Datastores fixed per service**: PostgreSQL (users, orders), MongoDB (products), Redis (carts) — no swapping.
- **GSD workflow enforcement**: repo edits go through GSD commands (planner/executor handle this; research only notes it).
- **STACK.md embedded in AGENTS.md is authoritative for pins** — Phase 1's manifest copies those values, it does not re-research them.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONTR-01 | OpenAPI specs for every REST endpoint each service will expose, committed under `docs/api-contracts/` before any service code | Complete endpoint inventory derived below (§ Contract Content Inventory) from AUTH-01..04, CAT-01..06, CART-01..04, ORDR-01..08 + internal edges cart→catalog batch, order→cart read; spec-per-service + shared-components pattern verified; ambiguity list §Open Questions Q1–Q5 |
| CONTR-02 | Kafka topic contracts in `docs/kafka-topics.md`: `order.created`, `payment.completed` (single topic carrying `outcome: APPROVED\|DECLINED`), key, JSON schema, producer, consumers, dedup/idempotency fields, email content payload | Full topic contract template (§ Pattern 3) assembled from ARCHITECTURE.md event-flow tables (payloads/dedup keys read verbatim this session) + industry field checklist (partition count immutability, key strategy, cleanup policy, DLQ note); email payload fields enumerated from NOTF-02 |
| CONTR-03 | Cross-language JSON interop conventions: ISO 8601 dates, integer-cents money, string IDs, unknown-fields-ignored | The five-rule set exists verbatim in PITFALLS.md #5 ("decide ONCE, in contracts"); documented below with per-runtime failure modes (Jackson FAIL_ON_UNKNOWN_PROPERTIES, JS 2^53, Pydantic microsecond truncation) |
| CONTR-04 | Monorepo scaffolding: `services/` tree, `.gitattributes` LF enforcement, root README, `.env.example` | Verified `.gitattributes` semantics (git-scm.com cited): `text eol=lf` forces LF checkout on Windows despite `core.autocrlf=true`; bare `text` alone does NOT. Fresh-repo renormalization not needed. Tree layout read from ARCHITECTURE.md §Recommended Project Structure |
| CONTR-05 | Pinned version manifest (Spring Boot/Cloud/JDK, FastAPI/Pydantic, Node LTS, Kafka, Postgres 18, Mongo 8, Redis 8, Next.js) | All pins verified in STACK.md lines 17–54 this session; manifest format options compared (§ Pattern 5); completeness checklist provided for Validation Architecture |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| REST contract authoring (auth/catalog/cart/orders specs) | Repo artifacts (`docs/api-contracts/*.yaml`) | — | Contracts precede all runtimes; no tier owns them yet — that is the point of contracts-first |
| Event contract authoring (`kafka-topics.md`) | Repo artifacts (`docs/kafka-topics.md`) | — | Producer/consumer services arrive in Phases 5–6 and implement against this file |
| Interop rules (dates/money/IDs/nullability/unknown-fields) | Repo artifacts (`docs/api-contracts/_shared.yaml` + style guide section) | Every future runtime | Rules bind Jackson, Pydantic, and JS simultaneously; enforced by drift script later |
| Line-ending hygiene | Repo config (`.gitattributes`) | Developer machines (`core.autocrlf` irrelevant by design) | Attributes travel with the repo; per-machine config must not matter |
| Version pins | Repo artifacts (`docs/versions.md`) | Build files later (pom.xml/package.json/pyproject.toml copy from it) | One authoritative file fresh-context agents read first |
| Mechanical validation | Repo scripts (`scripts/check-contracts.sh`) | Node/npx runtime (already on dev machine) | Scripts run pre-code; no service containers needed |

## Standard Stack

### Core

This phase installs almost nothing — its stack is formats and one linting CLI.

| Tool/Format | Version | Purpose | Why Standard | Confidence |
|---------|---------|---------|--------------|------------|
| OpenAPI | **3.0.3** | REST contract description language | 3.0.x's `nullable: true` has the most uniform generator/linter support; 3.1's `type: [x,"null"]` dialect still trips validators/tooling in 2026 — pick ONE dialect repo-wide and 3.0.x is the safe one [CITED: sourced.sh/blog/openapi-validator — "verify it explicitly supports 3.1… many validators were slow to catch up"]; matches PITFALLS #5 rule 3 guidance [VERIFIED: .planning/research/PITFALLS.md:134] | MEDIUM |
| Spectral CLI | `@stoplight/spectral-cli` **6.16.3** | Lint/validate the OpenAPI YAMLs (`spectral:oas` ruleset + custom rules) | De-facto open-source spec linter; runs via `npx` with zero project context; Docker image exists as alternative; monorepo glob linting built in [CITED: redocly.com/docs/cli + qaskills.sh spectral guide + npm registry view this session] | MEDIUM |
| JSON Schema (embedded in markdown) | draft-07 subset used informally | Message schemas inside `kafka-topics.md` fenced ```json blocks | No Schema Registry in v1 (explicitly out of scope, PROJECT.md) — plain JSON Schema blocks keep schemas parseable/mechanically checkable without new infra [VERIFIED: .planning/PROJECT.md:37 "Schema Registry / Avro… JSON contracts suffice for v1"] | HIGH (in-repo) |
| gitattributes syntax | git ≥2.8 (`--eol` flag) | LF enforcement + mechanical verification | Official semantics verified against git-scm.com/gitattributes docs this session [CITED: git-scm.com/docs/gitattributes] | MEDIUM |

### Supporting

| Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Redocly CLI | `@redocly/cli` **2.47.0** | Alternative linter with stronger opinionated defaults (`operation-4xx-response`, `no-unused-components`, `operation-operationId`) out of the box | If planner prefers zero custom-ruleset authoring over Spectral; either one suffices — do not adopt both |
| oasdiff | latest (npx ad-hoc) | Breaking-change classification when live service specs get diffed against committed ones (Phases 2+) | Named by PITFALLS #4 as the drift-gate differ [VERIFIED: .planning/research/PITFALLS.md:106]; Phase 1 only creates the script skeleton that will call it |
| Node.js | 24.18.0 (on this machine) | Runtime for `node -e` JSON-schema checks inside check-contracts.sh | Already installed; jq is MISSING on this machine so JSON checks must use node, not jq |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-authored YAML per service | AsyncAPI document for events | AsyncAPI is the formal standard for event contracts, but adds a second spec ecosystem + toolchain for exactly two topics; markdown + embedded JSON Schema keeps the barrier at zero and stays greppable. Revisit only if topic count grows materially. |
| OpenAPI 3.1 | (recommended against) | Future-proof dialect aligned with JSON Schema 2020-12, but mixed linter/generator support in 2026 makes it the riskier choice for a spec consumed by springdoc-era Java tooling and openapi-generator |
| Spectral | Redocly CLI `recommended` ruleset | Redocly ships opinionated defaults without a custom ruleset; Spectral is more portable/customizable. Either satisfies the gate; Spectral chosen for default-portability via npx + docker image |
| Single mega-spec for all services | Spec per service (+ `_shared.yaml`) | Mega-spec couples independently-shipped milestones — precisely the drift Phase 1 prevents [VERIFIED: .planning/research/ARCHITECTURE.md:356 — no cross-service parent artifacts; contracts are the only shared artifact] |
| `versions.json` (machine-readable manifest) | `docs/versions.md` (markdown table) | JSON parses trivially but resists human review diffs and inline rationale; markdown table wins for a learning repo where humans audit pins. A JSON twin can be added later without changing the canonical file |

**Installation (only if planner opts for pinned devDependency instead of npx-ad-hoc):**
```bash
# root-level tooling manifest (no service code involved)
npm install --save-dev @stoplight/spectral-cli@6.16.3   # or: rely on npx -y @stoplight/spectral-cli@6.16.3 in scripts
```

## Package Legitimacy Audit

> Ran `gsd_run query package-legitimacy check --ecosystem npm "@stoplight/spectral-cli" "@redocly/cli"` + `npm view` verification this session.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @stoplight/spectral-cli | npm | established project; latest release 2026-08-03 | ~1.66M/wk | github.com/stoplightio/spectral | SUS ("too-new" — freshness flag on the latest publish only) | Flagged — planner inserts `checkpoint:human-verify` before installing. Signals contradict risk: massive adoption, official repo, not deprecated, **no postinstall script** (`npm view` returned empty) |
| @redocly/cli | npm | established project; latest release 2026-08-21 | ~2.24M/wk | github.com/Redocly/redocly-cli | SUS ("too-new" — same release-freshness false positive) | Flagged — same checkpoint treatment. No postinstall script; not deprecated |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@stoplight/spectral-cli`, `@redocly/cli` — both flags are release-freshness artifacts (weekly-download counts and repo URLs indicate long-established projects), but protocol requires the planner gate the install behind `checkpoint:human-verify`.

*Escape hatch:* if the checkpoint rejects npm installs entirely, the fallback is running Spectral's official Docker image (`stoplight/spectral`) or deferring lint automation to Phase 2 while keeping the script skeleton — the contracts themselves do not depend on the linter being installed.

## Architecture Patterns

### System Architecture Diagram

Phase 1 has no runtime dataflow; the "system" is the artifact dependency graph — what must exist before what, and what consumes each artifact downstream:

```
 docs/versions.md ───────────────► every later phase plan (reads pins, never re-researches)
 .gitattributes ─────────────────► every future commit (LF normalization at checkin/checkout)
 .editorconfig ──────────────────► every editor session (indentation/charset consistency)
 .env.example ───────────────────► Phases 2–9 (copy → .env; variable NAMES are contractual)
        │
 docs/api-contracts/_shared.yaml ◄┐
        │ $ref                    │ five interop rules encoded as schema constraints
        ▼                        │
 auth.yaml  catalog.yaml  cart.yaml  orders.yaml
        │                        │
        │                        └──► scripts/check-contracts.sh ──► exit non-zero on drift/violation
        ▼                                ▲
 docs/kafka-topics.md ──────────────────┘
        │
        ├──► Phase 2/7 (JWT claims: sub/email/roles/iss/aud; HS256; secret handling)
        ├──► Phase 3 (catalog shapes incl. POST /products/batch for cart)
        ├──► Phase 4 (cart shapes incl. internal GET read used by order)
        ├──► Phase 5 (topic payloads, dedup keys, state-machine enum, Idempotency-Key)
        ├──► Phase 6 (email content payload fields)
        └──► Phase 7 (route prefixes + public/protected matrix + port map)
```

### Recommended Project Structure

Verified from ARCHITECTURE.md (read this session) — Phase 1 creates the skeleton with empty/placeholder service dirs, not full trees:

```
<repo-root>/
├── .gitattributes              # FIRST COMMIT — LF law (see Pattern 4)
├── .editorconfig               # UTF-8, LF, indentation per language
├── .gitignore                  # .env, node_modules, target/, __pycache__, .venv …
├── .env.example                # every var name Phases 2–9 will need, placeholder values
├── README.md                   # project overview + pointer to docs/
├── docker-compose.yml          # placeholder header comment only (grows in Phase 2+)
├── docs/
│   ├── api-contracts/
│   │   ├── _shared.yaml        # common components: Error envelope, Money-ish primitives,
│   │   │                       #   securitySchemes (bearerAuth), pagination params
│   │   ├── auth-service.openapi.yaml
│   │   ├── catalog-service.openapi.yaml
│   │   ├── cart-service.openapi.yaml
│   │   └── orders-service.openapi.yaml
│   ├── json-interop.md         # the five rules (CONTR-03) — or a section in _shared.yaml;
│   │                           #   separate file is greppable and linkable
│   ├── kafka-topics.md         # CONTR-02 (see Pattern 3 template)
│   └── versions.md             # CONTR-05 manifest (see Pattern 5)
├── scripts/
│   └── check-contracts.sh      # drift/validation gate skeleton (see Validation Architecture)
└── services/                   # empty dir per service now; real trees land per phase
    ├── api-gateway/  auth-service/  order-service/
    ├── catalog-service/  payment-service/
    └── cart-service/  notification-service/
```

Naming convention for specs: `<service-name>.openapi.yaml` — unambiguous, sortable, and the glob `docs/api-contracts/*.openapi.yaml` feeds the linter cleanly. (ARCHITECTURE.md sketched shorter names `auth.yaml catalog.yaml…` [VERIFIED: .planning/research/ARCHITECTURE.md:350]; either is fine — pick one and stay consistent. The longer form is self-documenting for fresh-context agents.)

### Pattern 1: Contract-first with committed-spec authority (the drift guard)

**What:** The committed YAML is THE source of truth. Each runtime may generate its own spec locally (FastAPI emits `/openapi.json`, springdoc emits `/v3/api-docs`) but generated output is never committed and must diff clean against the committed file at every phase Verify.
**When to use:** Always in this repo — three languages, zero shared types.
**Authority rule (write it into the specs themselves, top comment):**

```yaml
# Source of truth: THIS FILE. Do not commit generated specs.
# Local generation (FastAPI /openapi.json, springdoc /v3/api-docs) is for
# development convenience only; scripts/check-contracts.sh diffs live output
# against this file at every phase Verify. Changes to the API start here.
openapi: "3.0.3"
info:
  title: Auth Service API
  version: "1.0.0"          # contract version, bumped on any shape change
```

**Why 3.0.3 and nullable discipline:** optional = absent key; explicit `null` forbidden except where the spec marks `nullable: true` [VERIFIED: .planning/research/PITFALLS.md:134]. Encode it once in `_shared.yaml` and reference everywhere.

### Pattern 2: One spec per service + shared components file

**What:** Four independent YAMLs; cross-cutting schemas (error envelope, security scheme, pagination params, money representation) live in `_shared.yaml` and are pulled via `$ref: './_shared.yaml#/components/...'`.
**When:** Polyglot teams where services ship in independent milestones.
**Gotchas (verified via Spectral docs):** Spectral fully dereferences `$ref`s — a broken relative ref aborts the lint, which is desirable (broken refs fail loudly) but means the shared file must be committed alongside. Relative refs work fine with globs.

```yaml
# orders-service.openapi.yaml (excerpt)
paths:
  /orders:
    post:
      operationId: createOrder
      security:
        - bearerAuth: []          # every protected operation declares it explicitly
      parameters:
        - $ref: './_shared.yaml#/components/parameters/IdempotencyKey'
      requestBody: { ... }
      responses:
        '201': { description: Order created (status PENDING_PAYMENT) }
        '200': { description: Idempotent replay — returns original order }
        '401': { $ref: './_shared.yaml#/components/responses/Unauthorized' }
        '409': { $ref: './_shared.yaml#/components/responses/Error' }
components:
  schemas:
    OrderStatus:
      type: string
      enum: [PENDING_PAYMENT, PAID, PAYMENT_FAILED]   # ← Q1 decision required (see Open Questions)
```

### Pattern 3: Kafka topic contract template (`docs/kafka-topics.md`)

Industry field checklist for a topic contract (corroborated: partition-count immutability and key-strategy documentation are standard practice [CITED: factorhouse.io partition best-practices + oneuptime.com partition strategies]); payload values below are this project's frozen decisions from ARCHITECTURE.md (read verbatim this session):

```markdown
## Topic: order.created

| Field            | Value                                                      |
|------------------|------------------------------------------------------------|
| Partitions       | 3 (declared up-front; enables consumer scaling; auto-create OFF) |
| Replication factor | 1 (single-broker dev override)                            |
| Key              | `orderId` (string) — per-order ordering within a partition  |
| Cleanup policy   | delete; retention ≥ 7 days (replay/debug window)           |
| Producer         | order-service                                              |
| Consumers        | groups: `payment-service`, `notification-service`          |
| Delivery         | at-least-once; consumers MUST be idempotent                 |
| DLQ              | none in v1 — poison messages log-and-skip (mock domain tolerates) |

### Payload JSON schema
{ "eventId": "<uuid>", "orderId": "<string>", "userId": "<string>",
  "userEmail": "<string>", "items": [{"productId","nameSnapshot","unitPriceCents","quantity"}],
  "totalCents": <int minor units>, "currency": "<ISO 4217>", "createdAt": "<ISO-8601 ms UTC>" }

### Dedup contract (per consumer)
- payment-service: skip if `orderId` already authorized
- notification-service: dedupe on `eventId`
```

Required per-topic fields (checklist): name · partitions · replication factor · key strategy · cleanup policy/retention · producer · consumers (by group) · payload JSON schema (required fields + enums) · delivery semantics · per-consumer dedup key · DLQ stance. For `payment.completed` add the frozen enum: `"outcome": "APPROVED" | "DECLINED"` with `reason` (string, present iff DECLINED) [VERIFIED: .planning/research/ARCHITECTURE.md:167 quote: "`eventId`(uuid), `orderId`, `outcome`: `"APPROVED"\|"DECLINED"`, `reason?`(string, present when DECLINED), `processedAt`"] and the **email content payload** section (Q6): exact subject/body field lists for APPROVED and DECLINED variants so Phase 6 renders and the smoke test asserts identical content.

### Pattern 4: `.gitattributes` that actually forces LF on Windows

**Semantics verified this session against git-scm.com + GitHub docs:** a path carrying `text eol=lf` is normalized to LF on checkin AND checked out as LF even when the user's `core.autocrlf=true` [CITED: git-scm.com/docs/gitattributes — "Set to string value 'lf'… prevents conversion to CRLF when the file is checked out"; docs.github.com — "text eol=lf: Git will always convert line endings to LF on checkout… even on Windows"]. A bare `text` attribute WITHOUT `eol` yields CRLF worktrees for autocrlf=true users — pairing `text` with explicit `eol=lf` is mandatory, not stylistic.

Recommended content (extends PITFALLS #11's block with the catch-all + binary exceptions):

```gitattributes
# Normalize everything to LF in repo AND working tree, all platforms.
* text=auto eol=lf

# Windows-only scripts that cmd.exe may misparse with LF (labels/goto).
*.bat text eol=crlf
*.cmd text eol=crlf

# Binary assets (seed product images land in Phase 3) — never transform.
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
```

Notes:
- The catch-all covers `mvnw`, `*.sh`, `Dockerfile`, `.env.example` — the PITFALLS #11 explicit entries become redundant but harmless; keeping a few explicit lines (`mvnw text eol=lf`) is self-documenting [VERIFIED: .planning/research/PITFALLS.md:280-287].
- `mvnw.cmd` is a batch script → covered by `*.cmd eol=crlf`. cmd.exe label/goto parsing misbehaving under LF is widely reported though not formally specified [ASSUMED — low-risk either way since Maven falls back gracefully, but crlf is the conservative choice].
- **Fresh-repo privilege:** because `.gitattributes` lands in/near the first commit, `git add --renormalize .` is unnecessary. Only needed if any file gets committed before attributes exist — if that happens, run renormalize once before the phase closes [CITED: aleksandrhovhannisyan.com + GitHub docs renormalization guidance].
- Users CAN still override per-clone via `.git/info/attributes` — document "don't" in README rather than fighting it.
- This machine's global `core.autocrlf` is currently UNSET (probed this session); the design goal is that no contributor's setting matters.

### Pattern 5: Version manifest — one file, `docs/versions.md`

Single markdown table, copied from STACK.md pins (all verified in STACK.md lines 17–54 this session). Format per row: Component | Exact pin | Kind (framework/runtime/image/BOM) | Consumed by | Source of truth note. Include a "verified 2026-08-24 against registry/dist-tag" footer line. Fresh-context agents read this file FIRST; build files (pom.xml, package.json, pyproject.toml, compose image tags) treat it as the source they copy. Do not scatter pins across per-service VERSION files — that recreates the drift the manifest kills.

Components the manifest MUST cover (completeness checklist for validation): Spring Boot 3.5.16 · Spring Cloud 2025.0.3 · JDK 21 · FastAPI 0.141.1 · Pydantic 2.13.4 · Python 3.13 · Node 24 LTS (24.x) · Express 5.2.1 · ioredis 6.0.0 · kafkajs 2.2.4 · nodemailer 9.0.5 · aiokafka 0.14.0 · pymongo ≥4.9 · apache/kafka 4.2.1 · postgres 18 · mongo 8.0 · redis 8-alpine line · Next.js 16.3.2 · Mailpit (latest, tagged) · eclipse-temurin 21-jre base image.

### Anti-Patterns to Avoid

- **Committing generated specs alongside hand-authored ones** — two files claiming authority guarantees divergence; generated output stays untracked (add `/openapi.json` patterns to `.gitignore` if needed).
- **Leaving ambiguities to be resolved during implementation** — with fresh-context milestones weeks apart there is no one to ask; every "TBD" in a contract becomes a coin-flip in three languages simultaneously.
- **`* text eol=lf` without understanding, or bare `* text=auto`** — bare forms respect `core.autocrlf=true` and produce CRLF worktrees on Windows, defeating CONTR-04's success criterion.
- **Money as float anywhere in examples** — every example payload in specs and kafka-topics.md must show integer cents, or the examples themselves teach the wrong rule.
- **Per-service VERSION files** — N places to update on bump = drift by design.
- **Skipping `.editorconfig` because `.gitattributes` handles endings** — they solve different problems (charset/indentation vs EOL); both cost ten lines.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spec structural validation | Ad-hoc YAML parser checks in bash | Spectral `spectral:oas` ruleset (or Redocly `recommended`) | Catches missing operationIds, undocumented 4xx responses, invalid `$ref`s, media-type example errors — dozens of battle-tested rules |
| Line-ending verification | Reading bytes with `od`/`xxd` loops over every file | `git ls-files --eol` | Purpose-built index/worktree/attr report (git ≥2.8); one grep proves repo-wide compliance |
| JSON-schema sanity checks | Python/Node schema-validator dependency tree | `node -e` with `JSON.parse` + required-key assertions | jq is MISSING on this machine; full JSON-Schema validation is overkill for two flat message schemas — spot-check required fields + enums |
| Breaking-change detection | Manual diff reading | oasdiff (called by check-contracts.sh from Phase 2 onward) | Classifies breaking vs additive changes; hand-written diff rules always miss cases |
| Error response design | Per-endpoint bespoke error shapes | One `_shared.yaml` Error envelope referenced everywhere | Client DX fragmentation is the documented failure mode [CITED: javacodegeeks spec-driven article — standardized envelope with machine-readable `code` beats per-endpoint schemas] |

**Key insight:** Phase 1's entire value is *mechanical* enforceability. A contract nobody can diff is a wish, not a guard. Everything above exists so that "does reality match the contract?" is a command, not a conversation.

## Contract Content Inventory (endpoint derivation — CONTR-01 input)

Complete endpoint list derived from REQUIREMENTS.md requirement IDs + ARCHITECTURE.md edge list. **Auth column shows the gateway-level classification; specs encode it per-operation via `security:`.**

### auth-service (gateway prefix `/auth/**`)
| Method + Path | Auth | Requirement | Notes / decisions to freeze |
|---|---|---|---|
| POST /auth/signup | public | AUTH-01 | 201 + user body; 409 duplicate email; password min length in schema |
| POST /auth/login | public | AUTH-02 | 200 `{accessToken, user}`; 401 invalid credentials |
| GET /auth/me | JWT | AUTH-03 | 200 profile matching login's `user` shape exactly (same-claims consistency — PITFALLS "Looks Done" checklist item); 401 otherwise |
| *(no logout endpoint)* | — | AUTH-04 | Client-side token discard BY DESIGN — contract records the absence explicitly (Q3) |

### catalog-service (gateway prefix `/catalog/**`; public = GET only per GTWY-03)
| Method + Path | Auth | Requirement | Notes |
|---|---|---|---|
| GET /catalog/products | public | CAT-01/03/04 | Query params: `category`, `q` (text search), `sort` (`price`\|`name`), `order`, `limit`/`offset` (D6 — bake pagination in NOW, contractual not bolted-on) [VERIFIED: .planning/research/FEATURES.md:65] |
| GET /catalog/products/{id} | public | CAT-02 | G1 closure — PDP endpoint; 404 shape defined |
| POST /catalog/products/batch | internal (service-to-service) | supports CART-01/CART-02 | Explicitly named by ARCHITECTURE edge #4: "add to spec in contracts phase" [VERIFIED: .planning/research/ARCHITECTURE.md:85]; batch-validate productId set, return current priceCents/name |
| POST /catalog/products | JWT | CAT-06 | Create (Swagger-driven admin) |
| PUT /catalog/products/{id} | JWT | CAT-06 | Full update |
| DELETE /catalog/products/{id} | JWT | CAT-06 | Delete |
| GET /health | public (network-internal) | healthcheck | Not routed by gateway; documented for compose |

### cart-service (gateway prefix `/cart/**` — ALL protected per GTWY-02)
| Method + Path | Auth | Requirement | Notes |
|---|---|---|---|
| GET /cart | JWT (identity from `sub` claim) | CART-03 | Current cart + server-computed line/grand totals (CART-02); totals come from LIVE catalog prices |
| POST /cart/items | JWT | CART-01 | Body `{productId, quantity}`; validates against catalog; 404 unknown product, 400 invalid qty |
| PATCH /cart/items/{productId} | JWT | CART-02 | Update quantity; 0 = remove or dedicated DELETE — pick one (Q4) |
| DELETE /cart/items/{productId} | JWT | CART-02 | Remove line |
| DELETE /cart | internal (called by order post-checkout) | ORDR-06 | Cart clearing; also usable by user as "empty cart" |
| GET /carts/{userId} | internal (order→cart) | supports ORDR-01 | Edge #5 read for checkout snapshot — path spelling conflict with gateway prefix is Q2 |
| GET /health | public (internal) | healthcheck | TTL semantics: touch-TTL-on-every-mutation documented in spec description [VERIFIED: .planning/research/PITFALLS.md:365 integration gotcha] |

### order-service (gateway prefix `/orders/**` — ALL protected)
| Method + Path | Auth | Requirement | Notes |
|---|---|---|---|
| POST /orders | JWT | ORDR-01/05 | `Idempotency-Key` header REQUIRED (ORDR-05); snapshots items+prices from cart; 201 `{orderId, status}` immediately; idempotent replay returns original (Q5: replay status 200 vs 201?) |
| GET /orders | JWT | ORDR-07 | History list for owning user (filter by `sub` claim) |
| GET /orders/{id} | JWT | ORDR-07 | Detail incl. `status` — THE polling endpoint for FRNT-05; G4 closure |
| GET /health | public (internal) | healthcheck | — |

**Cross-cutting contract decisions to freeze (each becomes a spec construct):** unified error envelope `{code, message}` with machine-readable `code` enums; pagination param names; `bearerAuth` security scheme (HTTP Bearer, HS256 JWT); JWT claims documented alongside auth spec: `sub`(userId string)/`email`/`roles` array/`iss=ecommerce-auth`/`aud=ecommerce-api`/`iat`,`exp` epoch seconds, TTL ≈3600s ±60s skew [VERIFIED: .planning/research/ARCHITECTURE.md:243-249 — claim table read verbatim]; route/port map (gateway 8080 → auth 8081, catalog 8000, cart 3001, order 8082; payment 8001 internal; published externally: only 3000/8080 + operator UIs) [VERIFIED: .planning/research/ARCHITECTURE.md:31-54].

## Common Pitfalls

### Pitfall 1: Resolving contract ambiguities during implementation instead of in Phase 1
**What goes wrong:** Three fresh-context milestones each interpret "the pending status" differently; integration fails at Phase 5 with two spellings of one enum.
**Why:** Planning docs disagree (they do here — see Open Questions Q1/Q2); nobody is forced to reconcile until two runtimes meet.
**How to avoid:** The planner MUST extract an explicit decision for every Open Question below before specs are authored; the decision is recorded IN the spec (enum values, path spellings), not in chat history.
**Warning signs:** Any spec field whose description contains "probably", "or", "TBD".

### Pitfall 2: `.gitattributes` added late (after first Java commit)
**What goes wrong:** CRLF-poisoned `mvnw` breaks Maven build stage inside Docker; `.env` values carry trailing `\r`; recovery requires renormalize + re-checkout dance.
**Why:** Git for Windows historically defaults autocrlf=true; files committed before attributes exist keep their poisoned blobs until renormalized.
**How to avoid:** `.gitattributes` is literally the first commit (or same commit as scaffolding, before ANY service file). Fresh clone then `git ls-files --eol` shows `i/lf w/lf` everywhere governed [CITED: gist LunarLambda line-ending guide + SO #15641259 workflow].
**Warning signs:** `warning: CRLF will be replaced by LF` on add; container `exec user process caused "no such file or directory"` for existing scripts.

### Pitfall 3: Specs that describe happy paths only
**What goes wrong:** Implementers invent their own error codes/status codes; clients (frontend phase) meet inconsistent 4xx semantics.
**Why:** Authoring errors feels like boilerplate; skipping it is invisible until Phase 8.
**How to avoid:** Every operation declares its 4xx responses referencing the shared Error envelope; linter rules (`operation-4xx-response` in Redocly; equivalent custom Spectral rule) enforce it mechanically.
**Warning signs:** Spectral warnings ignored "temporarily"; `--fail-severity` left at default error-only while warnings accumulate.

### Pitfall 4: Interop rules documented but not encoded in schemas
**What goes wrong:** Style guide says "string IDs" but a spec example shows numeric id; a generator bakes the wrong type into a client.
**Why:** Prose and schema live in different files; drift is invisible.
**How to avoid:** Encode each rule as a schema constraint: IDs `type: string` (even though DB columns are bigint/serial); money `type: integer` named `*Cents`; timestamps `type: string, format: date-time` + prose pinning millisecond UTC; `additionalProperties: true` default (ignore-unknown) stated once globally with per-schema exceptions where needed.
**Warning signs:** Example payloads contradicting schema types; `format: int64` appearing on any wire-facing ID.

### Pitfall 5: Manifest drift from STACK.md at birth
**What goes wrong:** Manifest omits a component (Mailpit, base images, aiokafka); Phase 5/6 agent improvises a version.
**Why:** Manifest written by hand from memory instead of copied from the verified table.
**How to avoid:** Copy rows from STACK.md lines 17–54 mechanically; run the completeness checklist (Pattern 5 list) as part of check-contracts.sh.
**Warning signs:** Manifest row count < 20; missing "verified <date>" footer.

## Code Examples

### Shared error envelope (`_shared.yaml` excerpt)
```yaml
# Source: pattern corroborated across contract-first references (javacodegeeks.com
# spec-driven article; appmaster.io contract-first guide) — envelope with
# machine-readable code + human message, referenced by every 4xx/5xx response.
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT     # HS256; claims contract lives in docs/json-interop.md + kafka-topics.md
  schemas:
    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          description: Machine-readable stable identifier, e.g. VALIDATION_FAILED, DUPLICATE_EMAIL
        message:
          type: string
          description: Human-readable; MUST NOT leak internals (no hostnames/stack traces)
      additionalProperties: true   # ignore-unknown rule applies to consumers
```

### check-contracts.sh skeleton (the phase's own deliverable)
```bash
#!/usr/bin/env bash
# Drift gate skeleton — Phase 1 validates artifacts; Phases 2+ additionally
# diff live service specs against these committed files (oasdiff).
set -euo pipefail
FAIL=0

# 1. Lint every OpenAPI spec (Spectral via npx; no local install required)
npx -y @stoplight/spectral-cli@6.16.3 lint docs/api-contracts/*.openapi.yaml \
  --ruleset docs/api-contracts/.spectral.yaml --fail-severity=warn || FAIL=1

# 2. Parse every fenced JSON block in kafka-topics.md and assert required keys
node scripts/validate-topic-schemas.mjs docs/kafka-topics.md || FAIL=1

# 3. Line-ending law: no governed tracked file may carry CRLF in the index
if git ls-files --eol | grep -E 'i/crlf' | grep -vE '\.(bat|cmd)$'; then
  echo "FAIL: CRLF found in index on governed paths"; FAIL=1
fi

# 4. Version-manifest completeness (component count / required names present)
grep -q 'Spring Boot.*3\.5\.16' docs/versions.md || { echo "FAIL: Boot pin missing"; FAIL=1; }
# … one grep per required component (list in Validation Architecture) …

exit $FAIL
```

### Mechanical LF verification (the CONTR-04 proof)
```bash
# After a FRESH CLONE on Windows (any core.autocrlf setting):
git ls-files --eol
# Expected for every governed text file:  i/lf    w/lf    attr/text=auto eol=lf  <path>
# Failure looks like:                     i/lf    w/crlf  attr/text=auto eol=lf  <path>   (stale checkout — re-checkout)
#                                    or:  i/crlf ...                                       (poisoned blob — renormalize needed)
```

### Topic schema validation snippet (`validate-topic-schemas.mjs` core)
```javascript
// Extract ```json fenced blocks; assert parseability + required fields per topic.
const REQUIRED = {
  "order.created": ["eventId","orderId","userId","userEmail","items",
                    "totalCents","currency","createdAt"],
  "payment.completed": ["eventId","orderId","outcome","processedAt"],
};
// outcome must be APPROVED|DECLINED; totalCents must be integer; dates ISO strings…
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Motor for Mongo async | PyMongo `AsyncMongoClient` (affects contract field naming only indirectly — none here) | deprecated 2025-05-14, EOL 2026-05-14 | No contract impact; recorded because STATE.md requires stakeholder sign-off before contracts freeze |
| MailHog | Mailpit | MailHog unmaintained since ~2020 | CONTRACT IMPACT: Mailpit's REST API (`/api/v1/messages`) is the assertion surface for email-content contracts — name it in kafka-topics.md's email section |
| Speccy (spec linter) | Spectral / Redocly CLI | Speccy archived 2021 | Never choose Speccy from old tutorials |
| OpenAPI 3.1 everywhere push | Pragmatic 3.0.x for max tooling compat | ongoing through 2026 | This repo: 3.0.3 |
| kafka-clients 4.x with Boot 3.5 | Boot-managed spring-kafka 3.3.x ⇔ broker 4.2 | compatibility matrix | No contract impact; manifest records the pin pair |

**Deprecated/outdated (do not let into the repo):** MailHog references in any contract/doc (use Mailpit); Motor references; `spring-cloud-starter-gateway` old artifact name (manifest should note the renamed `…gateway-server-webflux` starter for Phase 7's benefit).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `mvnw.cmd`/`*.bat` batch scripts should be `eol=crlf` (cmd.exe label/goto fragility under LF) | Pattern 4 | Low — worst case mvnw.cmd misbehaves on exotic constructs; fix is flipping one attribute line |
| A2 | FastAPI serves generated spec at `/openapi.json`, springdoc at `/v3/api-docs` (defaults) | check-contracts.sh comments | Low — paths are configurable; drift script finalizes in Phase 2+ when services exist and real paths are observable |
| A3 | Spectral custom ruleset beyond built-in `spectral:oas` needed only for minor conventions (operationId casing) | Validation Architecture | Low — built-in ruleset alone already enforces the critical invariants |
| A4 | Kafka retention "≥ 7 days" is a reasonable dev default for the topic contract table | Pattern 3 | Cosmetic — any explicit value satisfies the contract; tune at Phase 5 |
| A5 | Redocly/Spectral SUS flags are release-freshness false positives (adoption signals overwhelming) | Package Audit | Planner checkpoint resolves; escape hatch = Docker image or defer install |

## Open Questions

1. **Order status enum: `PENDING` vs `PENDING_PAYMENT`** — REQUIREMENTS.md ORDR-04 and ROADMAP Phase 5 say `PENDING_PAYMENT → PAID \| PAYMENT_FAILED` [VERIFIED: .planning/REQUIREMENTS.md:46], while ARCHITECTURE.md's state machine and saga say `PENDING` [VERIFIED: .planning/research/ARCHITECTURE.md:176-179]. What we know: both mean the same state. What's unclear: canonical spelling. Recommendation: adopt **`PENDING_PAYMENT`** (self-descriptive, matches requirement text); record in orders spec enum + kafka-topics.md. **Planner must lock this before specs are written.**
2. **Cart path spelling: `/cart` vs `/carts/{userId}`** — Gateway route is `/cart/**` [VERIFIED: .planning/REQUIREMENTS.md:59], ARCHITECTURE edge #5 reads `GET /carts/{userId}` [VERIFIED: .planning/research/ARCHITECTURE.md:86]. Recommendation: user-facing operations live at `/cart/...` (identity from JWT `sub`); the internal order→cart read is spelled `GET /cart/{userId}` in cart-service's spec (singular, consistent), noting it is network-internal and bypasses the gateway prefix question entirely. Lock one spelling in the spec.
3. **Logout endpoint existence** — AUTH-04 defines logout as client-side token discard with NO server revocation [VERIFIED: .planning/REQUIREMENTS.md:23]; ROADMAP Phase 2 confirms "documented client-side token discard". Recommendation: **no endpoint**; auth spec carries an explicit informational note "logout is client-side by design (v1)" so no phase "helpfully" adds one.
4. **Quantity-zero semantics** — does `PATCH` quantity 0 delete the line, or is DELETE the only removal? Recommendation: quantity must be ≥1 in PATCH (400 otherwise); DELETE removes lines. Keeps invariants obvious.
5. **Idempotent-replay status code** — ORDR-05 replayed `Idempotency-Key` "returns the original order": 200 (read-semantics) vs 201 (create-semantics)? Recommendation: **200** on replay, 201 on first creation — distinguishable and honest; document in spec.
6. **Email content payload fields** — Success criterion demands the email payload be contracted. Recommendation: define in kafka-topics.md a rendering-input table: subject template, from address, body fields per variant — APPROVED: order number/orderId, item summary (name×qty lines), total, status word "PAID"; DECLINED: order number, reason, status "PAYMENT_FAILED", next-step sentence. Phase 6 renders exactly this; smoke test asserts via Mailpit REST.
7. **Pre-phase stakeholder sign-offs (carried from STATE.md)** — MailHog→Mailpit and Motor→PyMongo deviations plus Boot 3.5 OSS-EOL posture need sign-off BEFORE contracts freeze [VERIFIED: .planning/STATE.md:67-68]. These don't change REST shapes, but the contracts/docs reference Mailpit by name; planner should surface the confirmations (config sets `human_verify_mode: end-of-phase` — fold into phase flow rather than blocking).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git (with `ls-files --eol`, ≥2.8) | CONTR-04 + validation | ✓ | 2.48.1.windows.1 | — |
| Node.js + npx | Spectral lint, JSON checks | ✓ | 24.18.0 / npm 11.16.0 | Docker image `stoplight/spectral` |
| Docker | NOT required this phase (no containers) | ✓ (present anyway) | 29.4.0 | — |
| Python | not required (specs are YAML/MD) | ✓ | 3.14.2 | — |
| jq | preferred by some JSON recipes | ✗ MISSING | — | `node -e` one-liners (chosen approach) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** jq — validation scripts use node instead (portable, already required for npx).

Note: this directory is not yet a git repository ("Is directory a git repo: no") — Phase 1 execution begins with `git init` + `.gitattributes` as the inaugural commit, which is exactly what makes the fresh-repo renormalization exemption valid.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bash script gate + Spectral CLI 6.16.3 (via npx) + Node 24 one-liner validators — no unit-test framework needed (phase ships documents, not code) |
| Config file | `docs/api-contracts/.spectral.yaml` (ruleset, `extends: ['spectral:oas']` + minimal overrides); `scripts/check-contracts.sh` orchestrates |
| Quick run command | `bash scripts/check-contracts.sh` |
| Full suite command | Same script (single gate); plus manual fresh-clone LF spot-check below |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONTR-01 | All four specs lint clean; every inventory endpoint present | lint + coverage checklist | `npx -y @stoplight/spectral-cli@6.16.3 lint "docs/api-contracts/*.openapi.yaml" --fail-severity=warn` ; op-count grep per service | ❌ Wave 0 (script is a deliverable) |
| CONTR-02 | kafka-topics.md schemas parse; required fields/enums present; both topics + email payload sections exist | scripted inspection | `node scripts/validate-topic-schemas.mjs docs/kafka-topics.md` (parses fenced JSON, asserts REQUIRED maps + `outcome` enum + APPROVED/DECLINED email sections) | ❌ Wave 0 |
| CONTR-03 | Five rules present and schema-encoded (string IDs / integer cents / ISO-ms dates / absent-not-null / ignore-unknown) | inspection + grep | `grep -c 'priceCents\|format: date-time' docs/api-contracts/*.openapi.yaml` non-zero per rule family; checklist in script | ❌ Wave 0 |
| CONTR-04 | No CRLF in index on governed paths; fresh clone yields `w/lf` | mechanical | `git ls-files --eol \| grep 'i/crlf' \| grep -vE '\\.(bat\|cmd)$'` must output NOTHING (exit-checked in script) | ❌ Wave 0 |
| CONTR-05 | Manifest lists all ~20 required components with exact pins + verified-date footer | completeness grep | one `grep -q '<Component>.*<pin>' docs/versions.md \|\| FAIL=1` per component (list = Pattern 5 checklist) | ❌ Wave 0 |

Manual-only supplement (justified: requires a second machine-state simulation): fresh-clone LF proof — `git clone <repo> /tmp/fresh && cd /tmp/fresh && git ls-files --eol | grep -c 'w/crlf'` expecting 0 outside `*.bat/cmd` — runnable on this machine post-commit by cloning to a temp dir; automatable later, acceptable manual in Phase 1 verify.

### Sampling Rate

- **Per task commit:** `bash scripts/check-contracts.sh` (< 30 s: npx cached after first run)
- **Per wave merge:** same (single-wave phase likely)
- **Phase gate:** full script green + manual fresh-clone LF check before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `scripts/check-contracts.sh` — the gate itself is a Phase 1 deliverable (created in-plan, not pre-existing)
- [ ] `scripts/validate-topic-schemas.mjs` — topic-schema validator (~60 lines Node, stdlib only)
- [ ] `docs/api-contracts/.spectral.yaml` — ruleset file (`extends: ['spectral:oas']`)
- [ ] Framework install: none needed — npx fetches Spectral on first run (network available; pin `@6.16.3` for determinism)

*(No pre-existing test infrastructure exists — greenfield repo.)*

## Security Domain

> Included: `security_enforcement: true`, ASVS level 1 (config.json). Phase 1's security surface is *contractual*: it freezes the rules later phases enforce.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (contract-level) | Auth spec states bcrypt hashing requirement (never plaintext/reversible); duplicate-email rejection contract [ASVS L1] |
| V3 Session Management | yes | JWT claims contract: TTL ≈3600 s, `iss`/`aud` asserted values, ±60 s skew documented; cookie attributes (httpOnly/SameSite=Lax/Path) recorded for Phases 2/7/8 [VERIFIED: .planning/research/ARCHITECTURE.md:243-249] |
| V4 Access Control | yes | Per-operation `security:` in every spec encodes the public/protected matrix (public: signup/login + **GET-only** `/catalog/**`; protected: everything else incl. catalog mutations) — the gateway implements exactly this table in Phase 7 |
| V5 Input Validation | yes | Schema constraints on every request body: `email` format, password minLength, quantity minimum 1, priceCents integer ≥ 0; unknown-fields-ignored stated as reader-side policy, never writer-side sloppiness |
| V6 Cryptography | yes | HS256 pinned by name in contracts (never algorithm-negotiated); secret requirements documented: CSPRNG ≥ 32 bytes, held by exactly auth+gateway, startup length assertion [VERIFIED: .planning/research/PITFALLS.md:204] |
| V7 Error Handling | yes | Shared Error envelope forbids internals leakage (no hostnames, stack traces, driver errors in `message`) |
| V14 Config | yes | `.env.example` contains placeholder values only; `.gitignore` excludes `.env` from commit one; no quotes/trailing-whitespace hazards documented |

### Known Threat Patterns for This Stack (contract-relevant subset)

| Pattern | STRIDE | Standard Mitigation (frozen in Phase 1 docs) |
|---------|--------|----------------------------------------------|
| JWT algorithm confusion (`alg:none`, RS/HS swap) | Spoofing | Contracts pin HS256 explicitly on issue AND verify sides; forged-token tests assigned to Phase 7 |
| Secret divergence via CRLF-contaminated `.env` | Tampering | `.gitattributes` LF law + "no quotes/trailing whitespace" note in `.env.example` (Pitfall 8↔11 linkage) |
| Identity spoofing via request body (`userId` field) | Spoofing | Contracts state: identity derives EXCLUSIVELY from verified JWT `sub` claim server-side; bodies carry no identity |
| Totals tampering (client-supplied prices) | Tampering | Cart/orders specs document server-side recomputation; client sends productId+quantity only |
| Internals disclosure in errors | Information Disclosure | Error envelope `message` policy; correlation via `code`, not stack details |
| Secrets committed to repo | Information Disclosure | `.env.example` placeholders + `.gitignore` from commit one |

## Sources

### Primary (HIGH confidence — in-repo, read directly this session)
- `.planning/REQUIREMENTS.md` — CONTR/AUTH/CAT/CART/ORDR requirement texts, outcome enum, Idempotency-Key, public-path matrix (lines 12–61)
- `.planning/research/ARCHITECTURE.md` — topic contract tables (159–171), JWT claims table (243–249), edge list (78–96), monorepo tree (332–354), ports (31–54), state machine (173–185)
- `.planning/research/PITFALLS.md` — JSON interop five rules (119–144), CRLF/.gitattributes (271–299), drift gate (95–116), secret hygiene (194–216)
- `.planning/research/STACK.md` — all version pins (17–54, verified again by grep this session)
- `.planning/research/FEATURES.md` — D6 pagination-contractual note (65), G1/G4 gap closures (107–110)
- `.planning/STATE.md` — pre-phase sign-off blockers (67–69)
- npm registry (`npm view` this session) — `@stoplight/spectral-cli` 6.16.3, `@redocly/cli` 2.47.0, both no-postinstall

### Secondary (MEDIUM confidence — official docs via web search)
- git-scm.com/docs/gitattributes + docs.github.com line-endings page — `text`/`eol` semantics, autocrlf interaction
- redocly.com/docs/cli (configure-rules, recommended ruleset) — lint rulesets, recommended-strict
- stoplightio/spectral usage guides (qaskills.sh 2026 guide; npm package docs) — CLI flags, `--fail-severity`, monorepo globs, ref dereference behavior
- sourced.sh validator comparison (2026-05-25) — OpenAPI 3.0 vs 3.1 tooling-support caveat
- factorhouse.io + oneuptime.com partition-strategy guides — topic-contract field checklist, partition immutability
- stackoverflow #77788127/#78645682 + aleksandrhovhannisyan.com — renormalization workflows, `i/`·`w/` output reading

### Tertiary (LOW confidence — flagged)
- cmd.exe LF-label fragility (A1) — practitioner consensus, not vendor-documented
- Exact springdoc/FastAPI generated-spec endpoints (A2) — defaults from training knowledge, verified only when services exist

## Metadata

**Confidence breakdown:**
- Contract content inventory: HIGH — every value quoted from planning docs read this session; contradictions flagged rather than silently resolved
- Tooling/format choices (Spectral, OpenAPI 3.0.3, gitattributes semantics): MEDIUM — official-docs-cited, cross-checked across ≥2 sources
- Pitfalls: HIGH for in-repo-derived (CRLF, drift, interop — previously researched); MEDIUM for tooling gotchas

**Research date:** 2026-08-24
**Valid until:** 2026-09-23 (30 days; pins re-verified at each consuming phase regardless)
