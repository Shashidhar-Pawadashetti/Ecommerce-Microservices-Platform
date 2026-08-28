---
status: "pending"
requirements_addressed:
  - "NOTF-01"
  - "NOTF-02"
---

# Objective
Implement the Notification Service (Node.js/kafkajs) that consumes the `order.created` and `payment.completed` topics and sends mocked confirmation/failure emails to Mailpit, finalizing Phase 6 of the roadmap.

# Dependencies
- Requires `apache/kafka:4.2.1` and `axllent/mailpit` running via Docker Compose (established in earlier phases).
- Relies on the exact Kafka topic schemas defined in `docs/kafka-topics.md`.

# Must Haves
- **Kafka Consumer Group**: A Node.js worker using `kafkajs` (v2.2.4) in consumer group `notification-service`, subscribed to `order.created` and `payment.completed`.
- **Idempotency**: Deduplicate incoming events using the `eventId` field to ensure exactly one email is sent per event emission.
- **Email Delivery**: Format emails identically to the rendering-input contract in `docs/kafka-topics.md`. Send using `nodemailer` (v9.0.5) to `SMTP_HOST:1025` (Mailpit).
  - From `order.created`: Render the APPROVED variant ("Order {orderId} confirmed").
  - From `payment.completed` (if outcome is `DECLINED`): Render the DECLINED variant ("Order {orderId} payment failed").
  - From `payment.completed` (if outcome is `APPROVED`): Ignore, as the `order.created` event covers the confirmation.
- **Environment**: Node.js 24 LTS, `node:24-alpine` Docker base image, with `npm ci --omit=dev`.

# Verification Plan
- **Pre-verification**: `docker compose up --build -d notification-service`
- **Verification step 1**: Produce an `order.created` event and verify the "Order {orderId} confirmed" email arrives in Mailpit (via its REST API or UI).
- **Verification step 2**: Produce a `payment.completed` event (with `DECLINED` outcome) and verify the "Order {orderId} payment failed" email arrives.
- **Verification step 3**: Re-produce an event with the same `eventId` and assert that no duplicate email is sent.

# Tasks

## Wave 1: Infrastructure & Consumer Setup

### [NEW] `services/notification-service/package.json`
<action>
Initialize package.json for the Node worker.
Set dependencies: `kafkajs` (v2.2.4), `nodemailer` (v9.0.5).
Set dev dependencies: `jest` (or Node's built-in `test` runner).
Add a `start` script targeting `src/index.js`.
</action>
<verify>
`npm install` completes successfully without errors in the directory.
</verify>

### [NEW] `services/notification-service/Dockerfile`
<action>
Create a multi-stage Dockerfile for the worker.
Base image: `node:24-alpine`.
Build stage: run `npm ci`.
Production stage: copy node_modules and src, run `npm ci --omit=dev`, and set `CMD ["node", "src/index.js"]`.
</action>
<verify>
`docker build -t ecommerce-notification-service ./services/notification-service` succeeds.
</verify>

### [MODIFY] `docker-compose.yml`
<read_first>
docker-compose.yml
</read_first>
<action>
Add the `notification-service` block under `services`.
Use `build: ./services/notification-service`.
Add environment variables:
- `KAFKA_BROKERS=kafka:9092`
- `SMTP_HOST=mailpit`
- `SMTP_PORT=1025`
Add `depends_on`: `kafka` and `mailpit`.
</action>
<verify>
`docker compose config` validates successfully.
</verify>

## Wave 2: Email Logic & Topic Consumption

### [NEW] `services/notification-service/src/email.js`
<read_first>
docs/kafka-topics.md
</read_first>
<action>
Create functions to generate the HTML or text email bodies based on the contract payload.
- `sendOrderConfirmed(event)`: Uses `items`, `totalCents`, and `currency` from the `order.created` payload. Returns the payload for `nodemailer`.
- `sendPaymentFailed(event)`: Uses `orderId` and `reason` from the `payment.completed` payload. Returns the payload for `nodemailer`.
</action>
<verify>
Unit test for `email.js` validates the exact fields present in the output correspond to the `docs/kafka-topics.md` requirements.
</verify>

### [NEW] `services/notification-service/src/index.js`
<read_first>
docs/kafka-topics.md
</read_first>
<action>
Implement the main Kafka consumer loop using `kafkajs`.
- Connect to Kafka (`KAFKA_BROKERS`).
- Subscribe to `order.created` and `payment.completed` from the beginning.
- Maintain an in-memory `Set` of processed `eventId` strings for idempotency (dedup).
- In the `eachMessage` handler:
  - Extract `eventId`. If already in the Set, skip processing.
  - If topic is `order.created`, call `sendOrderConfirmed` and send via `nodemailer`.
  - If topic is `payment.completed` and `outcome === 'DECLINED'`, call `sendPaymentFailed` and send via `nodemailer`.
  - Otherwise (e.g., `payment.completed` with `outcome === 'APPROVED'`), ignore.
  - Add `eventId` to the Set.
</action>
<verify>
Unit or integration tests (or manual run) verify that messages are consumed and processed identically to the defined contract, and duplicates are safely ignored.
</verify>
