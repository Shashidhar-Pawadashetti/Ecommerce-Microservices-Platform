# Payment Service

FastAPI 0.141.1 + aiokafka 0.14.0 service that is the **payment saga participant**.
It has **no REST surface** — it only reacts to Kafka. It consumes
`order.created`, runs a *mock* authorization controlled by `PAYMENT_MODE`, and
produces `payment.completed`.

> Built as a thin clone of `catalog-service` (same layout, pydantic-settings,
> Dockerfile) so reviewers can navigate by analogy. The JWT block is kept for
> config parity but is **never used for verification** — the service is Kafka-only.

## Kafka contract (details in `docs/kafka-topics.md`)

| Direction | Topic             | Key        | Notes |
|-----------|-------------------|------------|-------|
| consume   | `order.created`   | `orderId`  | Drives the mock authorization. |
| produce   | `payment.completed` | `orderId` | `outcome` = `APPROVED` \| `DECLINED` (frozen spellings). `reason` is **omitted** on `APPROVED` (interop Rule 4). |

### Redelivery safety (ORDR-03 / ORDR-08)
Before authorizing, the service sets a Redis `SETNX` key
`payment:authorized:{orderId}`. A redelivered `order.created` finds the key and is
a no-op — never double-charges. The state change is produced **after** the SETNX,
and `order-service` commits its state change before acknowledging the offset, so
at-least-once delivery is safe.

## Configuration (env)

| Env                  | Default              | Notes |
|----------------------|----------------------|-------|
| `KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092`     | Kafka broker |
| `REDIS_URL`          | `redis://redis:6379/0` | dedup store |
| `PAYMENT_MODE`       | `always_success`     | `always_success` \| `always_fail` \| `random` (mock authorizer) |
| `JWT_*`              | (unused for verify)  | parity with catalog-service only |

## Build & run

```bash
cd services/payment-service
python -m uv sync                 # provision .venv from pyproject.toml
python -m uv run uvicorn app.main:app --host 0.0.0.0 --port 8083
```

Local tests (no Compose needed — real RedisContainer for the SETNX dedup):

```bash
python -m uv run pytest -q tests/
```

## Deviations from plan

- **A3** — does not issue JWTs (auth-service is the sole issuer); does not verify
  them either (Kafka-only).
- **A5** — `:8083` exposed transiently for Phases 5–6; revoked in Phase 7.
- See `docs/runbook.md` (DOCS-02) for the full deviation log.
