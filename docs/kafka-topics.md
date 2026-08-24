# Kafka Topic Contracts — `order.created` & `payment.completed`

This document is the event backbone of the platform: both topics are **declared here,
before any producer exists**, and every service that touches Kafka implements from this
file alone — no questions asked back to planning.

- **Schemas are inline JSON.** There is NO Schema Registry in v1 — an explicit exclusion:
  two flat message shapes do not justify the operational weight, so *this document is the
  registry*. Writers stay closed to the shapes below; receivers ignore unknown fields.
- **Payloads obey `docs/json-interop.md`**: identifiers are JSON strings regardless of
  storage types; money is integer minor units with `Cents`-suffixed field names (floats
  are forbidden on the wire AND in examples); timestamps (`createdAt`, `processedAt`) are
  ISO 8601 strings with millisecond precision in UTC (`Z` suffix); optional fields are
  omitted entirely, never sent as `null`.
- **Auto-create is OFF.** Topics are provisioned by the Phase 5 compose layer with
  exactly the settings frozen here. An undeclared topic fails loudly at produce/consume
  time instead of silently materializing with wrong partition counts or cleanup policy.
- **Delivery is at-least-once everywhere**, which means duplicates WILL happen; every
  consumer's dedup contract is part of the topic contract itself, not an implementation
  afterthought.

---

## Topic: order.created

Published by order-service AFTER the order insert commits (ORDR-02) — never before, so a
consumer acting on this event can rely on the REST resource existing.

| Field              | Value                                                                                                          |
|--------------------|----------------------------------------------------------------------------------------------------------------|
| Name               | `order.created`                                                                                                 |
| Partitions         | 3 — declared up-front; partition counts are immutable post-creation, fixing the consumer-parallelism ceiling at birth |
| Replication factor | 1 (single-broker dev override)                                                                                  |
| Key strategy       | record key = `orderId` (string) → per-order ordering within a partition                                         |
| Cleanup policy     | delete; retention ≥ 7 days (replay/debug window)                                                                |
| Producer           | order-service                                                                                                   |
| Consumers (groups) | `payment-service`, `notification-service`                                                                       |
| Delivery semantics | at-least-once; consumers MUST be idempotent (dedup contract below)                                              |
| DLQ stance         | none in v1 — poison messages are logged and skipped (mock domain tolerates it)                                  |

### Payload

Field names mirror `docs/api-contracts/orders-service.openapi.yaml`
(`OrderSnapshot` / `OrderItem` schemas) exactly — single drift surface; change both
together or the review gate fails.

```json
{
  "eventId": "7d39c26e-9b34-4b6e-a1f0-5c2e8d9a4b10",
  "orderId": "ord-1001",
  "userId": "usr-42",
  "userEmail": "shopper@example.com",
  "items": [
    {
      "productId": "prod-1001",
      "nameSnapshot": "Mechanical Keyboard",
      "unitPriceCents": 12999,
      "quantity": 1
    },
    {
      "productId": "prod-1002",
      "nameSnapshot": "USB-C Cable",
      "unitPriceCents": 999,
      "quantity": 2
    }
  ],
  "totalCents": 14997,
  "currency": "USD",
  "createdAt": "2026-08-24T12:15:00.000Z"
}
```

| Field        | Type                | Constraint                                                                                  |
|--------------|---------------------|---------------------------------------------------------------------------------------------|
| `eventId`    | string (UUID)       | unique per emission; notification-service dedup key                                         |
| `orderId`    | string              | equals the REST resource id under `/orders`; also the Kafka record key                       |
| `userId`     | string              | owning user; equals the JWT `sub` of the checkout caller                                     |
| `userEmail`  | string              | rendering input for the confirmation email (D-06); user's own address only                   |
| `items[]`    | array of objects    | every element carries exactly `productId`, `nameSnapshot`, `unitPriceCents`, `quantity`; mirrors `OrderItem` in the orders spec |
| `totalCents` | integer             | minor units — sum of `unitPriceCents × quantity` across items; integer, never a float        |
| `currency`   | string (ISO 4217)   | travels beside the total (for example `USD`)                                                 |
| `createdAt`  | string              | ISO 8601, millisecond precision, UTC (`Z` suffix)                                            |

### Dedup contract (per consumer)

- **payment-service:** skip if `orderId` is already authorized — a redelivered
  `order.created` must NEVER trigger a second authorization attempt against the mock PSP.
- **notification-service:** dedupe on `eventId` — a repeated `eventId` means the
  confirmation email was already rendered and sent.

---

## Topic: payment.completed

Published by payment-service once the outcome of the authorization attempt is recorded.
Keyed identically to `order.created` so every event for one order lands on the same
partition, in order.

