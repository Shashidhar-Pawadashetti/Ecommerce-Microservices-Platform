# Pitfalls Research

**Domain:** Polyglot e-commerce microservices platform (Java/Spring Boot + Python/FastAPI + Node/Express, Kafka KRaft single-broker, Postgres/MongoDB/Redis, Next.js, Docker Compose on Windows)
**Researched:** 2026-08-24
**Confidence:** MEDIUM (findings cross-checked against official image docs/repos — apache/kafka GitHub compose examples, docker-library/postgres PR #1259 thread, OWASP JWT Cheat Sheet, Spring Kafka docs, Docker Compose docs — plus practitioner post-mortems; single-source web findings capped at LOW→MEDIUM per verification protocol)

> Phase names below use the roadmap shorthand: **contracts** (Phase 1), **auth** (2), **catalog** (3), **cart** (4), **order+payment** (5), **notification** (6), **gateway** (7), **frontend** (8), **orchestration** (9), **docs** (10).

## Critical Pitfalls

### Pitfall 1: Kafka `advertised.listeners` — bootstrap succeeds but every real operation fails

**What goes wrong:**
Kafka clients make TWO connection phases: (1) bootstrap — connect to `bootstrap.servers` to fetch cluster metadata; (2) data plane — reconnect to whatever host:port the broker *advertised* in that metadata. If `KAFKA_ADVERTISED_LISTENERS` returns an address unreachable from the client's network (`localhost` to an intra-Docker client, or the container hostname `kafka:9092` to a host-side tool like `kafkacat`/Kafka UI), phase 1 succeeds and phase 2 fails with `Connection refused` / `NoBrokersAvailable` / `TimeoutException`. The broker looks perfectly healthy; logs show it listening; nothing in phase-1 diagnostics reveals the problem. This is the single most-reported Kafka-in-Docker failure.

**Why it happens:**
Tutorials copy single-listener configs (`PLAINTEXT://localhost:9092`) which only serve one of the two client populations. Also common: binding a listener to `localhost` *inside* the container (binds to container loopback NIC — unreachable via published port; documented in wurstmeister/kafka-docker#424), reusing the same port for two listeners, or forgetting `KAFKA_LISTENER_SECURITY_PROTOCOL_MAP` once a second listener name exists (the default map no longer applies).

**How to avoid:**
Use the dual-listener pattern straight from the official apache/kafka repo compose example (single-node, combined KRaft mode):

```yaml
environment:
  KAFKA_NODE_ID: 1
  KAFKA_PROCESS_ROLES: 'broker,controller'
  KAFKA_CONTROLLER_QUORUM_VOTERS: '1@kafka:29093'
  KAFKA_LISTENERS: 'CONTROLLER://:29093,PLAINTEXT://:19092,PLAINTEXT_HOST://:9092'
  KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://kafka:19092,PLAINTEXT_HOST://localhost:9092'
  KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT'
  KAFKA_INTER_BROKER_LISTENER_NAME: 'PLAINTEXT'
  KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER'
  CLUSTER_ID: '<22-char base64 UUID>'
```

Rules: listeners *bind* with bare `:port` (all interfaces); *advertised* hostnames differ per audience — container name for services inside the Compose network, `localhost:mappedPort` for host-side clients; each listener gets its own port; controller listener is separate and never advertised to clients. All service containers use `kafka:19092`; only host-run tools use `localhost:9092`.

**Warning signs:**
- `docker exec` into any service and run a metadata dump (`kafka-broker-api-versions.sh --bootstrap-server kafka:19092`) — if it prints addresses your client can't resolve, config is wrong before anything else breaks.
- A producer/consumer hangs ~60s then throws `TimeoutException` while `nc -vz kafka 19092` succeeds.
- Kafka UI shows brokers but topics/consumers fail to load.
- Any tutorial config where `advertised.listeners` contains only one hostname.

**Phase to address:** **order+payment** (first Kafka consumers/producers join Compose here). Bake the dual-listener block verbatim into the compose file at this phase; smoke test must include one host-side AND one container-side metadata check. Re-verified in **orchestration**.

---

### Pitfall 2: KRaft storage vs `CLUSTER_ID` mismatch — crash loop after "just changing one env var"

**What goes wrong:**
The apache/kafka image formats KRaft storage automatically when the log dir is empty, stamping `CLUSTER_ID` into `meta.properties`. If you later change `CLUSTER_ID`, node ID, quorum voters, or mount a stale/partial volume, the broker exits with `INCONSISTENT_CLUSTER_ID` (error 104) or raft `Vote request ... rejected` errors and restarts forever. Equally common: leaving the log dir at the image default `/tmp/kraft-combined-logs` *without* a named volume, so all topics/offsets vanish on every `compose down`.

**Why it happens:**
KRaft merges what ZooKeeper used to hold into the local log dir; identity is persisted, so env vars and disk state must agree. Developers treat env vars as stateless config.

**How to avoid:**
1. Set `CLUSTER_ID` once (any valid 22-char base64 UUID, e.g. generate with `kafka-storage.sh random-uuid`) and never change it without also deleting the volume.
2. Mount a named volume at the exact dir referenced by `KAFKA_LOG_DIRS`.
3. The reset flow ("fresh environment") must be `docker compose down -v` — volumes included — because Postgres resets alone don't clear Kafka metadata.
4. For single-broker dev set `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1`, `KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1`, `KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1`, `KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0` — defaults assume ≥3–4 brokers and hang topic creation.

**Warning signs:**
- Container restart-looping within seconds of `up`; logs contain `INCONSISTENT_CLUSTER_ID` or `Cluster ID mismatch`.
- Consumers stuck in `NoActiveGroup`/`UnknownTopicOrPartition` right after first `up` (replication factor > broker count).
- Topics disappear after a down/up cycle (log dir was ephemeral `/tmp`).

**Phase to address:** **order+payment** (broker enters Compose here). Codify the reset command (`make reset` / script) in this same phase so later phases never improvise it; document failure modes in **docs**.

---

### Pitfall 3: Consumer-group rebalances and offset redelivery treated as "it works once" — no idempotency, wrong knobs

**What goes wrong:**
Three related failures. (a) *Rebalance storms:* a consumer that processes slowly (or blocks in a synchronous HTTP call or retry loop) exceeds its poll deadline; it leaves the group, commits start failing with `CommitFailedException`/`UnknownMemberID`, and an eager assignor revokes **all** partitions group-wide — one slow member stalls everyone and cascades. (b) *Wrong knob:* `session.timeout.ms` (heartbeat liveness) and `max.poll.interval.ms` (processing progress) are different clocks with different fixes; doubling the session timeout does nothing for a poll-clock firing. kafkajs (notification-service) has **no** `max.poll.interval.ms` equivalent — heartbeats are emitted from the same single thread as message processing, so slow handlers trip the *session* timeout there. aiokafka (payment-service) documents long-processing > `max_poll_interval_ms` as a known leave-group loop. Spring Kafka blocking retry/backoff suspends the poll thread entirely. (c) *Redelivery surprises:* the Phase 5 verify step deliberately kills Payment mid-flow; Kafka is at-least-once, so after restart the same `order.created` is re-consumed — if payment isn't idempotent you get double `payment.completed`, double notifications, and order-status flapping.

**Why it happens:**
Defaults are tuned for fast processing (500 records/poll); polyglot teams tune each client library differently and assume uniform semantics. Idempotency feels unnecessary until the first restart test.

**How to avoid:**
- Design every consumer idempotent from day one: payment keys on `orderId` (skip if already authorized), order-status updates are state-machine transitions (`PAID` from `PENDING` only), notification dedupes on `eventId`. This makes redelivery a feature, not a bug.
- Keep handler work small per poll (`max.poll.records` low on Spring side); never block the poll thread on retries — use Spring Kafka's `SeekToCurrent`-style error handling / non-blocking retries, or in aiokafka raise `max_poll_interval_ms` above worst-case processing.
- In kafkajs set `sessionTimeout` comfortably above slowest expected handler time and disable auto-commit (`eachMessage` commits per message) for at-least-once semantics.
- For the kill/restart verification: expect one rebalance on kill and one on rejoin (single consumer group, eager protocol) — that's correct behavior to *observe*, not fight. Static membership (`group.instance.id`) is overkill for single-instance dev groups.
- Set `auto.offset.reset=earliest` on consumers so first-run groups don't silently skip messages produced before they joined.

**Warning signs:**
- Logs: "Attempt to heartbeat failed since group is rebalancing", `CommitFailedException`, member IDs churning.
- Consumer group state oscillating `Stable ↔ PreparingRebalance` in Kafka UI without any deploy.
- Duplicate emails/notifications after a service restart (idempotency missing).
- Notification service dying under load but healthy idle (kafkajs session timeout vs handler latency).

**Phase to address:** **order+payment** introduces producer/consumer + the kill/restart redelivery test; **notification** re-validates with kafkajs's different timeout model. Idempotency rules belong in **contracts** (Kafka topic contract should specify the dedup key, e.g. `orderId` / `eventId`).

---

### Pitfall 4: Cross-language OpenAPI contract drift — three implementations, zero shared types, silent divergence

**What goes wrong:**
The OpenAPI files in `docs/api-contracts/` are hand-authored once in **contracts**, then each service milestone implements against them from a fresh context weeks apart. Without a mechanical gate, Java (Jackson), Python (Pydantic/FastAPI), and Node (plain objects) each evolve their own interpretation: FastAPI will happily emit its own generated schema that disagrees with the committed spec; Spring's DTOs gain fields the spec never declares; Express validates nothing. The failure surfaces only when two services meet in Compose — a 400 on checkout because Python rejects what Java sends.

**Why it happens:**
Code-first convenience: every framework can generate its own spec, so nobody treats the committed file as authoritative. Practitioner post-mortems (Malt engineering: FastAPI-generated OAS "not standardised enough" for Kotlin/Java consumers; api-contract-testing.com: "a code-first spec that silently omits a nullable constraint produces clients that crash on a real null") show this is the default trajectory, not an edge case.

**How to avoid:**
- Declare in **contracts**: the committed YAML is THE source of truth; code-first generation may be used locally but must be reconciled before merge.
- Make the spec executable where cheap: generate Pydantic models or TypeScript types from spec (openapi-generator / openapi-typescript) rather than hand-writing parallel models; for Spring, springdoc output can be diffed against the committed file.
- Add a drift gate even without CI: a script (`scripts/check-contracts.sh`) that boots each service standalone, fetches its live `/v3/api-docs` or `/openapi.json`, diffs against the committed spec (oasdiff for breaking-change classification), and exits non-zero. Run it inside every service's Verify step.
- Contract examples double as smoke-test fixtures: the E2E script posts exactly the payloads documented in the spec.

**Warning signs:**
- A service's `/openapi.json` differs from `docs/api-contracts/*.yaml` (diff them at every phase Verify — takes seconds).
- Integration bugs whose root cause is "the field is named X here and Y there."
- Someone edits a service's response shape "temporarily" during debugging.
- Spec files untouched across N phases while services shipped new endpoints.

**Phase to address:** **contracts** establishes authorship rules and the check script; every subsequent service phase runs it in Verify; **orchestration** runs the full cross-service pass; **docs** freezes final specs.

---

### Pitfall 5: JSON serialization ambiguity between Jackson, Pydantic, and JavaScript — dates, nulls, IDs, unknown fields

**What goes wrong:**
The same JSON field means different things in each runtime unless the contract pins it down:
- **Dates/timestamps:** Java `Instant` → ISO-8601 with nanoseconds (`2026-08-24T10:15:30.123456789Z`); Pydantic v2 parses it but truncates to microseconds; JS `Date` handles milliseconds only. Epoch-millis numbers vs ISO strings mixed across producers = parsing chaos.
- **Nullability:** Jackson serializes `null` fields by default; many Node APIs just omit absent fields; Pydantic v2 by default ignores extra input but its *response* model emits whatever the field allows. OpenAPI `nullable: true` (3.0) vs `type: [x, "null"]` (3.1) dialect confusion produces validators that disagree.
- **IDs > 2^53:** Java `long` snowflake/auto IDs serialize as JSON numbers; JavaScript's `Number.MAX_SAFE_INTEGER` is 2^53 — a Postgres bigserial crossing that threshold becomes a corrupted ID in Next.js/kafkajs land, silently.
- **Unknown fields:** Jackson's default `FAIL_ON_UNKNOWN_PROPERTIES=true` makes Java reject payloads Pydantic/Node accept; the reverse (Java adds a field) breaks strict Python configs. Money as float drifts rounding rules across three runtimes.

**Why it happens:**
Each language's defaults are locally sane; nothing forces the cross-language decision until integration.

**How to avoid (decide ONCE, in contracts):**
1. Timestamps: ISO-8601 UTC strings, millisecond precision max (`yyyy-MM-dd'T'HH:mm:ss'Z'`), `format: date-time` in specs.
2. IDs: strings in all JSON contracts (Kafka events + REST bodies), regardless of DB column type.
3. Nullability: optional = absent key; explicit `null` forbidden except where the spec marks `nullable`; pick OpenAPI 3.0.x consistently (`nullable: true`) since generators/tooling support it most uniformly.
4. Unknown fields: ignore-on-read everywhere (relax Jackson via config; Pydantic default; JS trivially).
5. Money: integer minor units (`priceCents`) — never floats.

**Warning signs:**
- A date string with 9 fractional digits reaching a JS client; `NaN`/`Invalid Date` in frontend.
- Intermittent "cart total off by a cent" reports.
- Jackson `UnrecognizedPropertyException` in order-service after payment adds a field to its event payload.
- IDs that look right in Postgres but differ in browser devtools.

**Phase to address:** **contracts** (encode all five decisions in the spec style-guide + kafka-topics.md); enforced mechanically by the Pitfall 4 drift gate in every service phase.

---

### Pitfall 6: JVM containers OOMKilled on memory-limited dev machines — exit 137 with no Java exception

**What goes wrong:**
Three JVM services (auth, order, gateway — gateway is Netty-based Spring Cloud Gateway) plus a Maven build stage each inside containers, all on one Docker Desktop VM that might have 4–8 GB total. The kernel OOM-killer kills any container whose *RSS* (heap **plus** metaspace ~80–150 MB, code cache 40–80 MB, thread stacks, and Netty direct buffers — which WebFlux/SCG actively uses) exceeds its cgroup limit. Result: `exit code 137`, `OOMKilled: true`, zero Java exceptions logged. Two sizing traps: (a) older JDKs defaulted `MaxRAMPercentage` to 25% of the container limit (wasteful) while recent JDKs moved the default to 75% when a container limit exists (JDK CSR JDK-8356194) — so behavior silently changes across base-image bumps; (b) setting `-XX:MaxRAMPercentage` high (or leaving no container limit at all, letting JVM size off host RAM) on an already-tight machine kills neighbors.

**Why it happens:**
Heap is not the whole footprint; percentage defaults changed across JDK versions; nobody sums per-service limits against the Docker Desktop allocation.

**How to avoid:**
- Pin explicitly in every Java Dockerfile/ENTRYPOINT: `-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError` (loud failure + restart beats zombie degradation). Do **not** also set `-Xmx` (it wins silently and confuses tuning).
- Set explicit `mem_limit` on every Compose service; keep the sum ≤ ~75% of Docker Desktop's allocated memory. Realistic dev sizing: auth/order ≈ 512m–768m each, gateway ≈ 512m, Kafka ≈ 1g (`KAFKA_HEAP_OPTS=-Xmx512m -Xms256m` is plenty for single-broker dev), Postgres/Mongo/Redis small.
- Verify after first boot: `docker exec <svc> jcmd 1 VM.flags | grep MaxHeapSize` should read ≈75% of `mem_limit`.
- Maven build stage is itself JVM-heavy: use `-DskipTests` in image builds and consider `MAVEN_OPTS=-XX:MaxRAMPercentage=50` in the build stage for low-RAM hosts.
- If JDK 21 point releases meet Linux kernel ≥6.12, prefer 21.0.10+ (earlier misread cgroup limits and sized heap off host RAM).

**Warning signs:**
- `docker inspect <c> --format '{{.State.OOMKilled}} {{.State.ExitCode}}'` → `true 137`.
- Container dies mid-request or during startup with empty service logs.
- `docker stats` RSS hugging the limit while JMX heap looks comfortable (off-heap pressure).
- Whole stack degrades when one more container starts (aggregate budget exceeded).

**Phase to address:** **auth** establishes the JVM Dockerfile pattern (flags + mem_limit template copied by order/gateway); **orchestration** audits the sum of limits against Docker Desktop budget and documents sizing in the runbook (**docs**).

---

### Pitfall 7: `depends_on` conditions are start-ordering, not supervision — plus slow JVM startup vs `start_period`

**What goes wrong:**
(a) `depends_on: {kafka: {condition: service_healthy}}` guarantees ordering only for *this* `compose up`. It does not restart dependents when Kafka restarts later; apps must reconnect themselves (Spring's HikariCP/kafka-client retries do; hand-rolled init code that assumes "dependencies alive forever" doesn't). (b) JVM services take 20–90 s to become ready (Flyway migrations, Hibernate, class loading — slower still on low-RAM machines), far outlasting Python/Node services. Teams compensate by cranking healthcheck `retries` to 15+ — which permanently weakens the check (15 consecutive failures tolerated forever). (c) Healthchecks run *inside* the container against the *container* port: checking the published host port, or invoking `curl` in an image that only has BusyBox `wget` (or nothing — Debian-slim ships neither), yields permanently-unhealthy containers whose app logs show nothing wrong. Worst-case time-to-`unhealthy` = `start_period + retries × (interval + timeout)` — size any scripted smoke test's wait loop to this.

**How to avoid:**
- Use `start_period` (grace window where failures don't count toward `retries`; first success ends it early), not inflated `retries`: JVM services `start_period: 90s`, Kafka `30s`, Postgres `10s`, FastAPI/Express `15s`. Typical `interval: 10s, timeout: 5s, retries: 5`.
- Per-runtime check commands (verified binaries): Java alpine images ship BusyBox `wget` → `wget -qO- http://localhost:8080/actuator/health | grep -q '"status":"UP"'` (actuator required); FastAPI → tiny `/health` endpoint checked via python urllib one-liner (python-slim has neither curl nor wget) or `apt-get install curl`; Node alpine → BusyBox `wget --spider` or a 15-line `healthcheck.js` using the `http` module (most robust); Kafka → `kafka-broker-api-versions.sh --bootstrap-server localhost:19092`; Postgres → `pg_isready -U $POSTGRES_USER`; Redis → `redis-cli ping`.
- Only gate on `service_healthy` for hard dependencies (Kafka→order/payment/notification; Postgres→auth/order); let the rest start concurrently to keep `up` fast.
- Document in the runbook: if a datastore dies mid-session, Compose won't revive dependents — restart policy + client retry logic is the real resilience story even locally.

**Warning signs:**
- Container stuck in `(health: starting)` minutes after up; then `(unhealthy)` though app logs end cleanly.
- `docker inspect --format '{{json .State.Health}}'` shows `exec: "curl": executable file not found in $PATH`.
- Smoke test flaky: passes when run manually 2 min after `up`, fails in scripts that wait only 30 s.
- A service "recovers" from a DB blip only after manual `compose restart`.

**Phase to address:** **orchestration** owns final healthcheck matrix and smoke-test wait strategy; but each service phase adds its own healthcheck when it joins Compose (per plan's incremental-compose rule) — **auth** sets the JVM template, **catalog**/**cart** set the Python/Node templates.

---

### Pitfall 8: JWT trust boundary drift between Java issuer and gateway validator

**What goes wrong:**
Auth-service (Java) signs; gateway (Java/Spring Security resource-server) validates. Classic failure modes: (a) *Algorithm confusion / alg=none* — validator derives algorithm from token header instead of pinning HS256; historical JWT libraries shipped vulnerable-by-default. (b) *Secret mismatch by environment:* both sides read `JWT_SECRET` from `.env`/Compose env — a trailing `\r` from a CRLF `.env` file on Windows, or one service getting the var and another falling back to a default, produces intermittent 401s that look like clock bugs. (c) *Clock skew:* tokens rejected as "not yet valid"/"expired" within seconds of issue because container clocks drift and leeway differs between issuer and validator; teams "fix" it by extending token TTL from 15 min to 24 h, silently destroying revocation value. (d) *Claim drift:* issuer writes `sub`/`email`/`roles`; validator checks none of them (or checks `aud` never agreed upon), so any correctly-signed token grants everything.

**Why it happens:**
Two separately-planned milestones (auth, gateway) must agree on invisible configuration; OWASP's JWT cheat sheet documents that secrets need CSPRNG generation, ≥256-bit length, per-(issuer,audience) uniqueness, and parser-side algorithm allowlisting — none enforced by default.

**How to avoid:**
- Both services configure the same pinned properties, written down in the auth phase and copied verbatim into gateway: issuer signs with fixed `HS256`; gateway sets `spring.security.oauth2.resourceserver.jwt.jws-algorithms=HS256` (never header-driven) and a custom `OAuth2TokenValidator` asserting `iss` and `aud` (agree on e.g. `aud=ecommerce-api`) plus 60 s clock-skew tolerance (nimbus default).
- Generate the secret with a CSPRNG (`openssl rand -base64 48`), ≥32 bytes, injected identically to exactly two services via Compose env; add a startup assertion that fails loudly if secret < 32 bytes.
- Keep access tokens short-lived (~1 h) — skew tolerance stays meaningful.
- Add a contract test in **gateway**: forge a token with `alg:none` and one with tampered signature; both must be rejected. Cheap, permanent regression guard.
- Guard the `.env`: commit `.env.example`; document that values must not contain quotes/trailing whitespace; on Windows verify with `od -c .env | head` that no `\r` sneaks into values (see Pitfall 11).

**Warning signs:**
- 401s that correlate with container restarts or time-of-day rather than payload.
- Tokens accepted by gateway after auth-service is stopped (validator not checking expiry/iss at all).
- Any code path passing the raw key object into a generic `verify(token, key)` without an algorithms list.
- Token TTL mysteriously grew.

**Phase to address:** **auth** defines signing config + secret handling rules; **gateway** implements validation + the forgery contract tests; **contracts** pins claim names (`sub`, `email`, `roles`, `aud`) in the OpenAPI security scheme so both phases build against one definition.

---

### Pitfall 9: CORS and httpOnly-cookie failures between Next.js and the gateway

**What goes wrong:**
`localhost:3000` and `localhost:8080` are different origins (ports count), so every browser call is cross-origin even in dev. Failure cascade seen in the wild: gateway returns `Set-Cookie` but browser drops it because CORS lacked `Access-Control-Allow-Credentials: true` with an explicit origin (`*` is invalid with credentials); cookie dropped again because `SameSite=None` was set without `Secure` (impossible over plain-http localhost) or `SameSite=Strict` blocked it after the login redirect; then Next.js server components fetch the gateway server-side and get `undefined` cookies because SSR fetch does **not** persist `Set-Cookie` the way browsers do — server-side calls must forward the cookie header manually. Each layer (browser policy, SCG CORS bean, Next middleware, cookie attributes) can independently break auth, producing "works in Postman, broken in browser."

**Why it happens:**
Cookie delivery rules live in four places at once (origin, credentials mode, SameSite/Secure attrs, proxy forwarding), and Next.js App Router's dual client/server data-fetching paths behave differently.

**How to avoid:**
- Prefer eliminating CORS entirely: route all browser traffic through Next.js same-origin endpoints — a catch-all route handler (`app/api/[...path]/route.ts`) or `rewrites()` proxying `/api/*` → `gateway:8080`. Browser sees one origin; cookies are first-party; the proxy translates httpOnly cookie ⇄ `Authorization: Bearer` (or forwards Cookie) toward the gateway.
- If direct browser→gateway calls remain: gateway global CORS with `allowCredentials(true)` + exact origin `http://localhost:3000` (never `*`); configure CORS **only** at the gateway (downstream services unreachable externally anyway — double configs produce duplicate headers).
- Cookie attributes: `SameSite=Lax`, `httpOnly=true`, `Secure` only when HTTPS (`process.env.NODE_ENV === 'production'`), `Path=/`. Lax survives top-level navigation post-login; Strict breaks redirect flows; None breaks http dev.
- Server components: read the token via `cookies()` (Next.js API) and attach it explicitly to outbound gateway requests; never rely on Set-Cookie propagating through an SSR fetch chain.

**Warning signs:**
- Login succeeds (200, correct JSON) but subsequent requests are anonymous.
- Browser console: "has been blocked by CORS policy: The value of 'Access-Control-Allow-Origin' header… must not be wildcard when credentials mode is 'include'".
- Cookie visible in `/login` response headers but absent from Application→Cookies.
- Works when navigating client-side, fails on hard refresh (server-component path).

**Phase to address:** **frontend** decides proxy-vs-direct and cookie attributes; **gateway** owns the CORS config (or confirms none needed under full-proxy design) and forwarded-header handling; **auth** ensures Set-Cookie shape matches what frontend chose.

---

### Pitfall 10: postgres:18 changed its volume layout — data silently written outside your named volume

**What goes wrong:**
The official `postgres:18` image (docker-library/postgres PR #1259) moved `PGDATA` to a version-specific path `/var/lib/postgresql/18/docker` and changed the declared `VOLUME` to `/var/lib/postgresql`. Copying the decade-old habit `- postgres_data:/var/lib/postgresql/data` produces one of two outcomes: an immediate runc mount error (`no such file or directory at /var/lib/postgresql/data`), or — nastier — a *successful start* where Postgres initializes into an auto-created **anonymous** volume while your named volume sits empty. Every container recreation then runs `initdb` from scratch: users vanish, orders vanish, "Docker lost my database." The same down/up semantics surprise people generally: Ctrl+C on foreground `up` keeps containers, `compose down` removes them (data survives in volumes), only `down -v` truly resets.

**Why it happens:**
Muscle memory from every tutorial written for ≤17; the breaking change is documented but easy to miss; nothing errors when the wrong path silently diverges from PGDATA.

**How to avoid:**
- Compose mounts named volume at `/var/lib/postgresql` exactly:
  ```yaml
  volumes:
    - postgres_data:/var/lib/postgresql   # NOT /var/lib/postgresql/data
  ```
- Do not override `PGDATA` back to the legacy path — it fights the image design and breaks the future `pg_upgrade --link` upgrade path.
- MongoDB/Redis keep their classic paths (`/data/db`, default) with named volumes; on Windows/macOS prefer named volumes over host bind-mounts for all three stores (bind-mounted memory-mapped DB files misbehave through Docker Desktop's filesystem layer).
- Write the two reset flows as scripts now: `reset-keep-data` = `docker compose restart <svc>`, `reset-all` = `docker compose down -v && docker compose up -d && re-seed catalog`. Kafka's log-dir volume belongs in `reset-all` too (Pitfall 2).

**Warning signs:**
- Logs contain initdb output ("fixing permissions… creating subdirectories… Success") after a mere restart-with-recreate.
- `docker volume ls` shows accumulating hash-named anonymous volumes.
- Catalog seed data gone but Mongo volume untouched.
- Startup fails with mount propagation error mentioning `/var/lib/postgresql/data`.

**Phase to address:** **orchestration** owns compose volume definitions + reset scripts; but **auth** creates the first Postgres service — get the mount right there so order-service copies the correct pattern. Runbook (**docs**) documents both flows.

---

### Pitfall 11: Windows dev environment — CRLF poisons entrypoints, Maven wrapper, and `.env` secrets

**What goes wrong:**
Git for Windows defaults `core.autocrlf=true`: files convert LF→CRLF on checkout. Inside Linux containers this breaks three distinct things: (1) shell scripts — shebang becomes `#!/bin/sh\r`; kernel hunts for interpreter `/bin/sh\r` and reports the *misleading* error `exec user process caused "no such file or directory"` though the file exists; (2) `./mvnw` is itself a shell script — CRLF breaks it *inside the Maven build stage*, failing image builds of all three Java services; (3) `.env` values can carry a trailing `\r`, so `JWT_SECRET=abc\r` differs between services depending on how each parses env files — intermittent auth failures (Pitfall 8) that no code review catches. Secondary Windows friction: bind-mounted hot reload watches don't propagate inotify (Next.js/FastAPI reload silently never triggers without polling fallbacks), and this repo lives under OneDrive, whose sync locks files mid-build (flaky Maven/npm installs, Docker context upload races).

**Why it happens:**
Line endings are invisible; the kernel error names the file, not the `\r`; each language toolchain has its own env-parsing quirks.

**How to avoid:**
- Commit `.gitattributes` in Phase 0/orchestration groundwork — before any service exists:
  ```
  *.sh text eol=lf
  mvnw text eol=lf
  Dockerfile text eol=lf
  *.env text eol=lf
  .env.example text eol=lf
  ```
- Defense-in-depth in Java Dockerfiles after COPY: `RUN sed -i 's/\r$//' ./mvnw && chmod +x ./mvnw`.
- For hot reload prefer Compose overrides that rebuild rather than bind-mount, or set explicit polling (`WATCHPACK_POLLING=true` for Next.js, `uvicorn --reload` with `WATCHFILES_FORCE_POLLING=true`) in `docker-compose.override.yml`.
- Recommend excluding the project directory from OneDrive sync (or relocating dev copies outside synced folders); note it in README setup steps.
- Never commit real `.env`; provide `.env.example` and document `copy + edit` rather than shared state.

**Warning signs:**
- Image builds fine; container exits instantly with `standard_init_linux.go`/`no such file or directory`.
- `./mvnw package` works on host but fails inside `maven:` build stage.
- Two services disagree about an identical env var; `docker exec <c> printenv JWT_SECRET | od -c` shows trailing `\r`.
- File changes not triggering reload under `docker compose -f ...override.yml up`.

**Phase to address:** **contracts** phase groundwork (repo scaffolding precedes all services) adds `.gitattributes` + `.editorconfig`; **auth** proves the mvnw-in-Docker pattern; **frontend** handles polling config; **docs** runbook captures Windows setup notes.

---

### Pitfall 12: Healthcheck definitions that pass locally but mean nothing per-runtime

**What goes wrong:**
Copy-pasted healthchecks produce false confidence in both directions. False *unhealthy*: `curl` absent from alpine/slim images (Debian-slim JRE images ship neither curl nor wget; node-alpine's BusyBox wget lacks some flags people use); healthcheck targets published host port instead of container port (`ports: "8080:8080"` vs app on 3000); endpoint path returns 404 (app mounted under a base path). False *healthy*: checking TCP connect instead of readiness (Spring port opens before Flyway finishes; Kafka socket binds before controller election completes), so `service_healthy` gates open early and dependents crash-loop against half-ready dependencies.

**Why it happens:**
Healthcheck runs invisibly inside each container; per-image tooling differs wildly across the three runtime families; readiness ≠ liveness confusion.

**How to avoid:**
Standard matrix (verified against pinned images):

| Service | Test command | Notes |
|---|---|---|
| Spring Boot ×3 | `wget -qO- http://localhost:8080/actuator/health \| grep -q UP` | temurin alpine ships BusyBox wget; actuator required; grep guards against detail-mode JSON drift |
| FastAPI ×2 | python urllib one-liner hitting `/health` (or apt-get curl) | python:slim has neither curl nor wget |
| Express cart | BusyBox `wget --spider -q http://localhost:3000/health` | verify flags exist in chosen alpine base |
| Notification worker | process/lag-based: `kafka-consumer-groups.sh` lag check or simple file-touch heartbeat script | no HTTP server by default |
| Next.js | node `healthcheck.js` using `http` module | most portable; survives distroless hardening later |
| Kafka | `kafka-broker-api-versions.sh --bootstrap-server localhost:19092` | script ships in apache/kafka image |
| Postgres | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | official-image supported |
| Redis | `redis-cli ping \| grep PONG` | |
| Mailpit | wget its `/` UI or SMTP dial | |

Rules: always container-internal `localhost` + container port; assert semantic readiness (grep `UP`, `PONG`) not just exit code; pair generous JVM `start_period` with modest `retries` (Pitfall 7).

**Warning signs:**
- Container flips healthy→unhealthy randomly though traffic flows fine (or vice versa).
- `docker inspect .State.Health.Log` shows `executable file not found` or 404 bodies.
- Dependent starts before dependency ready despite `service_healthy`.

**Phase to address:** each service phase adds its own entry when joining Compose (auth/catalog/cart templates first); **orchestration** audits the full matrix and the smoke test's readiness waits.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hand-writing Pydantic/DTO models parallel to OpenAPI specs instead of generating | Faster start per service | Guaranteed Pitfall 4 drift; every field change touches N files by hand | Never for cross-consumed schemas; fine for purely internal models |
| Auto-commit offsets (`enable.auto.commit=true`) in consumers | No commit bookkeeping | At-least-once becomes at-least-zero-or-more; redelivery test (Phase 5) meaningless; duplicates/drops unexplainable | Never for payment/notification; tolerable for throwaway dev topics |
| Float money values end-to-end | No cents conversion thinking | Rounding drift across Jackson/Pydantic/JS; checkout totals off by cents | Never — integer minor units cost nothing extra |
| Sharing one JWT secret among >2 services "for later" | No new secret per service | Any service can mint tokens for any audience; audit blast radius unbounded | Only issuer+gateway hold it; downstream services trust network isolation (documented) |
| `restart: always` everywhere instead of fixing crash causes | Stack "stays up" | Crash loops mask INCONSISTENT_CLUSTER_ID/OOMKill; logs flood; real failures invisible | `on-failure` with max retries during bring-up debugging only |
| Testing only via gateway once it exists | Single realistic path | Service-level regressions diagnosed late; standalone smoke tests (per-phase Verify standard) skipped | Never — plan already mandates standalone verification per phase |
| Bind-mounting host source for everything incl. datastores | Hot reload "just works" feeling | Windows/macOS FS layer corrupts/slows DB files; OneDrive lock races | Source dirs yes (with polling), datastore dirs never — named volumes |
| Skipping `KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0` | Defaults feel safe | 3s+ delay × every consumer group startup makes smoke tests flaky-wait | Set it for single-broker dev; irrelevant in prod-sized clusters |

## Integration Gotchas

Common mistakes when connecting services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cart → Catalog (REST) | Cart caches product price forever or trusts client-sent prices | Fetch live price server-side at add-time; store snapshot in cart item with `priceAtAdd`; re-validate at checkout |
| Order → Cart | Order trusts cart contents blindly at checkout | Snapshot cart into order payload atomically; clear cart only after order persisted |
| Gateway → services | Also exposing service ports publicly "for debugging" | Only gateway publishes ports externally; debug via `docker exec`/network-internal tools; keeps JWT filter meaningful |
| Next.js → Gateway | Browser calls gateway directly with token in localStorage | httpOnly cookie via same-origin proxy (Pitfall 9); XSS cannot exfiltrate |
| Payment consumer → producer | Producing `payment.completed` before own offset commit | Commit-after-process ordering (at-least-once, idempotent receiver) — avoids lost payments if killed between produce and commit |
| Notification ← both topics | One subscription assuming ordered cross-topic delivery | Topics are independent streams; notification must tolerate either order (e.g., `payment.completed` processed before its `order.created` log line) |
| Flyway migrations | Editing already-applied migration files | Migrations immutable; add new files; checksum mismatch fails startup confusingly otherwise |
| Redis TTL carts | TTL refreshed only on add, not update/view | Touch TTL on every mutation; document expiry semantics in cart contract |
| Mailpit assertions | Smoke test greps container stdout for "sent" | Query Mailpit REST API (`/api/v1/messages`) for deterministic email assertions |
| Kafka topic auto-create | Relying on broker auto-create with default partition count | Pre-create `order.created`/`payment.completed` with declared partitions (contract says 3); `auto.create.topics.enable=false` |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous cart→catalog validation inline per item | Add-to-cart latency = catalog RTT × items; catalog blip blocks cart writes | Batch validate once per request; short TTL cache of product existence | Immediately noticeable at ~10-item carts; critical on catalog outage |
| JVM default heap on shared dev machine | Neighboring containers OOMKilled when all services busy | Explicit mem_limit + MaxRAMPercentage per service (Pitfall 6) | Whenever ≥2 Java services run concurrently on ≤8 GB Docker Desktop |
| Eager rebalance protocol with multi-consumer groups | Group-wide consumption pause on every deploy/restart | CooperativeSticky assignor where client supports it; single-instance dev groups mostly unaffected | When notification/order scale past 1 instance each |
| Unbounded `max.poll.records` with heavy handlers | Poll-clock evictions under burst load (Pitfall 3) | Cap records; measure p99 handler time vs poll interval | First burst after idle period |
| Logging full payloads at INFO in all services | Log volume slows Compose log streaming; PII (emails) scattered | DEBUG-gate payload logging; structured single-line logs | Under E2E smoke loops / soak testing |
| Kafka single partition "for simplicity" | Consumer count capped at 1; no parallelism later | Contract declares 3 partitions now (plan already does); producers key by orderId | When adding second notification/payment instance |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| JWT secret committed via example-env copy-paste habit or weak string ("secret", "changeme") | Full auth forgery forever | CSPRNG-generated ≥32-byte secret; startup length assertion; `.env` gitignored (verify `.gitignore` before first commit) |
| Validator accepting header-chosen algorithm (incl. `none`) | Authentication bypass (OWASP-documented algorithm confusion) | Pin `jws-algorithms=HS256`; forged-token contract tests (Pitfall 8) |
| Exposing service ports besides gateway in compose | Bypasses gateway JWT filter entirely; direct DB-ish access to internals | Publish only gateway/frontend/Kafka-host-listener/UI ports; internal services unpublishable |
| Storing JWT in localStorage "temporarily" in frontend | XSS token theft; httpOnly decision defeated | httpOnly cookie from day one (project requirement) — reject scope creep |
| Password hashing with fast digest or unsalted MD5 "for dev" | Dev habits migrate; credential exposure | bcrypt/argon2 via maintained lib (`pwdlib`/`argon2-cffi` Python side; BCryptPasswordEncoder Java side) even locally |
| Mock payment service accepting arbitrary amounts from events | If event schema loosened, negative/huge totals flow through | Validate amount>0 & currency in payment consumer; contract tests cover rejection cases |
| CORS wildcard with credentials "to make it work" | Any origin can call credentialed API | Exact origin allowlist; fail closed (Pitfall 9) |
| Seed data containing real-looking credentials | Leaked demo accounts reused in later public deployment | Obviously-fake seed users; document in runbook |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Checkout button silent during slow synchronous chain (cart→order→await payment) | Double-clicks → duplicate orders | Optimistic UI + idempotency key on POST /orders (client-generated UUID deduped server-side) |
| Session expires silently mid-cart; checkout 401s with empty state | Cart appears wiped; rage | Frontend detects 401, preserves cart view, redirects to login preserving return path |
| Order status stuck at "pending" because notification/payment lag isn't surfaced | Users re-order | Show honest status machine incl. "processing payment"; poll order status until terminal state |
| Error messages leaking internals ("Connection refused kafka:19092") | Confusing; info disclosure | Map downstream failures to friendly copy + correlation ID logged server-side |
| Cart prices differ from checkout totals | Trust collapse | Display both `priceAtAdd` snapshot and current price; surface discrepancy before payment step |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Auth service:** Often missing `/me` returning consistent claim shapes as login — verify same JSON contract on both paths
- [ ] **JWT flow:** Often missing expiry actually enforced — verify expired token rejected (set TTL to 5 s temporarily)
- [ ] **Cart TTL:** Often missing observable expiry — verify key disappears from Redis after configured TTL
- [ ] **Catalog seed:** Often missing idempotent re-run — verify seed script twice, no duplicate products
- [ ] **Order+Payment:** Often missing kill/restart redelivery handling — verify duplicate `order.created` produces ONE `payment.completed`
- [ ] **Notification:** Often missing both-topic coverage — verify Mailpit receives email for payment-failure path too, not just success
- [ ] **Gateway:** Often missing downstream isolation — verify `curl localhost:<service-port>` unreachable from host after final compose
- [ ] **Frontend:** Often missing logged-out route protection — verify deep-link to /orders redirects when cookie absent
- [ ] **Orchestration:** Often missing cold-start reproducibility — verify `down -v && up` on a clean machine reaches healthy stack + passing smoke test with zero manual steps
- [ ] **Docs/runbook:** Often missing failure-mode entries for exit-137, INCONSISTENT_CLUSTER_ID, PG18 mount error — verify each documented with fix command

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Kafka listener misconfig | LOW | Fix env vars; `compose up -d --force-recreate kafka`; clients reconnect automatically; no data loss |
| CLUSTER_ID/storage mismatch | LOW (dev) | `compose stop kafka && compose rm -f kafka && compose volume rm <kafka-vol>` (or `down -v` accepting full reset); recreate with consistent env |
| Rebalance storm / stuck group | LOW | Restart offending consumer container; check group state via Kafka UI; tune poll/session knobs per Pitfall 3 table |
| Contract drift discovered at integration | MEDIUM | Diff live spec vs committed (oasdiff); fix implementation OR amend spec consciously; re-run affected service smoke tests |
| OOMKilled loop on JVM service | LOW | Confirm 137; raise mem_limit or lower MaxRAMPercentage; `jcmd VM.flags` to verify; watch aggregate budget |
| postgres:18 anonymous-volume data loss | MEDIUM–HIGH | Data may survive in orphaned anonymous volume: `docker volume ls`, inspect candidates, `pg_dump` from a temp container mounting it; then remount correctly and restore. Otherwise re-initdb + re-seed |
| CRLF-broken entrypoint/mvnw | LOW | Apply `.gitattributes`; `git rm --cached -r . && git reset --hard`; add sed safety net to Dockerfiles; rebuild |
| Cookie/CORS auth breakage | LOW–MEDIUM | Binary-search layers: curl gateway directly (no browser) → browser direct → proxied; fix single offending layer per Pitfall 9 checklist |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Kafka advertised.listeners | order+payment (compose block) | Host-side AND container-side metadata dump both resolve; message round-trip observed |
| 2. KRaft CLUSTER_ID/volume | order+payment (+ reset scripts) | `down -v && up` clean; broker stable across restart; scripted reset command exists |
| 3. Rebalance/idempotency | contracts (dedup keys) → order+payment → notification | Kill/restart test: exactly-one processing per event; duplicate injection tolerated |
| 4. OpenAPI drift gate | contracts (rules+script) → every service Verify | Live spec diff vs committed = empty; oasdiff reports no unintended breaks |
| 5. JSON interop conventions | contracts (style-guide decisions 1–5) | Spec review checklist; sample payloads parse identically via jq/python/java snippet |
| 6. JVM memory/OOMKill | auth (template) → orchestration (budget audit) | `jcmd VM.flags` heap ≈75% limit; sum(mem_limits) ≤ Docker Desktop budget; no 137s in soak |
| 7. depends_on/start_period | per-service join phases → orchestration matrix | Cold `up` reaches all-healthy; smoke test passes with fixed wait ≤ worst-case formula |
| 8. JWT trust boundary | contracts (claims) → auth (signing) → gateway (validation+forgery tests) | alg:none & tampered tokens rejected; skew tolerance documented; secret-length assertion fires |
| 9. CORS/cookies | frontend (proxy choice) → gateway (CORS or none) | Login→browse→checkout journey green; cookie visible only via httpOnly; no wildcard+credentials |
| 10. PG18 volume layout | auth (first PG service) → orchestration (volumes+reset flows) | Restart preserves users; `initdb` lines absent from logs on recreate; reset scripts tested |
| 11. Windows CRLF/env | contracts groundwork (.gitattributes) → auth (mvnw proof) → docs | Fresh Windows clone builds+runs; `od -c` on env shows clean values |
| 12. Healthcheck matrix | per-service join → orchestration audit | All containers reach healthy; unhealthy simulation detected by smoke-test wait logic |

## Sources

Cross-checked findings carry MEDIUM confidence (two independent sources minimum); anything weaker is flagged inline.

- Official apache/kafka repo: `docker/examples/docker-compose-files/single-node/plaintext/docker-compose.yml` + Docker Hub `apache/kafka` usage (dual-listener reference config, KRaft env set) — MEDIUM
- Confluent: "Kafka Listeners – Explained" (rmoff) + "Why Can't I Connect to Kafka?" — advertised.listeners two-step mechanics, wurstmeister#424 binding-to-loopback case — MEDIUM
- Axonops Kafka Docker guide + community compose examples: single-node replication-factor/isr overrides, `CLUSTER_ID` stability, KRaft troubleshooting table — MEDIUM
- Confluent forum thread (INCONSISTENT_CLUSTER_ID on persisted storage) + Kafka protocol error registry (error 104) — MEDIUM
- Spring Kafka docs (listener container props, poll timeout guidance), Stack Overflow "Spring Kafka consumer unable to rejoin after LeaveGroup", aiokafka issue #848 (long-processing rebalance loop), kafkajs issue #1182 (no max.poll.interval.ms equivalent), Petascale Labs + Matthew Palma rebalancing deep-dives (2026) — MEDIUM
- api-contract-testing.com schema-vs-code-first analysis; Malt engineering contract-first-with-FastAPI post-mortem; matthewpalma.dev OpenAPI-as-source-of-truth; qaskills.sh drift-detection (oasdiff gates) — MEDIUM
- Netdata Docker-JVM-memory-tuning & OOMKilled guides; Baeldung JVM-in-container; Red Hat container-awareness article; OpenJDK CSR JDK-8356194 (MaxRAMPercentage default 25%→75% under cgroup limit); thecodeforge.io Spring Boot Docker guide (ExitOnOutOfMemoryError, 75/25 split rationale) — MEDIUM
- SSD Nodes "Docker Compose healthchecks that work" (start_period semantics, worst-case formula, binary-presence checks, depends_on-not-supervision) — MEDIUM
- Stack Overflow spring-boot actuator healthcheck threads (temurin-alpine wget availability; debian-slim lacking both tools); makeplane/plane#8392 (node-alpine curl absence); mattknight.io distroless Node healthcheck.js pattern; spring-boot#48970 (Spring team declining built-in checker — confirms image-level responsibility) — MEDIUM
- docker-library/postgres PR #1259 + issues #1364/#1370/#1377 (PG18 PGDATA/VOLUME change, runc mount error, silent anonymous-volume loss), rdiachenko.com "Postgres 18 Docker Silently Ignores Your Named Volume" — HIGH-consistency multi-source — MEDIUM
- OWASP JSON Web Token Cheat Sheet; WorkOS JWT best-practices & algorithm-confusion posts; PortSwigger Web Security Academy algorithm confusion; toolbox365.net verification pitfalls (clock-skew leeway 30–60 s) — MEDIUM
- GitHub vercel/next.js discussions #77116/#36987, Stack Overflow cookie-forwarding threads, devactivity.com cookie-mysteries analysis, chintristan.io SameSite-Strict-with-proxy writeup, maxschmitt.me httpOnly proxy pattern — MEDIUM
- Latchkey.dev CRLF entrypoint CI failures; Stack Overflow entrypoint-CRLF canon (#38905135 et al.); multiple `.gitattributes`-fix PRs (Observal#365, graph-memory#38, superset#16608) — MEDIUM

---
*Pitfalls research for: Ecommerce Microservices Platform*
*Researched: 2026-08-24*