| Field              | Value                                                                                                          |
|--------------------|----------------------------------------------------------------------------------------------------------------|
| Name               | `payment.completed`                                                                                             |
| Partitions         | 3 — declared up-front; immutable post-creation                                                                  |
| Replication factor | 1 (single-broker dev override)                                                                                  |
| Key strategy       | record key = `orderId` (string) — same keying as `order.created`, so per-order events land ordered              |
| Cleanup policy     | delete; retention ≥ 7 days (replay/debug window)                                                                |
| Producer           | payment-service                                                                                                 |
| Consumers (groups) | `order-service`, `notification-service`                                                                         |
| Delivery semantics | at-least-once; consumers MUST be idempotent (dedup contract below)                                              |
| DLQ stance         | none in v1 — poison messages are logged and skipped (mock domain tolerates it)                                  |

### Payload

```json
{
  "eventId": "c2a9e0d4-6f21-4c58-9a7b-3e5d1f8a2c44",
  "orderId": "ord-1001",
  "outcome": "DECLINED",
  "reason": "Issuer declined: insufficient funds",
  "processedAt": "2026-08-24T12:16:30.123Z"
}
```

| Field         | Type              | Constraint                                                                                        |
|---------------|-------------------|---------------------------------------------------------------------------------------------------|
| `eventId`     | string (UUID)     | unique per emission; notification-service dedup key                                                |
| `orderId`     | string            | the order this outcome belongs to; also the Kafka record key                                        |
| `outcome`     | string enum       | FROZEN spellings: `APPROVED` \| `DECLINED` — nothing else may ever appear on this topic             |
| `reason`      | string            | PRESENT ONLY when `outcome` is `DECLINED`; on `APPROVED` the key is OMITTED entirely (absent-not-null, interop Rule 4). The example above shows the DECLINED variant precisely so the key is visible; an APPROVED payload is this object minus `reason`. |
| `processedAt` | string            | ISO 8601, millisecond precision, UTC (`Z` suffix)                                                  |

### Dedup contract (per consumer)

- **order-service:** ignore `payment.completed` for already-terminal orders (terminal-state
  guards, ORDR-04) — once an order is `PAID` or `PAYMENT_FAILED`, further deliveries of
  either outcome are acknowledged and ignored; transitions out of terminal states do not
  exist. This makes the state machine idempotent under at-least-once redelivery.
- **notification-service:** dedupe BOTH topics on `eventId` — one email per event, no more.

---

## Email Content Payload (rendering-input contract, D-06)

These tables freeze what the notification worker RENDERS FROM — inputs, not HTML. Phase 6
renders exactly these fields; the Phase 9 smoke test asserts delivery programmatically
through Mailpit's REST API endpoint `/api/v1/messages` (Mailpit is the mock SMTP relay per
approved deviation D-07; SMTP on :1025, web UI on :8025).

Common envelope:

| Field         | Value                   |
|---------------|-------------------------|
| From address  | `orders@ecommerce.local` |

Subject templates:

| Variant   | Subject template                 |
|-----------|----------------------------------|
| APPROVED  | `Order {orderId} confirmed`      |
| DECLINED  | `Order {orderId} payment failed` |

Body fields — APPROVED variant:

| Rendered element                                             | Source field(s)                    | Example                                   |
|--------------------------------------------------------------|------------------------------------|-------------------------------------------|
| Order identifier                                             | `orderId`                          | `ord-1001`                                 |
| Item summary lines — one per item, `{nameSnapshot} × {quantity}` | `items[].nameSnapshot`, `items[].quantity` | `Mechanical Keyboard × 1`, `USB-C Cable × 2` |
| Total line — minor units formatted with currency symbol      | `totalCents` + `currency`          | `$149.97` (from `14997 USD`)               |
| Status word                                                  | literal                            | `PAID`                                     |

Body fields — DECLINED variant:

| Rendered element                                             | Source field(s)                    | Example                                    |
|--------------------------------------------------------------|------------------------------------|--------------------------------------------|
| Order identifier                                             | `orderId`                          | `ord-1001`                                  |
| Decline reason — rendered VERBATIM                           | `reason`                           | `Issuer declined: insufficient funds`       |
| Status word                                                  | literal                            | `PAYMENT_FAILED`                            |
| Next-step sentence                                           | literal                            | Retry your purchase anytime with a fresh checkout. |

Notes:

- The decline `reason` travels through events verbatim into the mailbox (threat register
  T-05-04 disposition: accept — the user's own email to their own address IS the feature;
  no third-party recipients exist in v1).
- Cross-consistency: payload field names above mirror `orders-service.openapi.yaml`
  schemas deliberately — change both together or the review gate fails.
